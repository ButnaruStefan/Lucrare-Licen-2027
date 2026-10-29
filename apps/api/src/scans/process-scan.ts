/**
 * Procesarea completa a unei scanari rezervate din coada:
 *   1. verifica din nou adresa (intre crearea scanarii si rulare, DNS-ul se poate schimba);
 *   2. scaneaza pagina (browser + axe-core);
 *   3. normalizeaza rezultatul si il salveaza, sau salveaza motivul esecului.
 *
 * Primeste toate dependentele din exterior (baza de date, browser, paznic), deci poate fi
 * folosita la fel de worker si de teste.
 *
 * Limita ferma de timp: oricat de prost s-ar comporta pagina, browserul (ex. Chrome actualizat
 * automat in timp ce ruleaza) sau DNS-ul, o scanare nu poate ramane "running" la nesfarsit.
 * Limita acopera toata inspectia: verificarea adresei (paznic + DNS) si scanarea in browser.
 * Daca depaseste limita, e marcata "failed" (SCAN_TIMEOUT), iar worker-ul e anuntat ca
 * browserul trebuie repornit.
 */
import type { Browser } from 'playwright';
import type { Database } from '../db/prisma';
import type { Logger } from '../lib/logger';
import { checkUrl, createRequestGuard, type UrlGuardOptions } from '../safety/url-guard';
import { normalizeAxeResults } from '../scanner/normalize';
import { scanPage } from '../scanner/page-scan';
import { completeScan, failScan, type ClaimedScan } from './queue';

export interface ProcessScanDeps {
  db: Database;
  browser: Browser;
  browserVersion: string;
  guardOptions: UrlGuardOptions;
  logger: Logger;
  /** Limita totala de timp a unei scanari; implicit, calculata din configuratia ei. */
  scanTimeLimitMs?: number;
}

export interface ProcessScanResult {
  /** false = browserul pare blocat sau deconectat; worker-ul trebuie sa porneasca altul. */
  browserHealthy: boolean;
}

/** Limita implicita: incarcarea paginii + inca o data pe atat pentru analiza + o rezerva. */
export function defaultScanTimeLimitMs(pageTimeoutMs: number): number {
  return pageTimeoutMs * 2 + 30_000;
}

class ScanTimeoutError extends Error {}

/** Asteapta promisiunea, dar cel mult `ms` milisecunde; apoi arunca ScanTimeoutError. */
function withTimeLimit<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ScanTimeoutError()), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

export async function processScan(
  deps: ProcessScanDeps,
  scan: ClaimedScan,
): Promise<ProcessScanResult> {
  const { db, browser, browserVersion, guardOptions, logger } = deps;
  const log = logger.child({ scanId: scan.id, pageUrl: scan.pageUrl });
  const timeLimitMs = deps.scanTimeLimitMs ?? defaultScanTimeLimitMs(scan.config.timeoutMs);

  try {
    // Verificarea adresei si scanarea, impreuna, sub aceeasi limita de timp.
    const inspection = await withTimeLimit(
      (async () => {
        const precheck = await checkUrl(scan.pageUrl, guardOptions);
        if (!precheck.ok) return { kind: 'unsafe', precheck } as const;
        const outcome = await scanPage(
          browser,
          scan.pageUrl,
          scan.config,
          createRequestGuard(guardOptions),
        );
        return { kind: 'scanned', outcome } as const;
      })(),
      timeLimitMs,
    );
    if (inspection.kind === 'unsafe') {
      const { precheck } = inspection;
      log.warn({ reason: precheck.reason }, 'Adresa respinsa de paznic');
      await failScan(db, scan.id, { errorCode: 'UNSAFE_URL', errorMessage: precheck.message });
      return { browserHealthy: true };
    }

    const { outcome } = inspection;
    if (outcome.blockedRequests.length > 0) {
      log.warn({ blocked: outcome.blockedRequests }, 'Cereri blocate de paznic in timpul scanarii');
    }

    if (!outcome.ok) {
      log.info({ errorCode: outcome.errorCode }, 'Scanare esuata');
      await failScan(db, scan.id, { ...outcome, browserVersion });
      return { browserHealthy: true };
    }

    const results = normalizeAxeResults(outcome.raw, outcome.finalUrl);
    await completeScan(db, scan.id, {
      raw: outcome.raw,
      results,
      finalUrl: outcome.finalUrl,
      httpStatus: outcome.httpStatus,
      engineVersion: outcome.raw.testEngine.version,
      browserVersion,
    });
    log.info(
      { violations: outcome.raw.violations.length, incomplete: outcome.raw.incomplete.length },
      'Scanare terminata',
    );
    return { browserHealthy: true };
  } catch (err) {
    if (err instanceof ScanTimeoutError) {
      log.error({ timeLimitMs }, 'Scanarea a depasit limita de timp; browserul va fi repornit');
      await failScan(db, scan.id, {
        errorCode: 'SCAN_TIMEOUT',
        errorMessage: `Scanarea a depășit timpul maxim (${Math.round(timeLimitMs / 1000)} s) și a fost oprită. Poate fi pornită din nou.`,
        browserVersion,
      }).catch(() => {});
      return { browserHealthy: false };
    }
    // Orice eroare neprevazuta: scanarea nu ramane "running" la nesfarsit.
    log.error({ err }, 'Eroare neasteptata in timpul scanarii');
    await failScan(db, scan.id, {
      errorCode: 'INTERNAL_ERROR',
      errorMessage: 'A apărut o eroare internă în timpul scanării.',
      browserVersion,
    }).catch(() => {});
    return { browserHealthy: browser.isConnected() };
  }
}
