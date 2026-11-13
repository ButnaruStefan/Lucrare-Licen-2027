/**
 * Teste pentru re-verificarea contrastului pe ecran (partea fara browser): ce elemente se
 * re-verifica si cum se inlocuieste rezultatul vechi cu cel nou in raspunsul axe-core.
 * Partea cu browser (pagina reala care estompeaza o sectiune) e in `capture.e2e.test.ts`.
 */
import type { AxeResults, NodeResult, Result } from 'axe-core';
import { describe, expect, it } from 'vitest';
import {
  applyContrastRecheck,
  contrastTargets,
  type RecheckedNode,
} from '../src/scanner/contrast-recheck';

function node(target: unknown, impact: NodeResult['impact'] = 'serious'): NodeResult {
  return { target, html: '<p>', impact, any: [], all: [], none: [] } as unknown as NodeResult;
}

function rule(id: string, nodes: NodeResult[], impact: Result['impact'] = 'serious'): Result {
  return {
    id,
    impact,
    tags: ['wcag2aa', 'wcag143'],
    description: 'd',
    help: 'h',
    helpUrl: 'u',
    nodes,
  } as Result;
}

function results(parts: Partial<AxeResults>): AxeResults {
  return { violations: [], incomplete: [], passes: [], inapplicable: [], ...parts } as AxeResults;
}

const rechecked = (entries: Array<[unknown, RecheckedNode]>) =>
  new Map(entries.map(([target, value]) => [JSON.stringify(target), value]));

describe('contrastTargets', () => {
  it('ia doar elementele semnalate la contrast, fara cele din iframe-uri', () => {
    const raw = results({
      violations: [
        rule('color-contrast', [node(['.a']), node(['iframe', '.b'])]),
        rule('image-alt', [node(['img'])]),
      ],
      incomplete: [rule('color-contrast', [node(['.c'])])],
    });
    expect([...contrastTargets(raw).values()]).toEqual([['.a'], ['.c']]);
  });
});

describe('applyContrastRecheck', () => {
  it('un element care trece pe ecran iese din probleme si ajunge la "trece"', () => {
    const raw = results({
      violations: [rule('color-contrast', [node(['.a']), node(['.b'])])],
      passes: [rule('color-contrast', [node(['.ok'], null)], null)],
    });
    const out = applyContrastRecheck(
      raw,
      rechecked([[['.a'], { category: 'pass', node: node(['.a'], null) }]]),
    );
    expect(out.changed).toBe(1);
    expect(out.raw.violations[0]!.nodes.map((n) => n.target)).toEqual([['.b']]);
    expect(out.raw.passes[0]!.nodes.map((n) => n.target)).toEqual([['.a'], ['.ok']]);
  });

  it('daca toate elementele trec, regula dispare din probleme si apare la "trece"', () => {
    const raw = results({
      violations: [rule('image-alt', [node(['img'])]), rule('color-contrast', [node(['.a'])])],
    });
    const out = applyContrastRecheck(
      raw,
      rechecked([[['.a'], { category: 'pass', node: node(['.a'], null) }]]),
    );
    expect(out.raw.violations.map((r) => r.id)).toEqual(['image-alt']);
    expect(out.raw.passes.map((r) => r.id)).toEqual(['color-contrast']);
    expect(out.raw.passes[0]!.impact).toBeNull();
  });

  it('un element "de verificat" poate deveni problema; gravitatea regulii se recalculeaza', () => {
    const raw = results({
      violations: [rule('color-contrast', [node(['.a'], 'moderate')], 'moderate')],
      incomplete: [rule('color-contrast', [node(['.b'])])],
    });
    const out = applyContrastRecheck(
      raw,
      rechecked([[['.b'], { category: 'violation', node: node(['.b'], 'critical') }]]),
    );
    expect(out.raw.violations[0]!.nodes.map((n) => n.target)).toEqual([['.a'], ['.b']]);
    expect(out.raw.violations[0]!.impact).toBe('critical');
    expect(out.raw.incomplete).toEqual([]);
  });

  it('elementele care nu au fost re-verificate (nu au ajuns pe ecran) raman neschimbate', () => {
    const raw = results({ violations: [rule('color-contrast', [node(['.a'])])] });
    const out = applyContrastRecheck(raw, new Map());
    expect(out).toEqual({ raw, changed: 0 });
  });

  it('acelasi rezultat ca inainte nu se numara ca schimbare (dar foloseste masuratoarea noua)', () => {
    const before = node(['.a']);
    const after = { ...node(['.a']), html: '<p class="nou">' } as NodeResult;
    const raw = results({ violations: [rule('color-contrast', [before])] });
    const out = applyContrastRecheck(
      raw,
      rechecked([[['.a'], { category: 'violation', node: after }]]),
    );
    expect(out.changed).toBe(0);
    expect(out.raw.violations[0]!.nodes).toEqual([after]);
  });
});
