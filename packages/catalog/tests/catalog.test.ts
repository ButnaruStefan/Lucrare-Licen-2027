/**
 * Testele catalogului normativ. Verifica datele, nu doar codul:
 *   - catalogul WCAG generat din sursa W3C are structura cunoscuta a standardului;
 *   - legatura WCAG -> EN 301 549 coincide cu etichetele EN puse de axe-core pe TOATE regulile;
 *   - citatele din OUG 112/2018 apar exact in textul oficial salvat;
 *   - exista remedieri in romana pentru toate problemele automate de pe site-ul de antrenament;
 *   - lantul de trasabilitate se construieste corect.
 */
import { readFileSync } from 'node:fs';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import probleme from '../../../fixtures/broken-demo/probleme.json' with { type: 'json' };
import {
  allWcagCriteria,
  allWebClauses,
  buildTrace,
  enClauseFor,
  HARMONISED_STANDARD_PROVISION,
  legalProvisionsFor,
  REMEDIATIONS,
  WCAG_SOURCE,
  wcagCriterion,
} from '../src/index';

/** Criteriile WCAG dintr-o lista de etichete axe (ex. "wcag111" -> "1.1.1"). */
function criteriaFromTags(tags: readonly string[]) {
  return tags
    .map((t) => /^wcag(\d)(\d)(\d+)$/.exec(t))
    .filter((m) => m !== null)
    .map((m) => `${m[1]}.${m[2]}.${m[3]}`);
}

