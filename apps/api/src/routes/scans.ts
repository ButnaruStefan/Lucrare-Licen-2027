/**
 * Rutele pentru scanari:
 *
 * - POST /api/v1/projects/:projectId/scans  — cere o scanare noua; raspunde 202 (Accepted):
 *   scanarea intra in coada, iar worker-ul o va procesa separat
 * - GET  /api/v1/projects/:projectId/scans  — scanarile unui proiect, cele mai noi primele
 * - GET  /api/v1/scans/:scanId              — o scanare: stare, configuratie, versiuni, sumar
 * - GET  /api/v1/scans/:scanId/results      — rezultatele pe reguli, cu elementele afectate si
 *                                             lantul de trasabilitate (WCAG -> EN -> OUG 112/2018)
 *                                             (filtru optional: ?category=violation)
 *
 * Inainte de a crea scanarea, adresa trece prin paznic (protectie SSRF) si trebuie sa apartina
 * site-ului proiectului (aceeasi origine), ca un proiect sa nu poata scana alte site-uri.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  createScanSchema,
  ruleResultFilterSchema,
  scanConfigSchema,
  type ResultCategory,
  type RuleResult,
  type RuleResultList,
  type Scan,
  type ScanList,
  type ScanSummary,
} from '@ro-a11y/shared';
import type { Database } from '../db/prisma';
import { HttpError } from '../middleware/errors';
import { validate } from '../lib/validation';
import { checkUrl, type UrlGuardOptions } from '../safety/url-guard';
import { buildTrace, CATALOG_VERSION } from '@ro-a11y/catalog';
import { isBestPractice } from '../scanner/normalize';

export interface ScansDeps {
  db: Database;
  guardOptions: UrlGuardOptions;
  /** Timpul maxim de incarcare a paginii, fixat in configuratia fiecarei scanari noi. */
  scanTimeoutMs: number;
}

const LIST_LIMIT = 50;

type ScanRow = Awaited<ReturnType<Database['scan']['findUniqueOrThrow']>>;

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function toScanDto(row: ScanRow, summary: ScanSummary | null): Scan {
  return {
    id: row.id,
    projectId: row.projectId,
    pageUrl: row.pageUrl,
    finalUrl: row.finalUrl,
    httpStatus: row.httpStatus,
    status: row.status,
    config: scanConfigSchema.parse(row.config),
    catalogVersion: row.catalogVersion,
    engineName: row.engineName,
    engineVersion: row.engineVersion,
    browserVersion: row.browserVersion,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    startedAt: iso(row.startedAt),
    finishedAt: iso(row.finishedAt),
    summary: row.status === 'completed' ? summary : null,
  };
}

/** Calculeaza sumarul (reguli si elemente pe categorii) pentru mai multe scanari odata. */
async function loadSummaries(db: Database, scanIds: string[]): Promise<Map<string, ScanSummary>> {
  const summaries = new Map<string, ScanSummary>();
  if (scanIds.length === 0) return summaries;

  const rows = await db.$queryRaw<
    Array<{ scan_id: string; category: ResultCategory; rules: bigint; elements: bigint }>
  >`
    SELECT r.scan_id, r.category, COUNT(DISTINCT r.id) AS rules, COUNT(e.id) AS elements
    FROM rule_results r
    LEFT JOIN affected_elements e ON e.rule_result_id = r.id
    WHERE r.scan_id = ANY(${scanIds})
    GROUP BY r.scan_id, r.category`;

  for (const id of scanIds) {
    summaries.set(id, {
      violations: 0,
      violationElements: 0,
      incomplete: 0,
      incompleteElements: 0,
      passes: 0,
      inapplicable: 0,
    });
  }
  for (const row of rows) {
    const s = summaries.get(row.scan_id)!;
    const rules = Number(row.rules);
    const elements = Number(row.elements);
    if (row.category === 'violation') {
      s.violations = rules;
      s.violationElements = elements;
    } else if (row.category === 'incomplete') {
      s.incomplete = rules;
      s.incompleteElements = elements;
    } else if (row.category === 'pass') {
      s.passes = rules;
    } else {
      s.inapplicable = rules;
    }
  }
  return summaries;
}

const CATEGORY_ORDER: ResultCategory[] = ['violation', 'incomplete', 'pass', 'inapplicable'];
const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor', null];

function projectNotFound() {
  return new HttpError(404, 'PROJECT_NOT_FOUND', 'Proiectul nu există.');
}
function scanNotFound() {
  return new HttpError(404, 'SCAN_NOT_FOUND', 'Scanarea nu există.');
}
function isUuid(value: string | undefined): value is string {
  return z.uuid().safeParse(value).success;
}

