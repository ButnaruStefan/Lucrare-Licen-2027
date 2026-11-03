/**
 * Coada descoperirilor de pagini, pastrata in tabelul audits (la fel ca scanarile, fara Redis).
 *
 * Un audit nou are starea "discovery_queued". Worker-ul il rezerva (trecandu-l in
 * "discovering"), cauta paginile site-ului si salveaza rezultatul ("awaiting_selection"),
 * sau motivul esecului ("failed"). Dupa ce utilizatorul alege paginile, auditul trece in
 * "scanning", iar paginile alese devin scanari obisnuite in coada de scanari.
 *
 * Rezervarea foloseste `FOR UPDATE SKIP LOCKED`, ca in coada de scanari (`scans/queue.ts`).
 */
import { scanConfigSchema, type Discovery, type ScanConfig } from '@ro-a11y/shared';
import type { Database } from '../db/prisma';

export interface ClaimedDiscovery {
  id: string;
  startUrl: string;
  maxPages: number;
  config: ScanConfig;
}

/** Rezerva cel mai vechi audit care asteapta descoperirea, sau null daca nu exista. */
export async function claimNextDiscovery(db: Database): Promise<ClaimedDiscovery | null> {
  const rows = await db.$queryRaw<
    Array<{ id: string; start_url: string; max_pages: number; config: unknown }>
  >`
    UPDATE audits
    SET status = 'discovering', discovery_started_at = (NOW() AT TIME ZONE 'UTC')
    WHERE id = (
      SELECT id FROM audits
      WHERE status = 'discovery_queued'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, start_url, max_pages, config`;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    startUrl: row.start_url,
    maxPages: row.max_pages,
    config: scanConfigSchema.parse(row.config),
  };
}

/** Salveaza paginile gasite; auditul asteapta alegerea utilizatorului. */
export async function saveDiscovery(db: Database, auditId: string, discovery: Discovery) {
  await db.audit.updateMany({
    where: { id: auditId, status: 'discovering' },
    data: {
      status: 'awaiting_selection',
      discovery: discovery as unknown as object,
      discoveredAt: new Date(),
    },
  });
}

/** Marcheaza descoperirea esuata (doar daca auditul e inca in curs de descoperire). */
export async function failDiscovery(
  db: Database,
  auditId: string,
  data: { errorCode: string; errorMessage: string },
) {
  await db.audit.updateMany({
    where: { id: auditId, status: 'discovering' },
    data: { status: 'failed', errorCode: data.errorCode, errorMessage: data.errorMessage },
  });
}

/** Descoperirile ramase "discovering" prea mult (ex. worker oprit brusc) devin "failed". */
export async function failStaleDiscoveries(db: Database, olderThanMs: number): Promise<number> {
  const result = await db.audit.updateMany({
    where: {
      status: 'discovering',
      discoveryStartedAt: { lt: new Date(Date.now() - olderThanMs) },
    },
    data: {
      status: 'failed',
      errorCode: 'WORKER_INTERRUPTED',
      errorMessage: 'Căutarea paginilor a fost întreruptă (worker-ul s-a oprit în timpul ei).',
    },
  });
  return result.count;
}
