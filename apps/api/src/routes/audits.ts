/**
 * Rutele pentru auditurile pe mai multe pagini:
 *
 * - POST /api/v1/projects/:projectId/audits — porneste un audit: worker-ul cauta paginile
 *   site-ului (raspunde 202; descoperirea ruleaza separat)
 * - GET  /api/v1/projects/:projectId/audits — auditurile proiectului, cele mai noi primele
 * - GET  /api/v1/audits/:auditId            — un audit: starea, paginile gasite si propuse,
 *                                             progresul scanarii paginilor alese
 * - POST /api/v1/audits/:auditId/selection  — confirma paginile alese; fiecare devine o
 *                                             scanare obisnuita, pusa in coada
 * - GET  /api/v1/audits/:auditId/results    — rezultatele adunate de pe toate paginile:
 *                                             reguli (pe cate pagini apar) si probleme comune
 *                                             (acelasi element cu aceeasi problema pe mai multe pagini)
 *
 * Starea "completed" a unui audit nu e salvata: e calculata din starea paginilor, deci nu
 * poate ramane gresita (ex. daca o scanare e marcata esuata de worker dupa o oprire brusca).
 */
import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import {
  AUDIT_DEFAULT_PAGES,
  auditSelectionSchema,
  createAuditSchema,
  discoverySchema,
  scanConfigSchema,
  type Audit,
  type AuditList,
  type AuditPage,
  type AuditProgress,
  type AuditResults,
  type AuditRule,
  type AuditStatus,
  type CommonIssue,
  type DiscoveredPage,
  type Impact,
} from '@ro-a11y/shared';
import { CATALOG_VERSION, remediationFor } from '@ro-a11y/catalog';
import type { Database } from '../db/prisma';
import { HttpError } from '../middleware/errors';
import { validate } from '../lib/validation';
import { checkUrl, type UrlGuardOptions } from '../safety/url-guard';
import { classifyLink, dedupeKey, scopeFor } from '../discovery/links';
import { isBestPractice } from '../scanner/normalize';
import { loadSummaries } from './scans';

export interface AuditsDeps {
  db: Database;
  guardOptions: UrlGuardOptions;
  scanTimeoutMs: number;
}

const LIST_LIMIT = 50;
const IMPACT_ORDER: Array<Impact | null> = ['critical', 'serious', 'moderate', 'minor', null];

type AuditRow = Awaited<ReturnType<Database['audit']['findUniqueOrThrow']>>;
type ScanRow = Awaited<ReturnType<Database['scan']['findUniqueOrThrow']>>;

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function auditNotFound() {
  return new HttpError(404, 'AUDIT_NOT_FOUND', 'Auditul nu există.');
}
function projectNotFound() {
  return new HttpError(404, 'PROJECT_NOT_FOUND', 'Proiectul nu există.');
}
function isUuid(value: string | undefined): value is string {
  return z.uuid().safeParse(value).success;
}

/** Cate pagini sunt gata, cate au esuat si cate sunt in total. */
function progressOf(scans: Pick<ScanRow, 'status'>[]): AuditProgress {
  return {
    total: scans.length,
    completed: scans.filter((s) => s.status === 'completed').length,
    failed: scans.filter((s) => s.status === 'failed').length,
  };
}

/** Starea afisata: "scanning" devine "completed" cand nicio pagina nu mai asteapta. */
function statusOf(row: AuditRow, scans: Pick<ScanRow, 'status'>[]): AuditStatus {
  if (row.status !== 'scanning') return row.status;
  const pending = scans.some((s) => s.status === 'queued' || s.status === 'running');
  return pending ? 'scanning' : 'completed';
}

function parseDiscovery(row: AuditRow) {
  return row.discovery ? discoverySchema.parse(row.discovery) : null;
}

