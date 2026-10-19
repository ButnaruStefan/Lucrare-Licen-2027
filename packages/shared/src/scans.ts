/**
 * Contractul pentru scanari si rezultatele lor.
 *
 * - `scanConfigSchema`: configuratia fixata la crearea unei scanari (ca rezultatele sa fie
 *   reproductibile si comparabile intre ele).
 * - `createScanSchema`: ce poate trimite utilizatorul cand porneste o scanare.
 * - `scanSchema`: o scanare, asa cum o returneaza API-ul (stare, versiuni, sumar).
 * - `ruleResultSchema`: rezultatul unei reguli axe, cu elementele afectate din pagina.
 */
import { z } from 'zod';
import { projectUrlSchema } from './projects';
import { traceSchema } from './traceability';

export const WCAG_PROFILES = ['WCAG_2_1_AA', 'WCAG_2_2_AA'] as const;
export type WcagProfile = (typeof WCAG_PROFILES)[number];

export const scanConfigSchema = z.object({
  wcagProfile: z.enum(WCAG_PROFILES).default('WCAG_2_2_AA'),
  /** Include si regulile de "bune practici" (nu sunt criterii WCAG obligatorii). */
  includeBestPractices: z.boolean().default(true),
  viewport: z
    .object({
      width: z.number().int().min(320).max(3840),
      height: z.number().int().min(320).max(2160),
    })
    .default({ width: 1366, height: 768 }),
  locale: z.string().default('ro-RO'),
  /** Timpul maxim pentru incarcarea paginii, in milisecunde. */
  timeoutMs: z.number().int().min(1000).max(120_000).default(30_000),
  /** Cat asteptam dupa incarcare, ca scripturile paginii sa termine de desenat continutul. */
  settleMs: z.number().int().min(0).max(10_000).default(500),
});
export type ScanConfig = z.infer<typeof scanConfigSchema>;

export const createScanSchema = z.object({
  /** Pagina de scanat; daca lipseste, se scaneaza adresa de baza a proiectului. */
  pageUrl: projectUrlSchema.optional(),
  wcagProfile: z.enum(WCAG_PROFILES).optional(),
  includeBestPractices: z.boolean().optional(),
});
export type CreateScanInput = z.input<typeof createScanSchema>;

export const SCAN_STATUSES = ['queued', 'running', 'completed', 'failed'] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export const RESULT_CATEGORIES = ['violation', 'incomplete', 'pass', 'inapplicable'] as const;
export type ResultCategory = (typeof RESULT_CATEGORIES)[number];

export const IMPACTS = ['minor', 'moderate', 'serious', 'critical'] as const;
export type Impact = (typeof IMPACTS)[number];

/** Sumarul unei scanari terminate: cate reguli si cate elemente, pe fiecare categorie. */
export const scanSummarySchema = z.object({
  violations: z.number().int(),
  violationElements: z.number().int(),
  incomplete: z.number().int(),
  incompleteElements: z.number().int(),
  passes: z.number().int(),
  inapplicable: z.number().int(),
});
export type ScanSummary = z.infer<typeof scanSummarySchema>;

export const scanSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  pageUrl: z.string(),
  finalUrl: z.string().nullable(),
  httpStatus: z.number().int().nullable(),
  status: z.enum(SCAN_STATUSES),
  config: scanConfigSchema,
  /** Versiunea catalogului normativ (WCAG, EN 301 549, legislatie) fixata la crearea scanarii. */
  catalogVersion: z.string().nullable(),
  engineName: z.string().nullable(),
  engineVersion: z.string().nullable(),
  browserVersion: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  /** Prezent doar pentru scanarile terminate cu succes. */
  summary: scanSummarySchema.nullable(),
});
export type Scan = z.infer<typeof scanSchema>;

export const scanListSchema = z.object({ items: z.array(scanSchema) });
export type ScanList = z.infer<typeof scanListSchema>;

export const affectedElementSchema = z.object({
  id: z.string(),
  cssSelector: z.unknown(),
  htmlSnippet: z.string(),
  failureSummary: z.string().nullable(),
  fingerprint: z.string(),
});
export type AffectedElement = z.infer<typeof affectedElementSchema>;

export const ruleResultSchema = z.object({
  id: z.string(),
  axeRuleId: z.string(),
  category: z.enum(RESULT_CATEGORIES),
  impact: z.enum(IMPACTS).nullable(),
  title: z.string(),
  description: z.string(),
  docsUrl: z.string(),
  axeTags: z.array(z.string()),
  wcagCriteria: z.array(z.string()),
  isBestPractice: z.boolean(),
  affectedElements: z.array(affectedElementSchema),
  /** Lantul de trasabilitate: WCAG -> EN 301 549 -> OUG 112/2018, plus remedierea in romana. */
  trace: traceSchema,
});
export type RuleResult = z.infer<typeof ruleResultSchema>;

export const ruleResultListSchema = z.object({ items: z.array(ruleResultSchema) });
export type RuleResultList = z.infer<typeof ruleResultListSchema>;

export const ruleResultFilterSchema = z.object({
  category: z.enum(RESULT_CATEGORIES).optional(),
});
