/**
 * Contractul pentru auditurile pe mai multe pagini ale aceluiasi site.
 *
 * Un audit are trei etape:
 *   1. descoperirea: worker-ul deschide pagina de start si gaseste paginile site-ului
 *      (`discoverySchema`: pagini candidate, servicii externe, documente, ce a fost exclus si de ce);
 *   2. selectia: aplicatia propune un esantion, iar utilizatorul il confirma sau il modifica
 *      (`auditSelectionSchema`);
 *   3. scanarea: fiecare pagina aleasa devine o scanare obisnuita; rezultatele se aduna pe
 *      tot site-ul (`auditResultsSchema`: reguli pe pagini si probleme comune).
 *
 * Folosit de API (validare si raspunsuri) si de interfata (afisare).
 */
import { z } from 'zod';
import { projectUrlSchema } from './projects';
import {
  IMPACTS,
  SCAN_STATUSES,
  WCAG_PROFILES,
  scanConfigSchema,
  scanSummarySchema,
} from './scans';

/** Cate pagini propunem implicit si cate pot fi scanate, cel mult, intr-un audit. */
export const AUDIT_DEFAULT_PAGES = 10;
export const AUDIT_MAX_PAGES = 20;

/**
 * Starea unui audit. "completed" nu e salvata in baza de date: se calculeaza din starea
 * paginilor (auditul e gata cand nicio pagina nu mai e in asteptare sau in curs).
 */
export const AUDIT_STATUSES = [
  'discovery_queued',
  'discovering',
  'awaiting_selection',
  'scanning',
  'completed',
  'failed',
] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

/** De ce a fost propusa (sau aleasa) o pagina. */
export const SELECTION_REASONS = ['start', 'essential', 'section', 'random', 'manual'] as const;
export type SelectionReason = (typeof SELECTION_REASONS)[number];

/** Unde a fost gasit linkul spre pagina. */
export const LINK_REGIONS = ['nav', 'header', 'main', 'footer', 'other', 'sitemap'] as const;
export type LinkRegion = (typeof LINK_REGIONS)[number];

/**
 * De ce un link gasit NU a devenit pagina candidata.
 * Paginile interzise de robots.txt NU sunt excluse: apar in lista, nebifate si marcate
 * (`robotsBlocked`), iar doar utilizatorul le poate alege, constient.
 */
export const EXCLUSION_REASONS = [
  'action', // link cu efecte (iesire din cont, cos de cumparaturi, cautare)
  'file', // fisier care nu e pagina web (imagine, arhiva)
  'non_http', // mailto:, tel:, javascript:
  'same_page', // ancora spre aceeasi pagina (#...)
  'outside_scope', // acelasi site, dar in afara sectiunii auditate
  'limit', // peste numarul maxim de pagini candidate pastrate
] as const;
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

export const discoveredPageSchema = z.object({
  url: z.string(),
  /** Textul linkului (sau titlul din sitemap), ca utilizatorul sa recunoasca pagina. */
  label: z.string(),
  /** Sectiunea (meniul) din care face parte, ex. "Consiliul local"; null daca nu se stie. */
  section: z.string().nullable(),
  region: z.enum(LINK_REGIONS),
  /** Propusa automat in esantion. */
  proposed: z.boolean(),
  /** Aleasa de utilizator (dupa confirmarea listei). */
  selected: z.boolean(),
  /** robots.txt cere programelor automate sa nu viziteze pagina: nu e propusa automat. */
  robotsBlocked: z.boolean(),
  reasons: z.array(z.enum(SELECTION_REASONS)),
});
export type DiscoveredPage = z.infer<typeof discoveredPageSchema>;

export const externalServiceSchema = z.object({
  origin: z.string(),
  url: z.string(),
  label: z.string(),
});
export type ExternalService = z.infer<typeof externalServiceSchema>;

export const documentLinkSchema = z.object({
  url: z.string(),
  label: z.string(),
  /** Tipul fisierului, ex. "pdf", "docx". */
  extension: z.string(),
});
export type DocumentLink = z.infer<typeof documentLinkSchema>;

export const discoverySchema = z.object({
  /** Adresa paginii de start dupa redirectionari. */
  finalUrl: z.string(),
  /** Partea din site auditata: adresele care incep cu acest prefix. */
  scope: z.string(),
  /** Cate linkuri au fost citite din pagina de start. */
  linksFound: z.number().int(),
  pages: z.array(discoveredPageSchema),
  external: z.array(externalServiceSchema),
  documents: z.array(documentLinkSchema),
  excluded: z.partialRecord(z.enum(EXCLUSION_REASONS), z.number().int()),
  /** `blocked`: cate pagini candidate sunt interzise de robots.txt (nepropuse automat). */
  robots: z.object({ found: z.boolean(), blocked: z.number().int() }),
  sitemap: z.object({ found: z.boolean(), urls: z.number().int() }),
});
export type Discovery = z.infer<typeof discoverySchema>;

