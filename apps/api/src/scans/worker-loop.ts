/**
 * Un pas al buclei worker-ului: pregateste browserul, rezerva o scanare si o proceseaza.
 *
 * Folosit de `worker.ts` (in bucla) si de teste (pas cu pas, cu dependente simulate).
 *
 * Regula de baza: worker-ul nu are voie sa ramana blocat si nu are voie sa se opreasca singur.
 *   1. Browserul e pregatit INAINTE de rezervarea scanarii (cu limita de timp la pornire). Daca
 *      nu porneste, scanarea ramane in coada ("queued") si se reincearca mai tarziu; nu ramane
 *      "running" fara nimeni care sa lucreze la ea.
 *   2. Ceasul de paza: procesarea are o limita proprie (vezi process-scan.ts), dar peste ea mai
 *      punem una, cu o rezerva. Daca nici aceea nu e respectata (orice s-ar agata inauntru),
 *      worker-ul marcheaza scanarea esuata, abandoneaza browserul si trece mai departe.
 *   3. Orice eroare neprevazuta e prinsa si notata in jurnal; bucla continua.
 *   4. Periodic, scanarile ramase "running" prea mult (ex. de la un worker oprit brusc) sunt
 *      marcate esuate, fara sa fie nevoie de repornirea worker-ului.
 */
import type { Browser } from 'playwright';
import type { Database } from '../db/prisma';
import type { Logger } from '../lib/logger';
import { defaultScanTimeLimitMs, type ProcessScanResult } from './process-scan';
import { claimNextScan, failScan, failStaleScans, type ClaimedScan } from './queue';

/** Rezerva ceasului de paza peste limita normala a scanarii. */
export const WATCHDOG_GRACE_MS = 30_000;

/** Cat de des cautam scanari ramase "running" prea mult. */
export const STALE_CHECK_INTERVAL_MS = 60_000;

/** Pornirea, verificarea si oprirea browserului, oferite din exterior (reale sau simulate). */
export interface BrowserManager {
  /** Browserul gata de lucru (pornit acum, daca nu exista sau s-a deconectat). */
  ensure(): Promise<{ browser: Browser; version: string }>;
  /** Abandoneaza browserul curent (blocat); urmatorul `ensure` porneste altul. */
  reset(): Promise<void>;
}

export interface WorkerLoopDeps {
  db: Database;
  logger: Logger;
  browsers: BrowserManager;
  /** Procesarea unei scanari (in worker: `processScan` cu dependentele reale). */
  process: (browser: Browser, version: string, scan: ClaimedScan) => Promise<ProcessScanResult>;
  /** Dupa cat timp o scanare "running" e considerata abandonata. */
  staleAfterMs: number;
  /** Doar pentru teste: limita ceasului de paza (implicit: limita scanarii + rezerva). */
  watchdogMs?: (scan: ClaimedScan) => number;
}

export type IterationResult = 'idle' | 'processed' | 'browser_unavailable' | 'watchdog' | 'error';

const WATCHDOG = Symbol('watchdog');

/** Asteapta promisiunea cel mult `ms`; daca timpul expira, returneaza WATCHDOG. */
function raceWithWatchdog<T>(promise: Promise<T>, ms: number): Promise<T | typeof WATCHDOG> {
  let timer: NodeJS.Timeout | undefined;
  const watchdog = new Promise<typeof WATCHDOG>((resolve) => {
    timer = setTimeout(() => resolve(WATCHDOG), ms);
  });
  return Promise.race([promise, watchdog]).finally(() => clearTimeout(timer));
}

let lastStaleCheck = 0;

/** Marcheaza esuate scanarile abandonate, cel mult o data pe minut. */
export async function sweepStaleScans(deps: WorkerLoopDeps, force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastStaleCheck < STALE_CHECK_INTERVAL_MS) return 0;
  lastStaleCheck = now;
  const count = await failStaleScans(deps.db, deps.staleAfterMs);
  if (count > 0) deps.logger.warn(`${count} scanari abandonate au fost marcate "failed"`);
  return count;
}

/** Un pas al buclei. Nu arunca niciodata erori: rezultatul spune ce s-a intamplat. */
export async function runWorkerIteration(deps: WorkerLoopDeps): Promise<IterationResult> {
  const { db, logger, browsers } = deps;
  let scan: ClaimedScan | null = null;

  try {
    await sweepStaleScans(deps);

    // 1. Browserul, inainte de rezervare: o scanare nu e luata daca nu avem cu ce s-o facem.
    let ready: { browser: Browser; version: string };
    try {
      ready = await browsers.ensure();
    } catch (err) {
      logger.error({ err }, 'Browserul nu a putut fi pornit; reincerc mai tarziu');
      await browsers.reset().catch(() => {});
      return 'browser_unavailable';
    }

    scan = await claimNextScan(db);
    if (!scan) return 'idle';
    logger.info({ scanId: scan.id, pageUrl: scan.pageUrl }, 'Scanare preluata');

    // 2. Procesarea, sub ceasul de paza.
    const limitMs =
      deps.watchdogMs?.(scan) ?? defaultScanTimeLimitMs(scan.config.timeoutMs) + WATCHDOG_GRACE_MS;
    const result = await raceWithWatchdog(
      deps.process(ready.browser, ready.version, scan),
      limitMs,
    );

    if (result === WATCHDOG) {
      logger.error(
        { scanId: scan.id, limitMs },
        'Ceasul de paza a oprit o scanare blocata; browserul va fi repornit',
      );
      await failScan(db, scan.id, {
        errorCode: 'SCAN_TIMEOUT',
        errorMessage: `Scanarea a depășit timpul maxim (${Math.round(limitMs / 1000)} s) și a fost oprită. Poate fi pornită din nou.`,
        browserVersion: ready.version,
      }).catch((err) => logger.error({ err }, 'Scanarea blocata nu a putut fi marcata'));
      await browsers.reset().catch(() => {});
      return 'watchdog';
    }

    if (!result.browserHealthy) {
      logger.warn('Browserul pare blocat; il repornesc inainte de urmatoarea scanare');
      await browsers.reset().catch(() => {});
    }
    return 'processed';
  } catch (err) {
    // 3. Orice altceva (ex. baza de date indisponibila pentru o clipa): notam si continuam.
    logger.error({ err, scanId: scan?.id }, 'Eroare neasteptata in bucla worker-ului');
    if (scan) {
      await failScan(db, scan.id, {
        errorCode: 'INTERNAL_ERROR',
        errorMessage: 'A apărut o eroare internă în timpul scanării.',
      }).catch(() => {});
    }
    return 'error';
  }
}
