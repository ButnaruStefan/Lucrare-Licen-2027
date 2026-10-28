/**
 * Motorul de trasabilitate: construieste, pentru rezultatul unei reguli axe, lantul complet
 *
 *   regula axe -> criterii WCAG -> clauze EN 301 549 V3.2.1 -> prevederi OUG 112/2018
 *
 * plus explicatia si remedierea in romana, daca exista.
 *
 * Reguli de prudenta (vezi si specificatia proiectului):
 *   - fiecare veriga are sursa si status; nimic nu e prezentat ca "incalcare a legii";
 *   - o regula de "buna practica" (fara criteriu WCAG) nu are nicio legatura normativa;
 *   - aplicabilitatea legii vine din profilul juridic al proiectului (vezi profil-oug112.ts);
 *     cat timp profilul nu e completat, ramane "neevaluata".
 */
import type { LegalAssessment, Trace } from '@ro-a11y/shared';
import { EN_EDITION, enClauseFor } from './en301549';
import { legalProvisionsFor, OUG_112_2018 } from './legislatie';
import { REMEDIATIONS, REMEDIATIONS_STATUS } from './data/remedieri-ro';
import { wcagCriterion } from './wcag';

/** Versiunea catalogului = data ultimei verificari a surselor. Se salveaza la fiecare scanare. */
export const CATALOG_VERSION = '2026-10-28';

/** Textul din lant cand profilul juridic al proiectului nu a fost completat. */
export const NOT_ASSESSED_MESSAGE =
  'Legea se aplică doar organismelor din sectorul public (art. 2 lit. a), cu excepțiile de la art. 1. Completează profilul juridic al proiectului pentru o evaluare.';

export interface TraceInput {
  axeRuleId: string; // ex. "image-alt"
  axeTags: readonly string[]; // ex. ["wcag2a", "wcag111", "EN-9.1.1.1"]
  wcagCriteria: readonly string[]; // ex. ["1.1.1"]  ← extras din etichete de normalize.ts
  docsUrl: string; // ex. "https://dequeuniversity.com/rules/axe/4.10/image-alt"
  engineVersion: string | null; // ex. "axe-core 4.13.0"
  /** Evaluarea din profilul juridic al proiectului (lipseste daca nu a fost completat). */
  legalAssessment?: { assessment: LegalAssessment; assessedAt: string } | null;
}

const REMEDIATION_BY_RULE = new Map(REMEDIATIONS.map((r) => [r.axeRuleId, r]));

export function remediationFor(axeRuleId: string) {
  return REMEDIATION_BY_RULE.get(axeRuleId) ?? null;
}

export function buildTrace(input: TraceInput): Trace {
  const wcag = input.wcagCriteria
    .map((number) => wcagCriterion(number))
    .filter((c) => c !== null)
    .map((c) => ({
      number: c.number,
      titleEn: c.titleEn,
      titleRo: c.titleRo,
      titleRoStatus: c.titleRoStatus,
      level: c.level ?? c.levelInWcag21,
      principle: c.principle,
      specUrl: c.specUrl,
      understandingUrl: c.understandingUrl,
      newInWcag22: c.newInWcag22,
    }));

  const en = wcag.map((c) => ({ wcagNumber: c.number, ...enClauseFor(c.number, input.axeTags) }));

  // Prevederile legale, fara duplicate (doua criterii din acelasi principiu = aceeasi prevedere)
  const legal = new Map<string, ReturnType<typeof legalProvisionsFor>[number]>();
  wcag.forEach((c, i) => {
    const hasClause = en[i]!.status === 'confirmed' || en[i]!.status === 'derived';
    for (const provision of legalProvisionsFor(c.principle, hasClause)) {
      legal.set(provision.articleRef, provision);
    }
  });

  return {
    catalogVersion: CATALOG_VERSION,
    axeRule: { id: input.axeRuleId, engineVersion: input.engineVersion, docsUrl: input.docsUrl },
    isBestPractice: wcag.length === 0 && input.axeTags.includes('best-practice'),
    wcag,
    en,
    enEdition: {
      standard: EN_EDITION.standard,
      version: EN_EDITION.version,
      harmonisedBy: EN_EDITION.harmonisedBy,
      harmonisedBySourceUrl: EN_EDITION.harmonisedBySourceUrl,
      verifiedAt: EN_EDITION.verifiedAt,
    },
    legal: [...legal.values()].sort((a, b) => a.articleRef.localeCompare(b.articleRef)),
    legalFramework: {
      name: OUG_112_2018.name,
      sourceUrl: OUG_112_2018.sourceUrl,
      retrievedAt: OUG_112_2018.retrievedAt,
    },
    applicability: input.legalAssessment
      ? {
          status: input.legalAssessment.assessment.status,
          message: input.legalAssessment.assessment.summary,
          assessedAt: input.legalAssessment.assessedAt,
        }
      : { status: 'not_assessed', message: NOT_ASSESSED_MESSAGE, assessedAt: null },
    remediation: remediationFor(input.axeRuleId),
    remediationStatus: REMEDIATIONS_STATUS,
  };
}
