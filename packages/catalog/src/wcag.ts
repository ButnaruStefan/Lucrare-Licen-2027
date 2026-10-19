/**
 * Catalogul criteriilor WCAG 2.2 (generat din documentul oficial W3C) + titlurile in romana.
 */
import wcag from './data/wcag22.json' with { type: 'json' };
import { WCAG_TITLES_RO, WCAG_TITLES_RO_STATUS } from './data/wcag-titluri-ro';

export type WcagPrinciple = 'perceptibil' | 'operabil' | 'inteligibil' | 'robust';
export type WcagLevel = 'A' | 'AA' | 'AAA';

export interface WcagCriterion {
  number: string;
  titleEn: string;
  titleRo: string | null;
  titleRoStatus: string;
  level: WcagLevel | null;
  levelInWcag21: WcagLevel | null;
  principle: WcagPrinciple;
  guideline: string;
  specUrl: string;
  understandingUrl: string | null;
  newInWcag22: boolean;
  obsoleteInWcag22: boolean;
}

export const WCAG_SOURCE = {
  sources: wcag.sources,
  retrievedAt: wcag.retrievedAt,
  count: wcag.criteria.length,
};

const BY_NUMBER = new Map<string, WcagCriterion>(
  wcag.criteria.map((c) => [
    c.number,
    {
      number: c.number,
      titleEn: c.title,
      titleRo: WCAG_TITLES_RO[c.number] ?? null,
      titleRoStatus: WCAG_TITLES_RO_STATUS,
      level: c.level as WcagLevel | null,
      levelInWcag21: c.levelInWcag21 as WcagLevel | null,
      principle: c.principle as WcagPrinciple,
      guideline: c.guideline,
      specUrl: c.specUrl,
      understandingUrl: c.understandingUrl,
      newInWcag22: !c.inWcag21,
      obsoleteInWcag22: c.obsoleteIn22,
    },
  ]),
);

export function wcagCriterion(number: string): WcagCriterion | null {
  return BY_NUMBER.get(number) ?? null;
}

export function allWcagCriteria(): WcagCriterion[] {
  return [...BY_NUMBER.values()];
}