async function loadAuditDto(db: Database, row: AuditRow): Promise<Audit> {
  const scans = await db.scan.findMany({
    where: { auditId: row.id },
    orderBy: { createdAt: 'asc' },
  });
  const summaries = await loadSummaries(
    db,
    scans.filter((s) => s.status === 'completed').map((s) => s.id),
  );
  const discovery = parseDiscovery(row);
  const pageInfo = new Map(discovery?.pages.map((p) => [dedupeKey(p.url), p]) ?? []);
  const status = statusOf(row, scans);

  const pages: AuditPage[] = scans.map((scan) => {
    const info = pageInfo.get(dedupeKey(scan.pageUrl));
    return {
      scanId: scan.id,
      pageUrl: scan.pageUrl,
      label: info?.label ?? null,
      reasons: info?.reasons ?? [],
      robotsBlocked: info?.robotsBlocked ?? false,
      status: scan.status,
      errorMessage: scan.errorMessage,
      summary: scan.status === 'completed' ? (summaries.get(scan.id) ?? null) : null,
    };
  });

  const finishedTimes = scans.map((s) => s.finishedAt?.getTime() ?? 0);
  return {
    id: row.id,
    projectId: row.projectId,
    startUrl: row.startUrl,
    maxPages: row.maxPages,
    status,
    config: scanConfigSchema.parse(row.config),
    catalogVersion: row.catalogVersion,
    discovery,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    discoveredAt: iso(row.discoveredAt),
    selectedAt: iso(row.selectedAt),
    finishedAt:
      status === 'completed' && scans.length > 0
        ? new Date(Math.max(...finishedTimes)).toISOString()
        : null,
    progress: progressOf(scans),
    pages,
  };
}

/** Aduna rezultatele paginilor: reguli pe pagini si probleme comune. */
async function loadAuditResults(db: Database, auditId: string): Promise<AuditResults> {
  const scans = await db.scan.findMany({
    where: { auditId, status: 'completed' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, pageUrl: true },
  });
  const pageUrlOf = new Map(scans.map((s) => [s.id, s.pageUrl]));
  const rows = await db.ruleResult.findMany({
    where: {
      scanId: { in: scans.map((s) => s.id) },
      category: { in: ['violation', 'incomplete'] },
    },
    include: { affectedElements: true },
  });

  const rules = new Map<string, AuditRule>();
  const common = new Map<string, CommonIssue>();
  const worse = (a: Impact | null, b: Impact | null) =>
    IMPACT_ORDER.indexOf(a) <= IMPACT_ORDER.indexOf(b) ? a : b;

  for (const row of rows) {
    const category = row.category as 'violation' | 'incomplete';
    const pageUrl = pageUrlOf.get(row.scanId)!;
    const titleRo = remediationFor(row.axeRuleId)?.titleRo ?? null;

    const ruleKey = `${row.axeRuleId}|${category}`;
    const rule = rules.get(ruleKey) ?? {
      axeRuleId: row.axeRuleId,
      category,
      impact: row.impact,
      title: row.title,
      titleRo,
      isBestPractice: isBestPractice(row.axeTags, row.wcagCriteria),
      wcagCriteria: row.wcagCriteria,
      elementCount: 0,
      pages: [],
    };
    rule.impact = worse(rule.impact, row.impact);
    rule.elementCount += row.affectedElements.length;
    rule.pages.push({ scanId: row.scanId, pageUrl, elementCount: row.affectedElements.length });
    rules.set(ruleKey, rule);

    // Acelasi element (acelasi selector si acelasi cod HTML) cu aceeasi problema
    for (const element of row.affectedElements) {
      const key = createHash('sha256')
        .update(
          `${row.axeRuleId}|${category}|${JSON.stringify(element.cssSelector)}|${element.htmlSnippet}`,
        )
        .digest('hex')
        .slice(0, 16);
      const issue = common.get(key) ?? {
        key,
        axeRuleId: row.axeRuleId,
        category,
        impact: row.impact,
        title: row.title,
        titleRo,
        htmlSnippet: element.htmlSnippet,
        cssSelector: element.cssSelector,
        pages: [],
      };
      if (!issue.pages.some((p) => p.scanId === row.scanId)) {
        issue.pages.push({ scanId: row.scanId, pageUrl });
      }
      common.set(key, issue);
    }
  }

  const byImpactThenId = <T extends { impact: Impact | null; axeRuleId: string }>(a: T, b: T) =>
    IMPACT_ORDER.indexOf(a.impact) - IMPACT_ORDER.indexOf(b.impact) ||
    a.axeRuleId.localeCompare(b.axeRuleId);

  return {
    pagesScanned: scans.length,
    rules: [...rules.values()].sort(
      (a, b) =>
        Number(a.category === 'incomplete') - Number(b.category === 'incomplete') ||
        b.pages.length - a.pages.length ||
        byImpactThenId(a, b),
    ),
    commonIssues: [...common.values()]
      .filter((issue) => issue.pages.length >= 2)
      .sort((a, b) => b.pages.length - a.pages.length || byImpactThenId(a, b)),
  };
}