describe('catalogul WCAG 2.2 (generat din W3C)', () => {
  const all = allWcagCriteria();

  it('are structura oficiala: 87 de criterii, 31 A, 24 AA, 31 AAA, 4.1.1 eliminat', () => {
    expect(WCAG_SOURCE.count).toBe(87);
    const count = (level: string) =>
      all.filter((c) => c.level === level && !c.obsoleteInWcag22).length;
    expect([count('A'), count('AA'), count('AAA')]).toEqual([31, 24, 31]);
    expect(wcagCriterion('4.1.1')).toMatchObject({ obsoleteInWcag22: true, levelInWcag21: 'A' });
  });

  it('marcheaza exact cele 9 criterii noi din WCAG 2.2', () => {
    expect(all.filter((c) => c.newInWcag22).map((c) => c.number)).toEqual([
      '2.4.11',
      '2.4.12',
      '2.4.13',
      '2.5.7',
      '2.5.8',
      '3.2.6',
      '3.3.7',
      '3.3.8',
      '3.3.9',
    ]);
  });

  it('are titlu in romana pentru fiecare criteriu A si AA (si doar pentru acestea)', () => {
    const relevant = all.filter((c) => c.level === 'A' || c.level === 'AA' || c.number === '4.1.1');
    expect(relevant.filter((c) => !c.titleRo).map((c) => c.number)).toEqual([]);
    expect(all.filter((c) => c.level === 'AAA' && c.titleRo)).toEqual([]);
  });

  it('are legaturi spre documentatia oficiala pentru fiecare criteriu', () => {
    for (const c of all) {
      expect(c.specUrl).toMatch(/^https:\/\/www\.w3\.org\/TR\/WCAG22\/#/);
      expect(c.understandingUrl).toMatch(/^https:\/\/www\.w3\.org\/WAI\/WCAG22\/Understanding\//);
    }
  });
});

describe('legatura WCAG -> EN 301 549 V3.2.1', () => {
  it('are 50 de clauze web (criteriile A si AA din WCAG 2.1)', () => {
    expect(allWebClauses()).toHaveLength(50);
    expect(allWebClauses()).toContain('9.1.1.1');
    expect(allWebClauses()).toContain('9.4.1.1');
    expect(allWebClauses()).not.toContain('9.2.5.8');
  });

  it('coincide cu etichetele EN ale axe-core pe toate regulile (o singura exceptie cunoscuta)', () => {
    const disagreements: string[] = [];
    let agreements = 0;
    for (const rule of axe.getRules()) {
      const criteria = criteriaFromTags(rule.tags);
      for (const tag of rule.tags.filter((t) => t.startsWith('EN-9.'))) {
        const clause = tag.slice(3);
        const fromRule = criteria
          .map((c) => enClauseFor(c, rule.tags))
          .find((link) => link.clause === clause);
        if (fromRule?.status === 'confirmed') agreements += 1;
        else disagreements.push(`${rule.ruleId}:${clause}:${fromRule?.status ?? 'absent'}`);
      }
    }
    expect(agreements).toBe(73);
    // Singura discrepanta: criteriul 2.1.3 este AAA, dar axe-core il eticheteaza cu o clauza EN.
    // Nu e ascunsa: apare in aplicatie cu statusul "conflict".
    expect(disagreements).toEqual(['scrollable-region-focusable:9.2.1.3:conflict']);
  });

  it('da statusurile corecte: confirmat, dedus, inexistent', () => {
    expect(enClauseFor('1.1.1', ['wcag111', 'EN-9.1.1.1'])).toMatchObject({
      clause: '9.1.1.1',
      status: 'confirmed',
    });
    expect(enClauseFor('4.1.1', ['wcag411'])).toMatchObject({
      clause: '9.4.1.1',
      status: 'derived',
    });
    expect(enClauseFor('2.5.8', ['wcag258'])).toMatchObject({ clause: null, status: 'none' });
  });
});

describe('OUG 112/2018', () => {
  const official = readFileSync(
    new URL('../src/data/oug-112-2018-art1-5.txt', import.meta.url),
    'utf-8',
  ).replace(/\s+/g, ' ');

  const provisions = [
    ...(['perceptibil', 'operabil', 'inteligibil', 'robust'] as const).flatMap((p) =>
      legalProvisionsFor(p, false),
    ),
    HARMONISED_STANDARD_PROVISION,
  ];

  it.each(provisions.map((p) => [p.articleRef, p]))(
    'citatul din %s apare exact in textul oficial',
    (_ref, provision) => {
      // "[…]" marcheaza o parte omisa: fiecare bucata trebuie sa apara exact
      for (const part of provision.quote.split('[…]')) {
        expect(official).toContain(part.trim());
      }
    },
  );
});

describe('remedierile in romana', () => {
  it('exista pentru toate problemele automate de pe site-ul de antrenament', () => {
    const rules = probleme.detectabileAutomat.flatMap((p) =>
      Array.isArray(p.regulaAxe) ? p.regulaAxe : [p.regulaAxe],
    );
    const covered = new Set(REMEDIATIONS.map((r) => r.axeRuleId));
    expect(rules.filter((r) => !covered.has(r))).toEqual([]);
  });

  it('se refera doar la reguli care exista in axe-core', () => {
    const axeRules = new Set(axe.getRules().map((r) => r.ruleId));
    expect(REMEDIATIONS.filter((r) => !axeRules.has(r.axeRuleId)).map((r) => r.axeRuleId)).toEqual(
      [],
    );
  });
});

describe('buildTrace', () => {
  const rule = (id: string) => axe.getRules().find((r) => r.ruleId === id)!;

  it('construieste lantul complet pentru image-alt', () => {
    const tags = rule('image-alt').tags;
    const trace = buildTrace({
      axeRuleId: 'image-alt',
      axeTags: tags,
      wcagCriteria: criteriaFromTags(tags),
      docsUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
      engineVersion: '4.13.0',
    });

    expect(trace.isBestPractice).toBe(false);
    expect(trace.wcag).toMatchObject([
      { number: '1.1.1', titleRo: 'Conținut non-text', level: 'A', principle: 'perceptibil' },
    ]);
    expect(trace.en).toMatchObject([{ clause: '9.1.1.1', status: 'confirmed' }]);
    expect(trace.legal.map((l) => l.articleRef)).toEqual([
      'art. 3 alin. (2) lit. a)',
      'art. 5 alin. (1)',
    ]);
    expect(trace.applicability.status).toBe('not_assessed');
    expect(trace.remediation?.titleRo).toBe('Imaginile trebuie să aibă text alternativ');
  });

  it('nu leaga de lege o regula de buna practica', () => {
    const trace = buildTrace({
      axeRuleId: 'region',
      axeTags: rule('region').tags,
      wcagCriteria: [],
      docsUrl: 'https://dequeuniversity.com/rules/axe/4.13/region',
      engineVersion: '4.13.0',
    });

    expect(trace.isBestPractice).toBe(true);
    expect(trace.wcag).toEqual([]);
    expect(trace.en).toEqual([]);
    expect(trace.legal).toEqual([]);
  });

  it('nu citeaza standardul armonizat pentru un criteriu fara clauza EN (ex. 2.5.8)', () => {
    const trace = buildTrace({
      axeRuleId: 'target-size',
      axeTags: rule('target-size').tags,
      wcagCriteria: ['2.5.8'],
      docsUrl: 'https://dequeuniversity.com/rules/axe/4.13/target-size',
      engineVersion: '4.13.0',
    });

    expect(trace.en).toMatchObject([{ clause: null, status: 'none' }]);
    expect(trace.legal.map((l) => l.articleRef)).toEqual(['art. 3 alin. (2) lit. b)']);
  });
});
