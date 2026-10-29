/**
 * Worker-ul de scanare (`npm run dev:worker`): proces separat de API.
 *
 * Intr-o bucla, repeta un pas (vezi `scans/worker-loop.ts`):
 *   - pregateste browserul (il porneste sau il reporneste, la nevoie);
 *   - rezerva urmatoarea scanare "queued" din baza de date si o proceseaza
 *     (browser + axe-core + salvarea rezultatelor);
 *   - daca nu exista scanari in asteptare, asteapta putin si verifica din nou.
 *
 * E separat de API ca o scanare lenta (zeci de secunde) sa nu blocheze raspunsurile API-ului.
 * Proceseaza o singura scanare odata, ca sa nu suprasolicite calculatorul sau site-ul scanat.
 *
 * Robustete: worker-ul nu ramane blocat si nu se opreste singur. Fiecare scanare are o limita
 * de timp si, peste ea, un ceas de paza; un browser blocat e abandonat si inlocuit; orice eroare
 * e notata in jurnal, iar bucla continua. Ctrl+C opreste worker-ul chiar daca o scanare e blocata.
 */
import { env } from './config/env'; //variabile de mediu
import { createPrismaClient } from './db/prisma'; //prisma client
import { createLogger } from './lib/logger'; //logger
import { createBrowserManager } from './scanner/browser'; //browser
import { processScan } from './scans/process-scan'; //proces scanare
import { runWorkerIteration, sweepStaleScans, type WorkerLoopDeps } from './scans/worker-loop'; //un pas al buclei

/**
 * Scanarile ramase "running" mai vechi de atat sunt considerate abandonate (ex. worker oprit
 * brusc). O scanare nu poate dura mai mult de limita ei + ceasul de paza (implicit 2 min).
 */
const STALE_SCAN_MS = 3 * 60 * 1000;

/** Dupa primul Ctrl+C, cat asteptam terminarea scanarii curente inainte de oprirea fortata. */
const FORCED_EXIT_MS = 15_000;

const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV === 'development');
const db = createPrismaClient(env.DATABASE_URL);
const browsers = createBrowserManager(env.BROWSER_CHANNEL, logger);
const guardOptions = { allowedLocalOrigins: env.SCAN_ALLOWED_LOCAL_ORIGINS };

let stopping = false;

const deps: WorkerLoopDeps = {
  db,
  logger,
  browsers,
  staleAfterMs: STALE_SCAN_MS,
  process: (browser, browserVersion, scan) =>
    processScan({ db, browser, browserVersion, guardOptions, logger }, scan),
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  logger.info('Worker pornit. Astept scanari...');
  await sweepStaleScans(deps, true).catch((err) =>
    logger.error({ err }, 'Verificarea scanarilor abandonate a esuat'),
  );

  while (!stopping) {
    const result = await runWorkerIteration(deps);
    // Dupa o scanare, trecem imediat la urmatoarea; altfel asteptam putin.
    if (result !== 'processed' && result !== 'watchdog') {
      await sleep(result === 'idle' ? env.WORKER_POLL_INTERVAL_MS : 5_000);
    }
  }

  await browsers.reset();
  await db.$disconnect();
  logger.info('Worker oprit.');
  process.exit(0);
}

function requestStop(signal: string) {
  if (stopping) {
    // Al doilea Ctrl+C: oprire imediata.
    logger.warn('Oprire fortata.');
    process.exit(1);
  }
  stopping = true;
  logger.info(`Semnal ${signal} primit, opresc worker-ul dupa scanarea curenta...`);
  // Daca scanarea curenta e blocata, nu asteptam la nesfarsit.
  setTimeout(() => {
    logger.warn('Scanarea curenta nu s-a terminat la timp; oprire fortata.');
    process.exit(1);
  }, FORCED_EXIT_MS).unref();
}

process.on('SIGINT', () => requestStop('SIGINT'));
process.on('SIGTERM', () => requestStop('SIGTERM'));

main().catch((err) => {
  logger.fatal({ err }, 'Worker-ul s-a oprit neasteptat');
  process.exit(1);
});
