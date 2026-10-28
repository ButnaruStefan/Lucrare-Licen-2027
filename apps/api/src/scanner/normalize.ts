/**
 * Normalizarea rezultatelor axe-core: transforma raspunsul brut al motorului in formatul
 * nostru (cel din tabelele rule_results si affected_elements).
 *
 * Ce face, pe scurt:
 *   - pastreaza toate cele 4 categorii: violation, incomplete, pass, inapplicable;
 *   - extrage criteriile WCAG din etichetele axe (ex. "wcag111" -> "1.1.1");
 *   - pentru violation si incomplete, pastreaza elementele afectate (selector, HTML trunchiat);
 *   - calculeaza amprenta fiecarui element, folosita la comparatia intre scanari.
 *
 * Functie "pura": nu acceseaza browserul sau baza de date, deci se testeaza usor.
 */
import { createHash } from 'node:crypto';
import type { AxeResults, ImpactValue, NodeResult, Result } from 'axe-core';
import type { Impact, ResultCategory } from '@ro-a11y/shared';

/** Lungimea maxima a fragmentului HTML pastrat pentru un element. */
export const MAX_HTML_LENGTH = 1000;

export interface NormalizedElement {
  cssSelector: unknown;
  htmlSnippet: string;
  failureSummary: string | null;
  fingerprint: string;
}

export interface NormalizedRuleResult {
  axeRuleId: string;
  category: ResultCategory;
  impact: Impact | null;
  title: string;
  description: string;
  docsUrl: string;
  axeTags: string[];
  wcagCriteria: string[];
  elements: NormalizedElement[];
}

/**
 * Extrage criteriile WCAG din etichetele axe. Etichetele de criteriu au forma
 * "wcag" + principiu + ghid + criteriu, ex. "wcag111" = 1.1.1, "wcag1410" = 1.4.10.
 * Etichetele de nivel ("wcag2a", "wcag21aa") contin litere si sunt ignorate.
 */
export function wcagCriteriaFromTags(tags: readonly string[]): string[] {
  const criteria = new Set<string>();
  for (const tag of tags) {
    const match = /^wcag(\d)(\d)(\d+)$/.exec(tag);
    if (match) criteria.add(`${match[1]}.${match[2]}.${match[3]}`);
  }
  return [...criteria];
}

/** Adresa paginii fara fragment (#...), ca aceeasi pagina sa dea aceeasi amprenta. */
function normalizePageUrl(pageUrl: string): string {
  const url = new URL(pageUrl);
  url.hash = '';
  return url.toString();
}

/**
 * Amprenta unui element: aceeasi regula, pe aceeasi pagina, pe acelasi selector CSS da
 * mereu aceeasi amprenta. Limita: daca structura paginii se schimba si selectorul se
 * schimba, amprenta se schimba si ea (comparatia va spune atunci "nou" / "posibil rezolvat").
 */
export function elementFingerprint(pageUrl: string, axeRuleId: string, target: unknown): string {
  return createHash('sha256')
    .update(`${normalizePageUrl(pageUrl)}|${axeRuleId}|${JSON.stringify(target)}`)
    .digest('hex');
}

function truncate(html: string): string {
  return html.length <= MAX_HTML_LENGTH ? html : `${html.slice(0, MAX_HTML_LENGTH)}…`;
}

function toImpact(value: ImpactValue | undefined): Impact | null {
  return value === 'minor' || value === 'moderate' || value === 'serious' || value === 'critical'
    ? value
    : null;
}

function normalizeRule(
  rule: Result,
  category: ResultCategory,
  pageUrl: string,
): NormalizedRuleResult {
  const keepElements = category === 'violation' || category === 'incomplete';
  return {
    axeRuleId: rule.id,
    category,
    impact: keepElements ? toImpact(rule.impact) : null,
    title: rule.help,
    description: rule.description,
    docsUrl: rule.helpUrl,
    axeTags: [...rule.tags],
    wcagCriteria: wcagCriteriaFromTags(rule.tags),
    elements: keepElements
      ? rule.nodes.map((node: NodeResult) => ({
          cssSelector: node.target,
          htmlSnippet: truncate(node.html),
          failureSummary: node.failureSummary ?? null,
          fingerprint: elementFingerprint(pageUrl, rule.id, node.target),
        }))
      : [],
  };
}

export function normalizeAxeResults(raw: AxeResults, pageUrl: string): NormalizedRuleResult[] {
  return [
    ...raw.violations.map((r) => normalizeRule(r, 'violation', pageUrl)),
    ...raw.incomplete.map((r) => normalizeRule(r, 'incomplete', pageUrl)),
    ...raw.passes.map((r) => normalizeRule(r, 'pass', pageUrl)),
    ...raw.inapplicable.map((r) => normalizeRule(r, 'inapplicable', pageUrl)),
  ];
}

/** Regula e "buna practica" (nu criteriu WCAG obligatoriu)? */
export function isBestPractice(axeTags: readonly string[], wcagCriteria: readonly string[]) {
  return wcagCriteria.length === 0 && axeTags.includes('best-practice');
}
