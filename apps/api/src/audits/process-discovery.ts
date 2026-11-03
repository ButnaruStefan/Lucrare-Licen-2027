/**
 * Procesarea unei descoperiri rezervate din coada (folosita de worker, prin `worker-loop.ts`):
 *   1. verifica din nou adresa de start (paznicul SSRF);
 *   2. cauta paginile site-ului (`discovery/discover.ts`);
 *   3. salveaza rezultatul sau motivul esecului.
 *
 * Ca la scanari, totul are o limita ferma de timp: o descoperire nu poate ramane
 * "discovering" la nesfarsit; daca se blocheaza, worker-ul e anuntat sa reporneasca browserul.
 */
import type { Browser } from 'playwright';
import type { Database } from '../db/prisma';
import type { Logger } from '../lib/logger';
import { discoverPages } from '../discovery/discover';
import { checkUrl, createRequestGuard, type UrlGuardOptions } from '../safety/url-guard';
import type { ProcessScanResult } from '../scans/process-scan';
import { failDiscovery, saveDiscovery, type ClaimedDiscovery } from './queue';

export interface ProcessDiscoveryDeps {
  db: Database;
  browser: Browser;
  guardOptions: UrlGuardOptions;
  logger: Logger;
  /** Limita totala de timp; implicit, calculata din configuratia auditului. */
  timeLimitMs?: number;
}

/** Limita totala: incarcarea paginii de start + robots.txt + sitemap-uri (cate 10 s fiecare). */
export function defaultDiscoveryTimeLimitMs(pageTimeoutMs: number): number {
  return pageTimeoutMs * 2 + 90_000;
}

class DiscoveryTimeoutError extends Error {}

function withTimeLimit<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DiscoveryTimeoutError()), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

export async function processDiscovery(
  deps: ProcessDiscoveryDeps,
  audit: ClaimedDiscovery,
): Promise<ProcessScanResult> {
  const { db, browser, guardOptions, logger } = deps;
  const log = logger.child({ auditId: audit.id, startUrl: audit.startUrl });
  const timeLimitMs = deps.timeLimitMs ?? defaultDiscoveryTimeLimitMs(audit.config.timeoutMs);

  try {
    const outcome = await withTimeLimit(
      (async () => {
        const precheck = await checkUrl(audit.startUrl, guardOptions);
        if (!precheck.ok) {
          return {
            ok: false as const,
            errorCode: 'UNSAFE_URL',
            errorMessage: precheck.message,
          };
        }
        return discoverPages(
          browser,
          audit.startUrl,
          audit.config,
          createRequestGuard(guardOptions),
          { maxPages: audit.maxPages, seed: audit.id },
        );
      })(),
      timeLimitMs,
    );

    if (!outcome.ok) {
      log.info({ errorCode: outcome.errorCode }, 'Descoperire esuata');
      await failDiscovery(db, audit.id, outcome);
      return { browserHealthy: true };
    }
    await saveDiscovery(db, audit.id, outcome.discovery);
    log.info(
      {
        pages: outcome.discovery.pages.length,
        proposed: outcome.discovery.pages.filter((p) => p.proposed).length,
      },
      'Descoperire terminata',
    );
    return { browserHealthy: true };
  } catch (err) {
    if (err instanceof DiscoveryTimeoutError) {
      log.error({ timeLimitMs }, 'Descoperirea a depasit limita de timp');
      await failDiscovery(db, audit.id, {
        errorCode: 'DISCOVERY_TIMEOUT',
        errorMessage: `Căutarea paginilor a depășit timpul maxim (${Math.round(timeLimitMs / 1000)} s). Poate fi pornită din nou.`,
      }).catch(() => {});
      return { browserHealthy: false };
    }
    log.error({ err }, 'Eroare neasteptata in timpul descoperirii');
    await failDiscovery(db, audit.id, {
      errorCode: 'INTERNAL_ERROR',
      errorMessage: 'A apărut o eroare internă în timpul căutării paginilor.',
    }).catch(() => {});
    return { browserHealthy: browser.isConnected() };
  }
}