export function scansRouter({ db, guardOptions, scanTimeoutMs }: ScansDeps): Router {
  const router = Router();

  router.post('/api/v1/projects/:projectId/scans', async (req, res) => {
    if (!isUuid(req.params.projectId)) throw projectNotFound();
    const input = validate(createScanSchema, req.body ?? {});

    const project = await db.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) throw projectNotFound();

    const pageUrl = input.pageUrl ?? project.baseUrl;
    if (new URL(pageUrl).origin !== new URL(project.baseUrl).origin) {
      throw new HttpError(
        400,
        'PAGE_NOT_IN_PROJECT',
        `Pagina trebuie să aparțină site-ului proiectului (${new URL(project.baseUrl).origin}).`,
      );
    }

    const check = await checkUrl(pageUrl, guardOptions);
    if (!check.ok) throw new HttpError(400, 'UNSAFE_URL', check.message);

    const config = scanConfigSchema.parse({
      wcagProfile: input.wcagProfile,
      includeBestPractices: input.includeBestPractices,
      timeoutMs: scanTimeoutMs,
    });
    const scan = await db.scan.create({
      data: { projectId: project.id, pageUrl, config, catalogVersion: CATALOG_VERSION },
    });
    res.status(202).json(toScanDto(scan, null));
  });

  router.get('/api/v1/projects/:projectId/scans', async (req, res) => {
    if (!isUuid(req.params.projectId)) throw projectNotFound();
    const project = await db.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) throw projectNotFound();

    const rows = await db.scan.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    });
    const summaries = await loadSummaries(
      db,
      rows.filter((r) => r.status === 'completed').map((r) => r.id),
    );
    const body: ScanList = {
      items: rows.map((r) => toScanDto(r, summaries.get(r.id) ?? null)),
    };
    res.json(body);
  });

  router.get('/api/v1/scans/:scanId', async (req, res) => {
    if (!isUuid(req.params.scanId)) throw scanNotFound();
    const row = await db.scan.findUnique({ where: { id: req.params.scanId } });
    if (!row) throw scanNotFound();
    const summaries = await loadSummaries(db, row.status === 'completed' ? [row.id] : []);
    res.json(toScanDto(row, summaries.get(row.id) ?? null));
  });

  //endpoint care returneaza rezultatele scanarii
  router.get('/api/v1/scans/:scanId/results', async (req, res) => {
    //partea de validare (ca cererea este ok, scanId e valid, scan exista)
    //Uuid = identificator unic universal (unice la nivel mondial folosim pentru securitate)
    if (!isUuid(req.params.scanId)) throw scanNotFound();
    const filter = validate(ruleResultFilterSchema, req.query);
    const scan = await db.scan.findUnique({ where: { id: req.params.scanId } });
    if (!scan) throw scanNotFound();

    //mergem in tabelul rule_result si extragem din el datele
    const rows = await db.ruleResult.findMany({
      where: { scanId: scan.id, ...(filter.category ? { category: filter.category } : {}) },
      include: { affectedElements: true },
    });

    //sortam rezultatele in ordinea corecta (categorie, impact, axeRuleId)
    rows.sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        IMPACT_ORDER.indexOf(a.impact) - IMPACT_ORDER.indexOf(b.impact) ||
        a.axeRuleId.localeCompare(b.axeRuleId),
    );

    //mapam rezultatele in formatul corect (RuleResult) ce e cu r e din baza de date, ce e fara r e ce vom returna catre frontend
    const items: RuleResult[] = rows.map((r) => ({
      id: r.id,
      axeRuleId: r.axeRuleId,
      category: r.category,
      impact: r.impact,
      title: r.title,
      description: r.description,
      docsUrl: r.docsUrl,
      axeTags: r.axeTags,
      wcagCriteria: r.wcagCriteria,
      isBestPractice: isBestPractice(r.axeTags, r.wcagCriteria),
      // apelam buildTrace cu acesti parametrii
      trace: buildTrace({
        axeRuleId: r.axeRuleId,
        axeTags: r.axeTags,
        wcagCriteria: r.wcagCriteria,
        docsUrl: r.docsUrl,
        engineVersion: scan.engineVersion,
      }),
      affectedElements: r.affectedElements.map((e) => ({
        id: e.id,
        cssSelector: e.cssSelector,
        htmlSnippet: e.htmlSnippet,
        failureSummary: e.failureSummary,
        fingerprint: e.fingerprint,
      })),
    }));
    const body: RuleResultList = { items };
    res.json(body);
  });

  return router;
}
