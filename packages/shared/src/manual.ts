/**
 * Contractul pentru verificarea manuala: verificarile de accesibilitate pe care le face un om,
 * pe fiecare pagina scanata (scanare separata sau pagina dintr-un audit), pentru ce nu poate
 * verifica axe-core (ex. daca textul alternativ are sens, daca pagina merge doar cu tastatura).
 *
 * Reguli (din specificatie si din WCAG-EM 2.0):
 *   - un rezultat manual nu se completeaza niciodata automat din axe-core;
 *   - "In asteptare" (nicio evaluare salvata) nu e acelasi lucru cu "Trece";
 *   - singurul lucru detectat automat e ca o verificare NU se aplica (ex. pagina nu are
 *     formulare), din ce contine pagina la scanare; omul poate schimba oricand.
 *
 * Folosit de API (rutele /api/v1/scans/:id/manual-checks) si de interfata (sectiunea
 * "Verificare manuala" de pe pagina scanarii, progresul pe pagina auditului). Continutul
 * verificarilor (pasii, criteriile, sursele) e in catalog (`@ro-a11y/catalog`).
 */
import { z } from 'zod';

/** Cele 6 verificari manuale, in ordinea in care apar. */
export const MANUAL_CHECK_IDS = [
  'tastatura',
  'focus',
  'text-alternativ',
  'erori-formulare',
  'zoom-reflow',
  'titluri',
] as const;
export type ManualCheckId = (typeof MANUAL_CHECK_IDS)[number];

/** Rezultatele posibile ale unei verificari (fara rezultat salvat = "In asteptare"). */
export const MANUAL_RESULTS = ['pass', 'fail', 'not_applicable', 'cannot_determine'] as const;
export type ManualResult = (typeof MANUAL_RESULTS)[number];

/**
 * Starea unei verificari pe o pagina: rezultatul salvat de om, sau, daca nu exista,
 * "pending" (de facut) ori "auto_not_applicable" (pagina nu contine ce se verifica).
 */
export const MANUAL_STATUSES = [...MANUAL_RESULTS, 'pending', 'auto_not_applicable'] as const;
export type ManualStatus = (typeof MANUAL_STATUSES)[number];

/**
 * Ce contine pagina, numarat la scanare (din DOM, imediat dupa axe-core). Decide care
 * verificari nu se aplica si ii arata omului pe ce sa se uite.
 */
export const pageFactsSchema = z.object({
  /** Imagini: img, input type=image, area cu link, elemente cu rol de imagine. */
  images: z.number().int().nonnegative(),
  /** Elemente <form>. */
  forms: z.number().int().nonnegative(),
  /** Campuri de completat: input (fara hidden si butoane), select, textarea, roluri echivalente. */
  formFields: z.number().int().nonnegative(),
  /** Titlurile paginii, in ordine (h1-h6 si role=heading). */
  headings: z.array(
    z.object({
      level: z.number().int().min(1).max(6),
      text: z.string(),
      /** Nu se vede pe ecran (ex. intr-un meniu inchis). */
      hidden: z.boolean(),
    }),
  ),
  /** Pagina avea mai multe titluri decat am pastrat. */
  headingsTruncated: z.boolean(),
});
export type PageFacts = z.infer<typeof pageFactsSchema>;

/** Ce trimite omul cand salveaza o verificare. */
export const manualEvaluationInputSchema = z
  .object({
    result: z.enum(MANUAL_RESULTS, { error: 'Alege un rezultat.' }),
    evaluator: z
      .string({ error: 'Scrie numele celui care a verificat.' })
      .trim()
      .min(1, 'Scrie numele celui care a verificat.')
      .max(80, 'Numele poate avea cel mult 80 de caractere.'),
    notes: z.string().trim().max(2000, 'Notele pot avea cel mult 2000 de caractere.').default(''),
  })
  .refine((input) => input.result !== 'fail' || input.notes.length > 0, {
    message: 'Descrie pe scurt ce nu merge (în note).',
    path: ['notes'],
  });
