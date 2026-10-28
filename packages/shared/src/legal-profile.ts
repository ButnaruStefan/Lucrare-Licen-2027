/**
 * Contractul pentru profilul juridic al unui proiect (OUG 112/2018).
 *
 * Profilul = raspunsurile date de utilizator la cateva intrebari despre cine administreaza
 * site-ul, plus evaluarea lor: legea pare aplicabila, posibil aplicabila, neaplicabila sau
 * informatiile nu sunt suficiente. Evaluarea e INFORMATIVA (nu e o concluzie juridica) si se
 * bazeaza doar pe ce declara utilizatorul.
 *
 * Folosit de API (validarea raspunsurilor, forma raspunsului) si de interfata (formularul si
 * afisarea rezultatului). Intrebarile si regulile de evaluare sunt in `@ro-a11y/catalog`.
 */
import { z } from 'zod';

/** Starile posibile ale aplicabilitatii legii pentru un site. */
export const APPLICABILITY_STATUSES = [
  'applicable',
  'possibly_applicable',
  'not_applicable',
  'insufficient_information',
  'not_assessed',
] as const;
export type ApplicabilityStatus = (typeof APPLICABILITY_STATUSES)[number];

/** Cine administreaza site-ul (art. 2 lit. a din OUG 112/2018). */
export const ORGANIZATION_TYPES = [
  'public_authority',
  'public_law_body',
  'public_association',
  'non_profit',
  'private',
  'unknown',
] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const YES_NO_UNKNOWN = ['yes', 'no', 'unknown'] as const;
export type YesNoUnknown = (typeof YES_NO_UNKNOWN)[number];

/** Cui ii e destinat site-ul (art. 1 alin. 4 lit. g: intranet / extranet). */
export const AUDIENCES = ['public', 'restricted_old', 'restricted_new', 'unknown'] as const;
export type Audience = (typeof AUDIENCES)[number];

const MESSAGE_REQUIRED = 'Alege un răspuns.';

const answer = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values, { error: MESSAGE_REQUIRED });

/**
 * Raspunsurile la chestionar. Unele intrebari se pun doar in anumite situatii (ex. intrebarile
 * despre ONG-uri doar daca site-ul e al unui ONG); regulile sunt in `questionApplies`.
 */
export const legalProfileAnswersSchema = z
  .object({
    organizationType: answer(ORGANIZATION_TYPES),
    publicBroadcaster: answer(YES_NO_UNKNOWN).optional(),
    nonProfitEssentialServices: answer(YES_NO_UNKNOWN).optional(),
    nonProfitDisabilityServices: answer(YES_NO_UNKNOWN).optional(),
    audience: answer(AUDIENCES).optional(),
  })
  .superRefine((answers, ctx) => {
    for (const question of QUESTION_IDS) {
      if (question === 'organizationType') continue;
      if (questionApplies(question, answers) && answers[question] === undefined) {
        ctx.addIssue({ code: 'custom', path: [question], message: MESSAGE_REQUIRED });
      }
    }
  })
  // Raspunsurile la intrebari care nu se aplica sunt ignorate (nu se salveaza).
  .transform((answers) => {
    const cleaned: LegalProfileAnswers = { organizationType: answers.organizationType };
    for (const question of QUESTION_IDS) {
      if (question === 'organizationType') continue;
      if (questionApplies(question, answers) && answers[question] !== undefined) {
        Object.assign(cleaned, { [question]: answers[question] });
      }
    }
    return cleaned;
  });

export interface LegalProfileAnswers {
  organizationType: OrganizationType;
  publicBroadcaster?: YesNoUnknown;
  nonProfitEssentialServices?: YesNoUnknown;
  nonProfitDisabilityServices?: YesNoUnknown;
  audience?: Audience;
}
export type QuestionId = keyof LegalProfileAnswers;

export const QUESTION_IDS = [
  'organizationType',
  'publicBroadcaster',
  'nonProfitEssentialServices',
  'nonProfitDisabilityServices',
  'audience',
] as const satisfies readonly QuestionId[];

/**
 * Daca o intrebare se pune, in functie de raspunsurile de pana acum.
 * Folosita si de API (validare), si de interfata (ce intrebari afiseaza).
 */
export function questionApplies(
  question: QuestionId,
  answers: Partial<Pick<LegalProfileAnswers, 'organizationType'>>,
): boolean {
  const org = answers.organizationType;
  switch (question) {
    case 'organizationType':
      return true;
    case 'nonProfitEssentialServices':
    case 'nonProfitDisabilityServices':
      return org === 'non_profit';
    case 'publicBroadcaster':
    case 'audience':
      // Pentru site-uri private sau administrator necunoscut, celelalte intrebari nu mai conteaza.
      return org !== undefined && org !== 'private' && org !== 'unknown';
  }
}

/** O intrebare din chestionar, asa cum o afiseaza interfata. */
export const questionSchema = z.object({
  id: z.enum(QUESTION_IDS),
  text: z.string(),
  help: z.string(),
  articleRef: z.string(),
  options: z.array(z.object({ value: z.string(), label: z.string(), help: z.string().optional() })),
});
export type Question = z.infer<typeof questionSchema>;

/** Un argument al evaluarii, legat de un articol citat exact. */
export const legalReasonSchema = z.object({
  code: z.string(),
  text: z.string(),
  articleRef: z.string(),
  quote: z.string(),
});
export type LegalReason = z.infer<typeof legalReasonSchema>;

export const legalAssessmentSchema = z.object({
  framework: z.literal('RO_OUG_112_2018'),
  status: z.enum(APPLICABILITY_STATUSES),
  summary: z.string(),
  /** Pe ce se sprijina rezultatul. */
  reasons: z.array(legalReasonSchema),
  /** Raspunsuri "Nu stiu" care impiedica evaluarea. */
  missingFacts: z.array(z.string()),
  /** Ce trebuie confirmat de un om (ex. de un jurist) inainte de orice concluzie. */
  toConfirm: z.array(z.string()),
  /** Informatii utile, chiar daca legea se aplica (ex. tipuri de continut exceptate). */
  notes: z.array(z.object({ articleRef: z.string(), text: z.string() })),
  disclaimer: z.string(),
  source: z.object({ name: z.string(), url: z.string(), retrievedAt: z.string() }),
  catalogVersion: z.string(),
});
export type LegalAssessment = z.infer<typeof legalAssessmentSchema>;

export const legalProfileSchema = z.object({
  projectId: z.string(),
  answers: z.object({
    organizationType: z.enum(ORGANIZATION_TYPES),
    publicBroadcaster: z.enum(YES_NO_UNKNOWN).optional(),
    nonProfitEssentialServices: z.enum(YES_NO_UNKNOWN).optional(),
    nonProfitDisabilityServices: z.enum(YES_NO_UNKNOWN).optional(),
    audience: z.enum(AUDIENCES).optional(),
  }),
  assessment: legalAssessmentSchema,
  updatedAt: z.iso.datetime(),
});
export type LegalProfile = z.infer<typeof legalProfileSchema>;

/** Raspunsul la GET: intrebarile si profilul salvat (sau null, daca nu a fost completat). */
export const legalProfileResponseSchema = z.object({
  questions: z.array(questionSchema),
  profile: legalProfileSchema.nullable(),
});
export type LegalProfileResponse = z.infer<typeof legalProfileResponseSchema>;
