/**
 * Rutele pentru scanari:
 *
 * - POST /api/v1/projects/:projectId/scans  — cere o scanare noua; raspunde 202 (Accepted):
 *   scanarea intra in coada, iar worker-ul o va procesa separat
 * - GET  /api/v1/projects/:projectId/scans  — scanarile separate ale unui proiect, cele mai noi
 *                                             primele (paginile unui audit apar in audit)
 * - GET  /api/v1/scans/:scanId              — o scanare: stare, configuratie, versiuni, sumar,
 *                                             dimensiunile capturii paginii
 * - GET  /api/v1/scans/:scanId/screenshot   — captura paginii (imagine WebP), pentru harta
 *                                             problemelor; 404 daca scanarea nu are captura
 * - GET  /api/v1/scans/:scanId/layout       — verificarea aspectului paginii (separata de WCAG):
 *                                             latimile verificate, breakpoint-urile, semnalele;
 *                                             404 daca nu a fost ceruta
 * - GET  /api/v1/scans/:scanId/layout/issues/:issueId/image — captura decupata a unui semnal
 * - GET  /api/v1/scans/:scanId/results      — rezultatele pe reguli, cu elementele afectate si
 *                                             lantul de trasabilitate (WCAG -> EN -> OUG 112/2018,
 *                                             cu aplicabilitatea din profilul juridic al proiectului)
 *                                             (filtru optional: ?category=violation)
 *
 * Inainte de a crea scanarea, adresa trece prin paznic (protectie SSRF) si trebuie sa apartina
 * site-ului proiectului (aceeasi origine), ca un proiect sa nu poata scana alte site-uri.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  breakpointSchema,
  createScanSchema,
  elementBoxSchema,
  layoutDetailsSchema,
  layoutElementSchema,
  legalAssessmentSchema,
  LAYOUT_ISSUE_KINDS,
  LAYOUT_LEVELS,
  ruleResultFilterSchema,
  scanConfigSchema,
  type ResultCategory,
  type LayoutSummary,
  type RuleResult,
  type RuleResultList,
  type Scan,
  type ScanLayout,
  type ScanList,
  type ScanSummary,
  type ScreenshotInfo,
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

/** Tipul imaginii, dupa formatul salvat. */
const IMAGE_TYPES: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpeg: 'image/jpeg',
};

/** Captura nu se mai schimba niciodata dupa scanare: browserul o poate tine minte. */
const SCREENSHOT_CACHE = 'private, max-age=31536000, immutable';

function toScanDto(
  row: ScanRow,
  summary: ScanSummary | null,
  screenshot: ScreenshotInfo | null = null,
  layout: LayoutSummary | null = null,
): Scan {
  return {
    id: row.id,
    projectId: row.projectId,
    auditId: row.auditId,
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
    screenshot: row.status === 'completed' ? screenshot : null,
    layout: row.status === 'completed' ? layout : null,
  };
}

/**
 * Sumarul verificarii aspectului (cate semnale, pe niveluri) pentru mai multe scanari odata.
 * O scanare fara verificarea aspectului nu apare in rezultat.
 */
export async function loadLayoutSummaries(
  db: Database,
  scanIds: string[],
): Promise<Map<string, LayoutSummary>> {
  const result = new Map<string, LayoutSummary>();
  if (scanIds.length === 0) return result;
  const layouts = await db.scanLayout.findMany({
    where: { scanId: { in: scanIds } },
    select: { scanId: true, error: true },
  });
  for (const l of layouts) {
    result.set(l.scanId, { visible: 0, possible: 0, info: 0, failed: l.error !== null });
  }
  const counts = await db.layoutIssue.groupBy({
    by: ['scanId', 'level'],
    where: { scanId: { in: scanIds } },
    _count: { _all: true },
  });
  for (const c of counts) {
    const summary = result.get(c.scanId);
    if (summary && (c.level === 'visible' || c.level === 'possible' || c.level === 'info')) {
      summary[c.level] = c._count._all;
    }
  }
  return result;
}

