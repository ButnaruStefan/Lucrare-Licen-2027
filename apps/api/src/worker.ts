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
 */
import { env } from './config/env';
import { createPrismaClient } from './db/prisma';
import { createLogger } from './lib/logger';
import { describeBrowser, launchBrowser } from './scanner/browser';
import { processScan } from './scans/process-scan';
import { claimNextScan, failStaleScans } from './scans/queue';

/** Scanarile "running" mai vechi de atat sunt considerate intrerupte. */
const STALE_SCAN_MS = 10 * 60 * 1000;

const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV === 'development');
const db = createPrismaClient(env.DATABASE_URL);

let stopping = false;

async function main() {
  const browser = await launchBrowser(env.BROWSER_CHANNEL);
  const browserVersion = describeBrowser(browser, env.BROWSER_CHANNEL);
  logger.info(`Worker pornit (${browserVersion}). Astept scanari...`);

  const stale = await failStaleScans(db, STALE_SCAN_MS);
  if (stale > 0) logger.warn(`${stale} scanari intrerupte anterior au fost marcate "failed"`);

  const deps = {
    db,
    browser,
    browserVersion,
    guardOptions: { allowedLocalOrigins: env.SCAN_ALLOWED_LOCAL_ORIGINS },
    logger,
  };

  while (!stopping) {
    const scan = await claimNextScan(db);
    if (scan) {
      logger.info({ scanId: scan.id, pageUrl: scan.pageUrl }, 'Scanare preluata');
      await processScan(deps, scan);
    } else {
      await new Promise((resolve) => setTimeout(resolve, env.WORKER_POLL_INTERVAL_MS));
    }
  }

  await browser.close();
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
