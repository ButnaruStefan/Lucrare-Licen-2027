/**
 * Contractul pentru lantul de trasabilitate al unei probleme:
 *
 *   element HTML -> regula axe -> criteriu WCAG -> clauza EN 301 549 -> prevederi OUG 112/2018
 *
 * plus explicatia si remedierea in romana. Fiecare veriga are sursa si statusul verificarii,
 * ca interfata sa poata arata clar ce e verificat si ce e doar dedus sau de validat.
 */
import { z } from 'zod';
import { APPLICABILITY_STATUSES } from './legal-profile';

export const traceWcagSchema = z.object({
  number: z.string(),
  titleEn: z.string(),
  titleRo: z.string().nullable(),
  titleRoStatus: z.string(),
  level: z.enum(['A', 'AA', 'AAA']).nullable(),
  principle: z.enum(['perceptibil', 'operabil', 'inteligibil', 'robust']),
  specUrl: z.string(),
  understandingUrl: z.string().nullable(),
  newInWcag22: z.boolean(),
});
export type TraceWcag = z.infer<typeof traceWcagSchema>;

export const EN_LINK_STATUSES = ['confirmed', 'derived', 'none', 'conflict'] as const;

export const traceEnSchema = z.object({
  wcagNumber: z.string(),
  clause: z.string().nullable(),
  status: z.enum(EN_LINK_STATUSES),
  explanation: z.string(),
});
export type TraceEn = z.infer<typeof traceEnSchema>;

export const traceLegalSchema = z.object({
  framework: z.string(),
  articleRef: z.string(),
  quote: z.string(),
  explanation: z.string(),
  sourceUrl: z.string(),
  retrievedAt: z.string(),
  reviewStatus: z.literal('text_verified_relevance_to_validate'),
});
export type TraceLegal = z.infer<typeof traceLegalSchema>;

export const remediationSchema = z.object({
  axeRuleId: z.string(),
  titleRo: z.string(),
  whatItMeans: z.string(),
  whoIsAffected: z.string(),
  howToFix: z.array(z.string()),
  example: z.object({ before: z.string(), after: z.string(), note: z.string().optional() }),
  howToVerify: z.array(z.string()),
});
export type Remediation = z.infer<typeof remediationSchema>;

export const traceSchema = z.object({
  /** Versiunea catalogului normativ folosit pentru acest lant (data ultimei verificari). */
  catalogVersion: z.string(),
  axeRule: z.object({ id: z.string(), engineVersion: z.string().nullable(), docsUrl: z.string() }),
  isBestPractice: z.boolean(),
  wcag: z.array(traceWcagSchema),
  en: z.array(traceEnSchema),
  enEdition: z.object({
    standard: z.string(),
    version: z.string(),
    harmonisedBy: z.string(),
    harmonisedBySourceUrl: z.string(),
    verifiedAt: z.string(),
  }),
  legal: z.array(traceLegalSchema),
  legalFramework: z.object({ name: z.string(), sourceUrl: z.string(), retrievedAt: z.string() }),
  /**
   * Aplicabilitatea legii depinde de profilul organizatiei (cine administreaza site-ul).
   * "not_assessed" cat timp profilul juridic al proiectului nu a fost completat.
   */
  applicability: z.object({
    status: z.enum(APPLICABILITY_STATUSES),
    message: z.string(),
    /** Data completarii profilului juridic (null daca nu a fost completat). */
    assessedAt: z.string().nullable(),
  }),
  remediation: remediationSchema.nullable(),
  remediationStatus: z.string(),
});
export type Trace = z.infer<typeof traceSchema>;