export function auditsRouter({ db, guardOptions, scanTimeoutMs }: AuditsDeps): Router {
  const router = Router();

  router.post('/api/v1/projects/:projectId/audits', async (req, res) => {
    if (!isUuid(req.params.projectId)) throw projectNotFound();
    const input = validate(createAuditSchema, req.body ?? {});
    const project = await db.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) throw projectNotFound();

    const startUrl = input.startUrl ?? project.baseUrl;
    if (new URL(startUrl).origin !== new URL(project.baseUrl).origin) {
      throw new HttpError(
        400,
        'PAGE_NOT_IN_PROJECT',
        `Pagina trebuie să aparțină site-ului proiectului (${new URL(project.baseUrl).origin}).`,
      );
    }
    const check = await checkUrl(startUrl, guardOptions);
    if (!check.ok) throw new HttpError(400, 'UNSAFE_URL', check.message);

    const config = scanConfigSchema.parse({
      wcagProfile: input.wcagProfile,
      includeBestPractices: input.includeBestPractices,
      timeoutMs: scanTimeoutMs,
    });
    const row = await db.audit.create({
      data: {
        projectId: project.id,
        startUrl,
        maxPages: input.maxPages ?? AUDIT_DEFAULT_PAGES,
        config,
        catalogVersion: CATALOG_VERSION,
      },
    });
    res.status(202).json(await loadAuditDto(db, row));
  });

  router.get('/api/v1/projects/:projectId/audits', async (req, res) => {
    if (!isUuid(req.params.projectId)) throw projectNotFound();
    const project = await db.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) throw projectNotFound();

    const rows = await db.audit.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
      include: { scans: { select: { status: true } } },
    });
    const body: AuditList = {
      items: rows.map((row) => ({
        id: row.id,
        startUrl: row.startUrl,
        status: statusOf(row, row.scans),
        createdAt: row.createdAt.toISOString(),
        pagesFound: parseDiscovery(row)?.pages.length ?? null,
        progress: progressOf(row.scans),
      })),
    };
    res.json(body);
  });

  router.get('/api/v1/audits/:auditId', async (req, res) => {
    if (!isUuid(req.params.auditId)) throw auditNotFound();
    const row = await db.audit.findUnique({ where: { id: req.params.auditId } });
    if (!row) throw auditNotFound();
    res.json(await loadAuditDto(db, row));
  });

  router.post('/api/v1/audits/:auditId/selection', async (req, res) => {
    if (!isUuid(req.params.auditId)) throw auditNotFound();
    const input = validate(auditSelectionSchema, req.body ?? {});
    const row = await db.audit.findUnique({ where: { id: req.params.auditId } });
    if (!row) throw auditNotFound();
    const discovery = parseDiscovery(row);
    if (row.status !== 'awaiting_selection' || !discovery) {
      throw new HttpError(
        409,
        'AUDIT_NOT_AWAITING_SELECTION',
        'Paginile acestui audit au fost deja alese sau nu au fost încă găsite.',
      );
    }

    // Fiecare pagina trebuie sa fie din sectiunea auditata si sa treaca de paznic
    const scope = scopeFor(discovery.finalUrl);
    const known = new Map(discovery.pages.map((p) => [dedupeKey(p.url), p]));
    const chosen: string[] = [];
    const seen = new Set<string>();
    for (const [index, url] of input.urls.entries()) {
      const key = dedupeKey(url);
      if (seen.has(key)) continue;
      seen.add(key);
      const knownPage = known.get(key);
      if (knownPage) {
        chosen.push(knownPage.url);
        continue;
      }
      const result = classifyLink(url, scope, discovery.finalUrl);
      const message =
        result.kind === 'page'
          ? null
          : result.kind === 'document'
            ? 'Documentele (PDF, Word, Excel) nu pot fi verificate automat.'
            : `Pagina trebuie să fie de pe site-ul auditat (${discovery.scope}).`;
      if (message) {
        throw new HttpError(400, 'PAGE_NOT_IN_AUDIT', message, [
          { field: `urls.${index}`, message },
        ]);
      }
      const check = await checkUrl(url, guardOptions);
      if (!check.ok) {
        throw new HttpError(400, 'UNSAFE_URL', check.message, [
          { field: `urls.${index}`, message: check.message },
        ]);
      }
      chosen.push(result.kind === 'page' ? result.url : url);
    }

    // Paginile alese (si cele adaugate manual) sunt notate in rezultatul descoperirii
    const chosenKeys = new Set(chosen.map(dedupeKey));
    // O pagina gasita, dar nepropusa automat, aleasa de utilizator are motivul "manual"
    const pages: DiscoveredPage[] = discovery.pages.map((p) => {
      const selected = chosenKeys.has(dedupeKey(p.url));
      return {
        ...p,
        selected,
        reasons: selected && p.reasons.length === 0 ? ['manual'] : p.reasons,
      };
    });
    for (const url of chosen) {
      if (!known.has(dedupeKey(url))) {
        pages.push({
          url,
          label: url,
          section: null,
          region: 'other',
          proposed: false,
          selected: true,
          robotsBlocked: false,
          reasons: ['manual'],
        });
      }
    }

    const config = scanConfigSchema.parse(row.config);
    const base = Date.now();
    await db.$transaction(async (tx) => {
      // Doar un audit inca "awaiting_selection": doua confirmari simultane nu dubleaza paginile
      const updated = await tx.audit.updateMany({
        where: { id: row.id, status: 'awaiting_selection' },
        data: {
          status: 'scanning',
          selectedAt: new Date(),
          discovery: { ...discovery, pages } as unknown as object,
        },
      });
      if (updated.count === 0) {
        throw new HttpError(
          409,
          'AUDIT_NOT_AWAITING_SELECTION',
          'Paginile acestui audit au fost deja alese.',
        );
      }
      // Ora de creare creste cu 1 ms de la o pagina la alta: coada le ia in ordinea aleasa
      await tx.scan.createMany({
        data: chosen.map((pageUrl, index) => ({
          projectId: row.projectId,
          auditId: row.id,
          pageUrl,
          config,
          catalogVersion: row.catalogVersion,
          createdAt: new Date(base + index),
        })),
      });
    });

    const fresh = await db.audit.findUniqueOrThrow({ where: { id: row.id } });
    res.json(await loadAuditDto(db, fresh));
  });

  router.get('/api/v1/audits/:auditId/results', async (req, res) => {
    if (!isUuid(req.params.auditId)) throw auditNotFound();
    const row = await db.audit.findUnique({ where: { id: req.params.auditId } });
    if (!row) throw auditNotFound();
    res.json(await loadAuditResults(db, row.id));
  });

  return router;
}
