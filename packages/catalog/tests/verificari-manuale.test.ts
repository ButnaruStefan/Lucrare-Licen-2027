/**
 * Testele verificarilor manuale (datele din catalog):
 *   - sunt exact cele 6 verificari din contractul comun, in aceeasi ordine;
 *   - fiecare criteriu WCAG exista in catalogul generat din W3C, la nivel A sau AA;
 *   - fiecare verificare are pasi, conditia de trecere si surse oficiale W3C;
 *   - "nu se aplica" e detectat doar din ce contine pagina: imagini si campuri de formular.
 */
import { describe, expect, it } from 'vitest';
import { MANUAL_CHECK_IDS, type PageFacts } from '@ro-a11y/shared';
import {
  autoNotApplicableReason,
  MANUAL_CHECKS,
  manualCheckCriteria,
  manualCheckDefinition,
  wcagCriterion,
} from '../src/index';

const EMPTY: PageFacts = {
  images: 0,
  forms: 0,
  formFields: 0,
  headings: [],
  headingsTruncated: false,
};

describe('verificarile manuale', () => {
  it('sunt cele 6 verificari din contractul comun, in aceeasi ordine', () => {
    expect(MANUAL_CHECKS.map((c) => c.id)).toEqual([...MANUAL_CHECK_IDS]);
  });

  it('fiecare criteriu exista in catalogul WCAG 2.2, la nivel A sau AA, cu titlul oficial', () => {
    for (const check of MANUAL_CHECKS) {
      expect(check.criteria.length).toBeGreaterThan(0);
      for (const number of check.criteria) {
        const criterion = wcagCriterion(number);
        expect(criterion, number).not.toBeNull();
        expect(['A', 'AA']).toContain(criterion!.level);
      }
      for (const c of manualCheckCriteria(check)) {
        expect(c.titleEn).not.toBe(c.number);
        expect(c.understandingUrl).toMatch(/^https:\/\/www\.w3\.org\//);
      }
    }
    // Ex.: tastatura = 2.1.1 Keyboard (A) si 2.1.2 No Keyboard Trap (A)
    expect(manualCheckCriteria(manualCheckDefinition('tastatura')!)).toMatchObject([
      { number: '2.1.1', titleEn: 'Keyboard', level: 'A' },
      { number: '2.1.2', titleEn: 'No Keyboard Trap', level: 'A' },
    ]);
  });

  it('fiecare verificare are pasi, conditia de trecere si surse oficiale W3C', () => {
    for (const check of MANUAL_CHECKS) {
      expect(check.steps.length).toBeGreaterThanOrEqual(3);
      expect(check.passWhen.length).toBeGreaterThan(10);
      expect(check.sources.length).toBeGreaterThan(0);
      for (const source of check.sources) {
        expect(source.url).toMatch(/^https:\/\/www\.w3\.org\//);
      }
    }
  });

  it('"nu se aplica" e detectat doar pentru imagini si campuri de formular', () => {
    const reasons = MANUAL_CHECKS.map((c) => [c.id, autoNotApplicableReason(c, EMPTY)]);
    expect(Object.fromEntries(reasons)).toEqual({
      tastatura: null,
      focus: null,
      'text-alternativ': 'Pagina nu are imagini (detectat automat la scanare).',
      'erori-formulare': 'Pagina nu are câmpuri de formular (detectat automat la scanare).',
      'zoom-reflow': null,
      // O pagina fara titluri in cod tot trebuie verificata (titluri doar vizuale = problema)
      titluri: null,
    });

    const full = { ...EMPTY, images: 3, formFields: 2 };
    expect(MANUAL_CHECKS.every((c) => autoNotApplicableReason(c, full) === null)).toBe(true);
    // Scanare mai veche, fara date despre pagina: totul ramane de facut
    expect(MANUAL_CHECKS.every((c) => autoNotApplicableReason(c, null) === null)).toBe(true);
  });
});
