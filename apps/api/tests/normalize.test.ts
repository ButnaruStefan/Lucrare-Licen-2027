/**
 * Teste pentru normalizarea rezultatelor axe-core (fara browser si fara baza de date).
 */
import type { AxeResults, Result } from 'axe-core';
import { describe, expect, it } from 'vitest';
import {
  elementFingerprint,
  isBestPractice,
  MAX_HTML_LENGTH,
  normalizeAxeResults,
  wcagCriteriaFromTags,
} from '../src/scanner/normalize';

describe('wcagCriteriaFromTags', () => {
  it('extrage criteriile si ignora etichetele de nivel', () => {
    expect(wcagCriteriaFromTags(['wcag2a', 'wcag111', 'cat.text-alternatives'])).toEqual(['1.1.1']);
    expect(wcagCriteriaFromTags(['wcag2aa', 'wcag21aa', 'wcag1410'])).toEqual(['1.4.10']);
    expect(wcagCriteriaFromTags(['wcag244', 'wcag412'])).toEqual(['2.4.4', '4.1.2']);
    expect(wcagCriteriaFromTags(['best-practice'])).toEqual([]);
  });
});

describe('elementFingerprint', () => {
  it('e aceeasi pentru aceeasi pagina, regula si element (fragmentul # nu conteaza)', () => {
    const a = elementFingerprint('https://exemplu.ro/p#sus', 'image-alt', ['img.hero']);
    const b = elementFingerprint('https://exemplu.ro/p', 'image-alt', ['img.hero']);
    expect(a).toBe(b);
  });

  it('difera daca se schimba elementul sau regula', () => {
    const base = elementFingerprint('https://exemplu.ro/', 'image-alt', ['img.hero']);
    expect(elementFingerprint('https://exemplu.ro/', 'image-alt', ['img.logo'])).not.toBe(base);
    expect(elementFingerprint('https://exemplu.ro/', 'link-name', ['img.hero'])).not.toBe(base);
  });
});

function rule(partial: Partial<Result>): Result {
  return {
    id: 'image-alt',
    impact: 'critical',
    tags: ['wcag2a', 'wcag111'],
    description: 'descriere',
    help: 'Imaginile trebuie sa aiba text alternativ',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
    nodes: [],
    ...partial,
  } as Result;
}

describe('normalizeAxeResults', () => {
  const longHtml = `<img src="x.png" data-lung="${'a'.repeat(2000)}">`;
  const raw = {
    violations: [
      rule({
        nodes: [
          {
            target: ['img'],
            html: longHtml,
            failureSummary: 'Lipseste atributul alt',
            impact: 'critical',
            any: [],
            all: [],
            none: [],
          },
        ],
      }),
    ],
    incomplete: [rule({ id: 'color-contrast', impact: 'serious', tags: ['wcag2aa', 'wcag143'] })],
    passes: [rule({ id: 'document-title', impact: null, tags: ['wcag2a', 'wcag242'] })],
    inapplicable: [rule({ id: 'video-caption', impact: null, tags: ['wcag2a', 'wcag122'] })],
  } as unknown as AxeResults;

  const results = normalizeAxeResults(raw, 'https://exemplu.ro/');

  it('pastreaza toate cele patru categorii', () => {
    expect(results.map((r) => [r.axeRuleId, r.category])).toEqual([
      ['image-alt', 'violation'],
      ['color-contrast', 'incomplete'],
      ['document-title', 'pass'],
      ['video-caption', 'inapplicable'],
    ]);
  });

  it('pastreaza elementele doar pentru violation si incomplete', () => {
    expect(results[0]!.elements).toHaveLength(1);
    expect(results[2]!.elements).toEqual([]);
    expect(results[2]!.impact).toBeNull();
  });

  it('trunchiaza fragmentul HTML prea lung', () => {
    const snippet = results[0]!.elements[0]!.htmlSnippet;
    expect(snippet.length).toBe(MAX_HTML_LENGTH + 1);
    expect(snippet.endsWith('…')).toBe(true);
  });

  it('copiaza titlul, documentatia si criteriile WCAG', () => {
    expect(results[0]).toMatchObject({
      title: 'Imaginile trebuie sa aiba text alternativ',
      docsUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
      wcagCriteria: ['1.1.1'],
    });
  });
});

describe('isBestPractice', () => {
  it('e adevarat doar pentru reguli fara criteriu WCAG, marcate "best-practice"', () => {
    expect(isBestPractice(['best-practice', 'cat.semantics'], [])).toBe(true);
    expect(isBestPractice(['wcag2a', 'wcag111'], ['1.1.1'])).toBe(false);
  });
});
