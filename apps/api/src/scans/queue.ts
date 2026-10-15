/**
 * Coada de scanari, pastrata direct in PostgreSQL (tabelul scans), fara Redis.
 *
 * O scanare noua are starea "queued". Worker-ul o "rezerva" (claim) trecand-o in "running",
 * apoi, la final, o marcheaza "completed" (cu rezultate) sau "failed" (cu motivul).
 *
 * Rezervarea foloseste `FOR UPDATE SKIP LOCKED`: daca doua worker-e cer o scanare in acelasi
 * timp, fiecare primeste alta, iar niciuna nu e procesata de doua ori.
 *
 * Datele calendaristice sunt pastrate in UTC (ca toate cele scrise de Prisma), de aceea
 * `NOW() AT TIME ZONE 'UTC'`: simplul NOW() ar folosi ora locala a serverului PostgreSQL.
 */
import type { AxeResults } from 'axe-core';
import { scanConfigSchema, type ScanConfig } from '@ro-a11y/shared';
import type { Database } from '../db/prisma';
import type { NormalizedRuleResult } from '../scanner/normalize';

export interface ClaimedScan {
  id: string;
  pageUrl: string;
  config: ScanConfig;
}

/** Rezerva cea mai veche scanare in asteptare, sau returneaza null daca nu exista. */
export async function claimNextScan(db: Database): Promise<ClaimedScan | null> {
  const rows = await db.$queryRaw<Array<{ id: string; page_url: string; config: unknown }>>`
    UPDATE scans
    SET status = 'running', started_at = (NOW() AT TIME ZONE 'UTC')
    WHERE id = (
      SELECT id FROM scans
      WHERE status = 'queued'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, page_url, config`;
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, pageUrl: row.page_url, config: scanConfigSchema.parse(row.config) };
}

export interface CompletedScanData {
  raw: AxeResults;
  results: NormalizedRuleResult[];
  finalUrl: string;
  httpStatus: number;
  engineVersion: string;
  browserVersion: string;
}

/** Salveaza rezultatele si marcheaza scanarea "completed", totul intr-o singura tranzactie. */
export async function completeScan(db: Database, scanId: string, data: CompletedScanData) {
  await db.$transaction(
    async (tx) => {
      for (const result of data.results) {
        await tx.ruleResult.create({
          data: {
            scanId,
            axeRuleId: result.axeRuleId,
            category: result.category,
            impact: result.impact,
            title: result.title,
            description: result.description,
            docsUrl: result.docsUrl,
            axeTags: result.axeTags,
            wcagCriteria: result.wcagCriteria,
            affectedElements: {
              create: result.elements.map((el) => ({
                cssSelector: el.cssSelector as object,
                htmlSnippet: el.htmlSnippet,
                failureSummary: el.failureSummary,
                fingerprint: el.fingerprint,
              })),
            },
          },
        });
      }
      await tx.scan.update({
        where: { id: scanId },
        data: {
          status: 'completed',
          finishedAt: new Date(),
          finalUrl: data.finalUrl,
          httpStatus: data.httpStatus,
          engineName: 'axe-core',
          engineVersion: data.engineVersion,
          browserVersion: data.browserVersion,
          rawAxeResult: data.raw as unknown as object,
        },
      });
    },
    { timeout: 30_000 },
  );
}

export interface FailedScanData {
  errorCode: string;
  errorMessage: string;
  finalUrl?: string | null;
  httpStatus?: number | null;
  browserVersion?: string | null;
}

/** Marcheaza scanarea "failed". Un esec tehnic NU inseamna ca site-ul e inaccesibil. */
export async function failScan(db: Database, scanId: string, data: FailedScanData) {
  await db.scan.update({
    where: { id: scanId },
    data: {
      status: 'failed',
      finishedAt: new Date(),
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
      finalUrl: data.finalUrl ?? null,
      httpStatus: data.httpStatus ?? null,
      browserVersion: data.browserVersion ?? null,
    },
  });
}

/**
 * La pornirea worker-ului: scanarile ramase "running" de prea mult timp (ex. worker oprit
 * brusc) sunt marcate "failed", ca sa nu ramana blocate pentru totdeauna.
 */
export async function failStaleScans(db: Database, olderThanMs: number): Promise<number> {
  const result = await db.scan.updateMany({
    where: { status: 'running', startedAt: { lt: new Date(Date.now() - olderThanMs) } },
    data: {
      status: 'failed',
      finishedAt: new Date(),
      errorCode: 'WORKER_INTERRUPTED',
      errorMessage: 'Scanarea a fost întreruptă (worker-ul s-a oprit în timpul ei).',
    },
  });
  return result.count;
}
