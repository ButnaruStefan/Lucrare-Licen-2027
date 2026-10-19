/**
 * Worker-ul de scanare (`npm run dev:worker`): proces separat de API.
 *
 * Porneste browserul o singura data, apoi, intr-o bucla:
 *   - rezerva urmatoarea scanare "queued" din baza de date;
 *   - o proceseaza (browser + axe-core + salvarea rezultatelor);
 *   - daca nu exista scanari in asteptare, asteapta putin si verifica din nou.
 *
 * E separat de API ca o scanare lenta (zeci de secunde) sa nu blocheze raspunsurile API-ului.
 * Proceseaza o singura scanare odata, ca sa nu suprasolicite calculatorul sau site-ul scanat.
 *
 * Robustete: inainte de fiecare scanare verifica daca browserul mai e conectat; dupa o scanare
 * blocata (limita de timp depasita) inchide browserul si porneste altul. Astfel, o problema a
 * browserului (ex. Chrome actualizat automat in timp ce ruleaza) afecteaza cel mult o scanare.
 */
import { env } from './config/env';
import { createPrismaClient } from './db/prisma';
import { createLogger } from './lib/logger';
import { describeBrowser, launchBrowser } from './scanner/browser';
import { processScan } from './scans/process-scan';
import type { Browser } from 'playwright';
import { claimNextScan, failStaleScans } from './scans/queue';

/**
 * La pornire, scanarile ramase "running" mai vechi de atat sunt considerate intrerupte.
 * O scanare nu poate dura mai mult de limita ei de timp (implicit 90 s), deci 3 minute ajung.
 */
const STALE_SCAN_MS = 3 * 60 * 1000;

/** Cat asteptam, cel mult, inchiderea unui browser blocat. */
const BROWSER_CLOSE_TIMEOUT_MS = 10_000;

const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV === 'development');
const db = createPrismaClient(env.DATABASE_URL);

let stopping = false;

let browser: Browser | null = null;
let browserVersion = '';

/** Porneste browserul daca nu exista sau daca s-a deconectat. */
async function ensureBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  if (browser) await closeBrowser();
  browser = await launchBrowser(env.BROWSER_CHANNEL);
  browserVersion = describeBrowser(browser, env.BROWSER_CHANNEL);
  logger.info(`Browser pornit (${browserVersion})`);
  return browser;
}

/** Inchide browserul, fara sa astepte la nesfarsit daca e blocat. */
async function closeBrowser() {
  const current = browser;
  browser = null;
  if (!current) return;
  await Promise.race([
    current.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, BROWSER_CLOSE_TIMEOUT_MS)),
  ]);
}

async function main() {
  await ensureBrowser();
  logger.info('Worker pornit. Astept scanari...');

  const stale = await failStaleScans(db, STALE_SCAN_MS);
  if (stale > 0) logger.warn(`${stale} scanari intrerupte anterior au fost marcate "failed"`);

  while (!stopping) {
    const scan = await claimNextScan(db);
    if (!scan) {
      await new Promise((resolve) => setTimeout(resolve, env.WORKER_POLL_INTERVAL_MS));
      continue;
    }
    logger.info({ scanId: scan.id, pageUrl: scan.pageUrl }, 'Scanare preluata');
    const current = await ensureBrowser();
    const result = await processScan(
      {
        db,
        browser: current,
        browserVersion,
        guardOptions: { allowedLocalOrigins: env.SCAN_ALLOWED_LOCAL_ORIGINS },
        logger,
      },
      scan,
    );
    if (!result.browserHealthy) {
      logger.warn('Browserul pare blocat; il repornesc inainte de urmatoarea scanare');
      await closeBrowser();
    }
  }

  await closeBrowser();
  await db.$disconnect();
  logger.info('Worker oprit.');
}

function requestStop(signal: string) {
  logger.info(`Semnal ${signal} primit, opresc worker-ul dupa scanarea curenta...`);
  stopping = true;
}

process.on('SIGINT', () => requestStop('SIGINT'));
process.on('SIGTERM', () => requestStop('SIGTERM'));

main().catch((err) => {
  logger.fatal({ err }, 'Worker-ul nu a putut porni');
  process.exit(1);
});