export const createAuditSchema = z.object({
  /** Pagina de start; daca lipseste, adresa de baza a proiectului. */
  startUrl: projectUrlSchema.optional(),
  maxPages: z
    .number()
    .int()
    .min(1, { message: 'Alege cel puțin o pagină.' })
    .max(AUDIT_MAX_PAGES, { message: `Un audit poate avea cel mult ${AUDIT_MAX_PAGES} de pagini.` })
    .optional(),
  wcagProfile: z.enum(WCAG_PROFILES).optional(),
  includeBestPractices: z.boolean().optional(),
});
export type CreateAuditInput = z.input<typeof createAuditSchema>;

export const auditSelectionSchema = z.object({
  urls: z
    .array(projectUrlSchema)
    .min(1, { message: 'Alege cel puțin o pagină.' })
    .max(AUDIT_MAX_PAGES, {
      message: `Poți alege cel mult ${AUDIT_MAX_PAGES} de pagini.`,
    }),
});
export type AuditSelectionInput = z.input<typeof auditSelectionSchema>;

/** O pagina scanata in cadrul auditului. */
export const auditPageSchema = z.object({
  scanId: z.string(),
  pageUrl: z.string(),
  label: z.string().nullable(),
  reasons: z.array(z.enum(SELECTION_REASONS)),
  /** Pagina era interzisa de robots.txt, dar utilizatorul a ales-o. */
  robotsBlocked: z.boolean(),
  status: z.enum(SCAN_STATUSES),
  errorMessage: z.string().nullable(),
  summary: scanSummarySchema.nullable(),
});
export type AuditPage = z.infer<typeof auditPageSchema>;

export const auditProgressSchema = z.object({
  total: z.number().int(),
  completed: z.number().int(),
  failed: z.number().int(),
});
export type AuditProgress = z.infer<typeof auditProgressSchema>;

export const auditSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  startUrl: z.string(),
  maxPages: z.number().int(),
  status: z.enum(AUDIT_STATUSES),
  config: scanConfigSchema,
  catalogVersion: z.string(),
  /** Prezenta dupa descoperire. */
  discovery: discoverySchema.nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  discoveredAt: z.iso.datetime().nullable(),
  selectedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  progress: auditProgressSchema,
  pages: z.array(auditPageSchema),
});
export type Audit = z.infer<typeof auditSchema>;

/** Un audit in lista proiectului (fara detaliile descoperirii). */
export const auditListItemSchema = z.object({
  id: z.string(),
  startUrl: z.string(),
  status: z.enum(AUDIT_STATUSES),
  createdAt: z.iso.datetime(),
  pagesFound: z.number().int().nullable(),
  progress: auditProgressSchema,
});
export type AuditListItem = z.infer<typeof auditListItemSchema>;

export const auditListSchema = z.object({ items: z.array(auditListItemSchema) });
export type AuditList = z.infer<typeof auditListSchema>;

const pageRefSchema = z.object({ scanId: z.string(), pageUrl: z.string() });

/** O regula cu probleme (sau de verificat manual), adunata de pe toate paginile. */
export const auditRuleSchema = z.object({
  axeRuleId: z.string(),
  category: z.enum(['violation', 'incomplete']),
  impact: z.enum(IMPACTS).nullable(),
  title: z.string(),
  titleRo: z.string().nullable(),
  isBestPractice: z.boolean(),
  wcagCriteria: z.array(z.string()),
  elementCount: z.number().int(),
  pages: z.array(pageRefSchema.extend({ elementCount: z.number().int() })),
});
export type AuditRule = z.infer<typeof auditRuleSchema>;

/**
 * Acelasi element, cu aceeasi problema, pe mai multe pagini (de obicei meniul sau subsolul,
 * venite din sablonul comun al site-ului): se repara o singura data.
 */
export const commonIssueSchema = z.object({
  key: z.string(),
  axeRuleId: z.string(),
  category: z.enum(['violation', 'incomplete']),
  impact: z.enum(IMPACTS).nullable(),
  title: z.string(),
  titleRo: z.string().nullable(),
  htmlSnippet: z.string(),
  cssSelector: z.unknown(),
  pages: z.array(pageRefSchema),
});
export type CommonIssue = z.infer<typeof commonIssueSchema>;

export const auditResultsSchema = z.object({
  pagesScanned: z.number().int(),
  rules: z.array(auditRuleSchema),
  commonIssues: z.array(commonIssueSchema),
});
export type AuditResults = z.infer<typeof auditResultsSchema>;
