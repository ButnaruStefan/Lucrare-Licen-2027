/**
 * Rutele pentru verificarea manuala (facuta de om) a unei pagini scanate:
 *
 * - GET    /api/v1/scans/:scanId/manual-checks           — cele 6 verificari (pasii, criteriile
 *                                                          WCAG, sursele W3C), starea fiecareia
 *                                                          pe pagina si ce contine pagina
 * - PUT    /api/v1/scans/:scanId/manual-checks/:checkId  — salveaza rezultatul unei verificari
 *                                                          (rezultat, cine a verificat, note)
 * - DELETE /api/v1/scans/:scanId/manual-checks/:checkId  — sterge rezultatul (din nou de facut)
 *
 * Disponibile doar pentru scanarile terminate care au verificat accesibilitatea (verificarea
 * manuala e de accesibilitate). Un rezultat manual nu se completeaza niciodata automat; singurul
 * lucru detectat automat e ca o verificare nu se aplica (din `scans.page_facts`).
 *
 * `loadManualSummaries` (progresul pe pagina) e folosit si de rutele scanarilor si auditurilor.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  manualEvaluationInputSchema,
  manualStatus,
  pageFactsSchema,
  scanConfigSchema,
  summarizeManual,
  type ManualEvaluation,
  type ManualResult,
  type ManualSummary,
  type PageFacts,
  type ScanManualChecks,
} from '@ro-a11y/shared';
import {
  autoNotApplicableReason,
  MANUAL_CHECKS,
  MANUAL_CHECKS_VERSION,
  manualCheckCriteria,
  manualCheckDefinition,
} from '@ro-a11y/catalog';
import type { Database } from '../db/prisma';
import { HttpError } from '../middleware/errors';
import { validate } from '../lib/validation';

export interface ManualChecksDeps {
  db: Database;
}

/** Ce trebuie stiut despre o scanare ca sa stim daca are verificare manuala. */
interface ScanForManual {
  id: string;
  status: string;
  config: unknown;
  pageFacts: unknown;
}

function scanNotFound() {
  return new HttpError(404, 'SCAN_NOT_FOUND', 'Scanarea nu există.');
}

/** Verificarea manuala exista doar pe scanarile terminate care au verificat accesibilitatea. */
function hasManualReview(scan: ScanForManual): boolean {
  return (
    scan.status === 'completed' && scanConfigSchema.parse(scan.config).checks.accessibility === true
  );
}

/** Ce contine pagina, citit sigur din baza de date (null = nu stim). */
function factsOf(scan: ScanForManual): PageFacts | null {
  const parsed = pageFactsSchema.safeParse(scan.pageFacts);
  return parsed.success ? parsed.data : null;
}

/**
 * Progresul verificarii manuale pentru mai multe scanari odata. O scanare fara verificare
 * manuala (neterminata sau doar de aspect) nu apare in rezultat.
 */
export async function loadManualSummaries(
  db: Database,
  scans: ScanForManual[],
): Promise<Map<string, ManualSummary>> {
  const result = new Map<string, ManualSummary>();
  const eligible = scans.filter(hasManualReview);
  if (eligible.length === 0) return result;
  const rows = await db.manualEvaluation.findMany({
    where: { scanId: { in: eligible.map((s) => s.id) } },
    select: { scanId: true, checkId: true, result: true },
  });
  for (const scan of eligible) {
    const facts = factsOf(scan);
    const statuses = MANUAL_CHECKS.map((check) => {
      const saved = rows.find((r) => r.scanId === scan.id && r.checkId === check.id);
      return manualStatus(saved ?? null, autoNotApplicableReason(check, facts));
    });
    result.set(scan.id, summarizeManual(statuses));
  }
  return result;
}

export function manualChecksRouter({ db }: ManualChecksDeps): Router {
  const router = Router();

  /** Scanarea, daca exista si are verificare manuala; altfel eroarea potrivita. */
  async function eligibleScan(scanId: string | undefined) {
    if (!z.uuid().safeParse(scanId).success) throw scanNotFound();
    const scan = await db.scan.findUnique({
      where: { id: scanId },
      select: { id: true, status: true, config: true, pageFacts: true },
    });
    if (!scan) throw scanNotFound();
    if (!hasManualReview(scan)) {
      throw new HttpError(
        404,
        'MANUAL_REVIEW_NOT_AVAILABLE',
        'Verificarea manuală e disponibilă doar pentru scanările de accesibilitate terminate.',
      );
    }
    return scan;
  }

  function checkOf(checkId: string | undefined) {
    const check = checkId ? manualCheckDefinition(checkId) : null;
    if (!check) {
      throw new HttpError(404, 'MANUAL_CHECK_NOT_FOUND', 'Verificarea manuală nu există.');
    }
    return check;
  }

  router.get('/api/v1/scans/:scanId/manual-checks', async (req, res) => {
    const scan = await eligibleScan(req.params.scanId);
    const facts = factsOf(scan);
    const saved = await db.manualEvaluation.findMany({ where: { scanId: scan.id } });

    const checks = MANUAL_CHECKS.map((check) => {
      const row = saved.find((r) => r.checkId === check.id);
      const evaluation: ManualEvaluation | null = row
        ? {
            result: row.result as ManualResult,
            evaluator: row.evaluator,
            notes: row.notes,
            checksVersion: row.checksVersion,
            updatedAt: row.updatedAt.toISOString(),
          }
        : null;
      const autoNotApplicable = autoNotApplicableReason(check, facts);
      return {
        id: check.id,
        title: check.title,
        why: check.why,
        criteria: manualCheckCriteria(check),
        steps: [...check.steps],
        passWhen: check.passWhen,
        cautions: [...check.cautions],
        sources: check.sources.map((s) => ({ ...s })),
        autoNotApplicable,
        status: manualStatus(evaluation, autoNotApplicable),
        evaluation,
      };
    });
    const body: ScanManualChecks = {
      checksVersion: MANUAL_CHECKS_VERSION,
      facts,
      checks,
      summary: summarizeManual(checks.map((c) => c.status)),
    };
    res.json(body);
  });

  router.put('/api/v1/scans/:scanId/manual-checks/:checkId', async (req, res) => {
    const scan = await eligibleScan(req.params.scanId);
    const check = checkOf(req.params.checkId);
    const input = validate(manualEvaluationInputSchema, req.body ?? {});
    const data = {
      result: input.result,
      evaluator: input.evaluator,
      notes: input.notes,
      checksVersion: MANUAL_CHECKS_VERSION,
    };
    const row = await db.manualEvaluation.upsert({
      where: { scanId_checkId: { scanId: scan.id, checkId: check.id } },
      create: { scanId: scan.id, checkId: check.id, ...data },
      update: data,
    });
    const body: ManualEvaluation = {
      result: row.result as ManualResult,
      evaluator: row.evaluator,
      notes: row.notes,
      checksVersion: row.checksVersion,
      updatedAt: row.updatedAt.toISOString(),
    };
    res.json(body);
  });

  router.delete('/api/v1/scans/:scanId/manual-checks/:checkId', async (req, res) => {
    const scan = await eligibleScan(req.params.scanId);
    const check = checkOf(req.params.checkId);
    await db.manualEvaluation.deleteMany({ where: { scanId: scan.id, checkId: check.id } });
    res.status(204).end();
  });

  return router;
}