/** Calculeaza sumarul (reguli si elemente pe categorii) pentru mai multe scanari odata. */
export async function loadSummaries(
  db: Database,
  scanIds: string[],
): Promise<Map<string, ScanSummary>> {
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
function imageNotFound() {
  return new HttpError(404, 'IMAGE_NOT_FOUND', 'Semnalul nu are o captură.');
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
      checks: input.checks,
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
      where: { projectId: project.id, auditId: null },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    });
    const completed = rows.filter((r) => r.status === 'completed').map((r) => r.id);
    const summaries = await loadSummaries(db, completed);
    const layouts = await loadLayoutSummaries(db, completed);
    const body: ScanList = {
      items: rows.map((r) =>
        toScanDto(r, summaries.get(r.id) ?? null, null, layouts.get(r.id) ?? null),
      ),
    };
    res.json(body);
  });

  router.get('/api/v1/scans/:scanId', async (req, res) => {
    if (!isUuid(req.params.scanId)) throw scanNotFound();
    const row = await db.scan.findUnique({ where: { id: req.params.scanId } });
    if (!row) throw scanNotFound();
    const done = row.status === 'completed' ? [row.id] : [];
    const summaries = await loadSummaries(db, done);
    const layouts = await loadLayoutSummaries(db, done);
    // Doar dimensiunile capturii, nu si imaginea (ea vine pe ruta separata)
    const shot = await db.scanScreenshot.findUnique({
      where: { scanId: row.id },
      select: {
        format: true,
        width: true,
        height: true,
        pageHeight: true,
        truncated: true,
        frameHeight: true,
        frameOffsets: true,
      },
    });
    const screenshot = shot ? { url: `/api/v1/scans/${row.id}/screenshot`, ...shot } : null;
    res.json(
      toScanDto(row, summaries.get(row.id) ?? null, screenshot, layouts.get(row.id) ?? null),
    );
  });

  router.get('/api/v1/scans/:scanId/layout', async (req, res) => {
    if (!isUuid(req.params.scanId)) throw scanNotFound();
    const layout = await db.scanLayout.findUnique({
      where: { scanId: req.params.scanId },
      include: {
        // Fara imagini (vin pe ruta separata); doar daca exista una si cat de mare e
        issues: {
          omit: { image: true },
          orderBy: [{ level: 'desc' }, { widthMax: 'desc' }],
        },
      },
    });
    if (!layout) {
      throw new HttpError(
        404,
        'LAYOUT_NOT_FOUND',
        'Scanarea nu are o verificare a aspectului paginii.',
      );
    }
    const levelOrder = (level: string) => LAYOUT_LEVELS.indexOf(level as never);
    const issues = [...layout.issues].sort(
      (a, b) =>
        levelOrder(a.level) - levelOrder(b.level) ||
        (b.widthMax ?? Infinity) - (a.widthMax ?? Infinity),
    );
    const body: ScanLayout = {
      widths: layout.widths,
      breakpoints: z.array(breakpointSchema).parse(layout.breakpoints),
      metaViewport: layout.metaViewport,
      durationMs: layout.durationMs,
      partial: layout.partial,
      error: layout.error,
      issues: issues
        .filter((i) => (LAYOUT_ISSUE_KINDS as readonly string[]).includes(i.kind))
        .map((i) => ({
          id: i.id,
          kind: i.kind as ScanLayout['issues'][number]['kind'],
          level: i.level as ScanLayout['issues'][number]['level'],
          widthMin: i.widthMin,
          widthMax: i.widthMax,
          elements: z.array(layoutElementSchema).parse(i.elements),
          details: layoutDetailsSchema.parse(i.details),
          image:
            i.imageFormat && i.imageWidth && i.imageHeight && i.imageViewport
              ? {
                  url: `/api/v1/scans/${layout.scanId}/layout/issues/${i.id}/image`,
                  width: i.imageWidth,
                  height: i.imageHeight,
                  viewportWidth: i.imageViewport,
                }
              : null,
          boxes: z.array(elementBoxSchema).parse(i.boxes),
        })),
    };
    res.json(body);
  });

  router.get('/api/v1/scans/:scanId/layout/issues/:issueId/image', async (req, res) => {
    if (!isUuid(req.params.scanId) || !isUuid(req.params.issueId)) throw imageNotFound();
    const issue = await db.layoutIssue.findFirst({
      where: { id: req.params.issueId, scanId: req.params.scanId },
      select: { image: true, imageFormat: true },
    });
    if (!issue?.image || !issue.imageFormat) throw imageNotFound();
    res
      .type(IMAGE_TYPES[issue.imageFormat] ?? 'application/octet-stream')
      .set('Cache-Control', SCREENSHOT_CACHE)
      .set('X-Content-Type-Options', 'nosniff')
      .send(Buffer.from(issue.image));
  });

  router.get('/api/v1/scans/:scanId/screenshot', async (req, res) => {
    if (!isUuid(req.params.scanId)) throw scanNotFound();
    const shot = await db.scanScreenshot.findUnique({
      where: { scanId: req.params.scanId },
      select: { image: true, format: true },
    });
    if (!shot) {
      throw new HttpError(404, 'SCREENSHOT_NOT_FOUND', 'Scanarea nu are o captură a paginii.');
    }
    res
      .type(IMAGE_TYPES[shot.format] ?? 'application/octet-stream')
      .set('Cache-Control', SCREENSHOT_CACHE)
      .set('X-Content-Type-Options', 'nosniff')
      .send(Buffer.from(shot.image));
  });

  //endpoint care returneaza rezultatele scanarii
  router.get('/api/v1/scans/:scanId/results', async (req, res) => {
    //partea de validare (ca cererea este ok, scanId e valid, scan exista)
    //Uuid = identificator unic universal (unice la nivel mondial folosim pentru securitate)
    if (!isUuid(req.params.scanId)) throw scanNotFound();
    const filter = validate(ruleResultFilterSchema, req.query);
    const scan = await db.scan.findUnique({ where: { id: req.params.scanId } });
    if (!scan) throw scanNotFound();

    // Profilul juridic al proiectului decide pasul "Aplicabilitate" din lantul de trasabilitate
    const legalProfile = await db.legalProfile.findUnique({ where: { projectId: scan.projectId } });
    const legalAssessment = legalProfile
      ? {
          assessment: legalAssessmentSchema.parse(legalProfile.assessment),
          assessedAt: legalProfile.updatedAt.toISOString(),
        }
      : null;

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
        legalAssessment,
        // Remedierea completa doar unde e ceva de reparat sau de verificat (raspuns mai mic)
        includeRemediation: r.category === 'violation' || r.category === 'incomplete',
      }),
      affectedElements: r.affectedElements.map((e) => ({
        id: e.id,
        cssSelector: e.cssSelector,
        htmlSnippet: e.htmlSnippet,
        failureSummary: e.failureSummary,
        fingerprint: e.fingerprint,
        box:
          e.boxX !== null && e.boxY !== null && e.boxWidth !== null && e.boxHeight !== null
            ? { x: e.boxX, y: e.boxY, width: e.boxWidth, height: e.boxHeight }
            : null,
      })),
    }));
    const body: RuleResultList = { items };
    res.json(body);
  });

  return router;
}
