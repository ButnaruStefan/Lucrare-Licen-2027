/**
 * Procesarea completa a unei scanari rezervate din coada:
 *   1. verifica din nou adresa (intre crearea scanarii si rulare, DNS-ul se poate schimba);
 *   2. scaneaza pagina (browser + axe-core);
 *   3. normalizeaza rezultatul si il salveaza, sau salveaza motivul esecului.
 *
 * Primeste toate dependentele din exterior (baza de date, browser, paznic), deci poate fi
 * folosita la fel de worker si de teste.
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
}

export async function processScan(deps: ProcessScanDeps, scan: ClaimedScan): Promise<void> {
  const { db, browser, browserVersion, guardOptions, logger } = deps;
  const log = logger.child({ scanId: scan.id, pageUrl: scan.pageUrl });

  try {
    const precheck = await checkUrl(scan.pageUrl, guardOptions);
    if (!precheck.ok) {
      log.warn({ reason: precheck.reason }, 'Adresa respinsa de paznic');
      await failScan(db, scan.id, { errorCode: 'UNSAFE_URL', errorMessage: precheck.message });
      return;
    }

    const outcome = await scanPage(
      browser,
      scan.pageUrl,
      scan.config,
      createRequestGuard(guardOptions),
    );
    if (outcome.blockedRequests.length > 0) {
      log.warn({ blocked: outcome.blockedRequests }, 'Cereri blocate de paznic in timpul scanarii');
    }

    if (!outcome.ok) {
      log.info({ errorCode: outcome.errorCode }, 'Scanare esuata');
      await failScan(db, scan.id, { ...outcome, browserVersion });
      return;
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
  } catch (err) {
    // Orice eroare neprevazuta: scanarea nu ramane "running" la nesfarsit.
    log.error({ err }, 'Eroare neasteptata in timpul scanarii');
    await failScan(db, scan.id, {
      errorCode: 'INTERNAL_ERROR',
      errorMessage: 'A apărut o eroare internă în timpul scanării.',
      browserVersion,
    }).catch(() => {});
  }
}