export type ManualEvaluationInput = z.input<typeof manualEvaluationInputSchema>;

/** O evaluare salvata. */
export const manualEvaluationSchema = z.object({
  result: z.enum(MANUAL_RESULTS),
  evaluator: z.string(),
  notes: z.string(),
  /** Versiunea pasilor dupa care s-a facut verificarea (daca pasii se schimba, se stie). */
  checksVersion: z.string(),
  updatedAt: z.string(),
});
export type ManualEvaluation = z.infer<typeof manualEvaluationSchema>;

/** Un criteriu WCAG legat de o verificare (din catalogul generat din sursa W3C). */
export const manualCriterionSchema = z.object({
  number: z.string(),
  titleEn: z.string(),
  titleRo: z.string().nullable(),
  level: z.enum(['A', 'AA', 'AAA']).nullable(),
  understandingUrl: z.string().nullable(),
});

/** O verificare manuala pe o pagina: ce se verifica, cum, si starea ei. */
export const manualCheckSchema = z.object({
  id: z.enum(MANUAL_CHECK_IDS),
  title: z.string(),
  /** De ce conteaza, pe scurt. */
  why: z.string(),
  criteria: z.array(manualCriterionSchema),
  /** Pasii, in ordine. */
  steps: z.array(z.string()),
  /** Cand trece verificarea. */
  passWhen: z.string(),
  /** Atentionari (ex. nu trimite date reale intr-un formular). */
  cautions: z.array(z.string()),
  sources: z.array(z.object({ label: z.string(), url: z.string() })),
  /** De ce nu se aplica, detectat automat (null = se aplica sau nu stim ce contine pagina). */
  autoNotApplicable: z.string().nullable(),
  status: z.enum(MANUAL_STATUSES),
  evaluation: manualEvaluationSchema.nullable(),
});
export type ManualCheck = z.infer<typeof manualCheckSchema>;

/** Progresul verificarii manuale pe o pagina (si, adunat, pe un audit). */
export const manualSummarySchema = z.object({
  /** Cate verificari exista (6). */
  total: z.number().int(),
  /** Cu rezultat salvat de om. */
  completed: z.number().int(),
  /** Fara rezultat, dar nu se aplica (detectat automat). */
  autoNotApplicable: z.number().int(),
  /** De facut. */
  pending: z.number().int(),
  /** Salvate ca "Nu trece". */
  failed: z.number().int(),
});
export type ManualSummary = z.infer<typeof manualSummarySchema>;

/** Raspunsul GET /api/v1/scans/:id/manual-checks. */
export const scanManualChecksSchema = z.object({
  checksVersion: z.string(),
  /** Ce contine pagina; null = scanare mai veche, din care nu stim. */
  facts: pageFactsSchema.nullable(),
  checks: z.array(manualCheckSchema),
  summary: manualSummarySchema,
});
export type ScanManualChecks = z.infer<typeof scanManualChecksSchema>;

/**
 * Starea unei verificari: rezultatul salvat, altfel "nu se aplica" detectat automat, altfel
 * "de facut". Functie comuna pentru API (raspuns, sumar) si teste.
 */
export function manualStatus(
  evaluation: { result: ManualResult } | null,
  autoNotApplicable: string | null,
): ManualStatus {
  if (evaluation) return evaluation.result;
  return autoNotApplicable ? 'auto_not_applicable' : 'pending';
}

/** Sumarul, din starile verificarilor. */
export function summarizeManual(statuses: ManualStatus[]): ManualSummary {
  const count = (fn: (s: ManualStatus) => boolean) => statuses.filter(fn).length;
  return {
    total: statuses.length,
    completed: count((s) => s !== 'pending' && s !== 'auto_not_applicable'),
    autoNotApplicable: count((s) => s === 'auto_not_applicable'),
    pending: count((s) => s === 'pending'),
    failed: count((s) => s === 'fail'),
  };
}
