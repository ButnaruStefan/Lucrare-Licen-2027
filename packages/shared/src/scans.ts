/**
 * Contractul pentru scanari si rezultatele lor.
 *
 * - `scanConfigSchema`: configuratia fixata la crearea unei scanari (ca rezultatele sa fie
 *   reproductibile si comparabile intre ele).
 * - `createScanSchema`: ce poate trimite utilizatorul cand porneste o scanare.
 * - `scanSchema`: o scanare, asa cum o returneaza API-ul (stare, versiuni, sumar).
 * - `ruleResultSchema`: rezultatul unei reguli axe, cu elementele afectate din pagina.
 * - `scanChecksSchema`: ce verifica o scanare: accesibilitatea (axe-core, criterii WCAG),
 *   aspectul paginii (cum se aranjeaza pe ecrane de latimi diferite) sau ambele.
 */
import { z } from 'zod';
import { projectUrlSchema } from './projects';
import { traceSchema } from './traceability';
import { manualSummarySchema } from './manual';

export const WCAG_PROFILES = ['WCAG_2_1_AA', 'WCAG_2_2_AA'] as const;
export type WcagProfile = (typeof WCAG_PROFILES)[number];

/**
 * Ce verifica o scanare. Cele doua verificari sunt complet separate: aspectul paginii nu are
 * legatura cu WCAG sau cu legislatia. Cel putin una trebuie aleasa.
 */
export const scanChecksSchema = z
  .object({
    /** Accesibilitatea: regulile axe-core (criterii WCAG), harta problemelor, trasabilitatea. */
    accessibility: z.boolean(),
    /** Aspectul paginii: responsive, breakpoint-uri, elemente suprapuse sau taiate. */
    layout: z.boolean(),
  })
  .refine((checks) => checks.accessibility || checks.layout, {
    message: 'Alege cel puțin o verificare: accesibilitatea sau aspectul paginii.',
  });
export type ScanChecks = z.infer<typeof scanChecksSchema>;

/** Scanarile vechi (dinainte de alegerea verificarilor) au verificat doar accesibilitatea. */
export const DEFAULT_SCAN_CHECKS: ScanChecks = { accessibility: true, layout: false };

export const scanConfigSchema = z.object({
  checks: scanChecksSchema.default(DEFAULT_SCAN_CHECKS),
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
  /** Ce se verifica; daca lipseste, doar accesibilitatea. */
  checks: scanChecksSchema.optional(),
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

/** Pozitia unui element in captura paginii, in pixeli CSS, fata de coltul paginii. */
export const elementBoxSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
});
export type ElementBox = z.infer<typeof elementBoxSchema>;

/** Captura paginii scanate (harta problemelor): dimensiunile si adresa imaginii. */
export const screenshotInfoSchema = z.object({
  /** Adresa imaginii, ex. /api/v1/scans/{id}/screenshot. */
  url: z.string(),
  format: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  /** Inaltimea reala a paginii; mai mare decat height daca pagina a fost taiata. */
  pageHeight: z.number().int(),
  truncated: z.boolean(),
  /**
   * Captura facuta ecran cu ecran: inaltimea unui ecran (ecranele sunt unul sub altul in imagine)
   * si derularea la care a fost fotografiat fiecare. null / [] = o singura imagine a paginii.
   */
  frameHeight: z.number().int().nullable(),
  frameOffsets: z.array(z.number().int()),
});
export type ScreenshotInfo = z.infer<typeof screenshotInfoSchema>;

/**
 * Sumarul verificarii aspectului: cate semnale, pe niveluri. `failed` = verificarea nu s-a
 * putut face (scanarea ramane valida).
 */
export const layoutSummarySchema = z.object({
  visible: z.number().int(),
  possible: z.number().int(),
  info: z.number().int(),
  failed: z.boolean(),
});
export type LayoutSummary = z.infer<typeof layoutSummarySchema>;

export const scanSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  /** Auditul din care face parte pagina (null = scanare separata). */
  auditId: z.string().nullable(),
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
  /**
   * Captura paginii, la citirea unei scanari (GET /scans/:id). null daca nu exista (scanare
   * esuata, captura nereusita) si in listele de scanari (ca raspunsul sa ramana mic).
   */
  screenshot: screenshotInfoSchema.nullable(),
  /** Sumarul verificarii aspectului; null daca nu a fost ceruta sau scanarea nu e gata. */
  layout: layoutSummarySchema.nullable(),
  /**
   * Progresul verificarii manuale (facuta de om); null daca scanarea nu verifica
   * accesibilitatea sau nu e gata.
   */
  manual: manualSummarySchema.nullable(),
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
  /** Pozitia in captura paginii; null = elementul nu se vede in captura sau nu exista captura. */
  box: elementBoxSchema.nullable(),
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
