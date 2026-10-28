/**
 * Testele profilului juridic OUG 112/2018:
 *   - fiecare citat folosit de evaluare apare exact in textul oficial salvat;
 *   - fiecare combinatie importanta de raspunsuri da statusul asteptat;
 *   - un "Nu stiu" nu e niciodata transformat intr-o presupunere;
 *   - validarea raspunsurilor cere doar intrebarile care se aplica;
 *   - lantul de trasabilitate preia evaluarea profilului.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { legalProfileAnswersSchema, QUESTION_IDS, type LegalProfileAnswers } from '@ro-a11y/shared';
import { buildTrace, evaluateOug112, OUG_112_QUESTIONS, OUG_112_QUOTES } from '../src/index';

const official = readFileSync(
  new URL('../src/data/oug-112-2018-art1-5.txt', import.meta.url),
  'utf-8',
).replace(/\s+/g, ' ');

describe('citatele folosite de profilul juridic', () => {
  it.each(Object.entries(OUG_112_QUOTES))('%s apare exact in textul oficial', (_key, quote) => {
    expect(official).toContain(quote.quote);
  });
});

describe('chestionarul', () => {
  it('are cate o intrebare pentru fiecare raspuns posibil, in ordinea din contract', () => {
    expect(OUG_112_QUESTIONS.map((q) => q.id)).toEqual([...QUESTION_IDS]);
  });

  it('ofera "Nu stiu" la fiecare intrebare (nu fortam un raspuns)', () => {
    for (const question of OUG_112_QUESTIONS) {
      expect(question.options.map((o) => o.value)).toContain('unknown');
    }
  });
});

describe('validarea raspunsurilor', () => {
  it('cere intrebarile care se aplica unei institutii publice', () => {
    const result = legalProfileAnswersSchema.safeParse({ organizationType: 'public_authority' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.')).sort()).toEqual([
      'audience',
      'publicBroadcaster',
    ]);
  });

  it('cere intrebarile despre ONG-uri doar pentru ONG-uri', () => {
    const result = legalProfileAnswersSchema.safeParse({
      organizationType: 'non_profit',
      publicBroadcaster: 'no',
      audience: 'public',
    });
    expect(result.error?.issues.map((i) => i.path.join('.')).sort()).toEqual([
      'nonProfitDisabilityServices',
      'nonProfitEssentialServices',
    ]);
  });

  it('ignora raspunsurile la intrebari care nu se aplica', () => {
    const result = legalProfileAnswersSchema.parse({
      organizationType: 'private',
      publicBroadcaster: 'yes',
      audience: 'public',
    });
    expect(result).toEqual({ organizationType: 'private' });
  });

  it('respinge valorile necunoscute', () => {
    expect(legalProfileAnswersSchema.safeParse({ organizationType: 'primarie' }).success).toBe(
      false,
    );
  });
});

describe('evaluateOug112', () => {
  const publicSite: LegalProfileAnswers = {
    organizationType: 'public_authority',
    publicBroadcaster: 'no',
    audience: 'public',
  };

  it('institutie publica, site public -> aplicabila, cu temei si note', () => {
    const result = evaluateOug112(publicSite);
    expect(result.status).toBe('applicable');
    expect(result.reasons.map((r) => r.articleRef)).toEqual(['art. 2 lit. a)']);
    expect(result.notes.map((n) => n.articleRef)).toEqual(['art. 1 alin. (4)', 'art. 4 alin. (1)']);
    expect(result.toConfirm.length).toBeGreaterThan(0);
    expect(result.disclaimer).toMatch(/nu este consultanță juridică/i);
  });

  it.each([
    ['public_law_body', 'art. 2 lit. a)'],
    ['public_association', 'art. 2 lit. a)'],
  ] as const)(
    '%s -> posibil aplicabila (incadrarea trebuie confirmata)',
    (organizationType, ref) => {
      const result = evaluateOug112({ ...publicSite, organizationType });
      expect(result.status).toBe('possibly_applicable');
      expect(result.reasons[0]?.articleRef).toBe(ref);
      expect(result.toConfirm.length).toBeGreaterThan(0);
    },
  );

  it('administrator privat -> neaplicabila, cu trimitere la Legea 232/2022 ca informatie', () => {
    const result = evaluateOug112({ organizationType: 'private' });
    expect(result.status).toBe('not_applicable');
    expect(result.reasons[0]?.articleRef).toBe('art. 1 alin. (1)');
    expect(result.notes[0]?.articleRef).toBe('Legea nr. 232/2022');
  });

  it('administrator necunoscut -> informatii insuficiente', () => {
    const result = evaluateOug112({ organizationType: 'unknown' });
    expect(result.status).toBe('insufficient_information');
    expect(result.missingFacts).toHaveLength(1);
  });

  it('serviciu public de radiodifuziune -> neaplicabila (art. 1 alin. 3 lit. a)', () => {
    const result = evaluateOug112({ ...publicSite, publicBroadcaster: 'yes' });
    expect(result.status).toBe('not_applicable');
    expect(result.reasons.map((r) => r.articleRef)).toEqual(['art. 1 alin. (3) lit. a)']);
  });

  it('intranet vechi, nerevizuit -> neaplicabila (art. 1 alin. 4 lit. g)', () => {
    const result = evaluateOug112({ ...publicSite, audience: 'restricted_old' });
    expect(result.status).toBe('not_applicable');
    expect(result.reasons.map((r) => r.articleRef)).toEqual(['art. 1 alin. (4) lit. g)']);
  });

  it('intranet nou -> nu e exceptat', () => {
    expect(evaluateOug112({ ...publicSite, audience: 'restricted_new' }).status).toBe('applicable');
  });

  it('un "Nu stiu" -> informatii insuficiente, cu faptul lipsa numit', () => {
    const result = evaluateOug112({ ...publicSite, publicBroadcaster: 'unknown' });
    expect(result.status).toBe('insufficient_information');
    expect(result.missingFacts).toEqual([
      'Dacă site-ul aparține unui serviciu public de radiodifuziune.',
    ]);
  });

  it('o exceptie sigura conteaza mai mult decat un "Nu stiu"', () => {
    const result = evaluateOug112({
      ...publicSite,
      publicBroadcaster: 'yes',
      audience: 'unknown',
    });
    expect(result.status).toBe('not_applicable');
  });

  describe('organizatii fara scop patrimonial', () => {
    const ngo = (essential: 'yes' | 'no' | 'unknown', disability: 'yes' | 'no' | 'unknown') =>
      evaluateOug112({
        organizationType: 'non_profit',
        publicBroadcaster: 'no',
        nonProfitEssentialServices: essential,
        nonProfitDisabilityServices: disability,
        audience: 'public',
      });

    it('fara niciunul dintre cele doua tipuri de servicii -> neaplicabila (lit. b si c)', () => {
      const result = ngo('no', 'no');
      expect(result.status).toBe('not_applicable');
      expect(result.reasons.map((r) => r.articleRef)).toEqual([
        'art. 1 alin. (3) lit. b)',
        'art. 1 alin. (3) lit. c)',
      ]);
    });

    it.each([
      ['yes', 'no'],
      ['no', 'yes'],
      ['yes', 'yes'],
    ] as const)(
      'servicii esentiale=%s, pentru dizabilitati=%s -> posibil aplicabila, cu interpretarea de confirmat',
      (essential, disability) => {
        const result = ngo(essential, disability);
        expect(result.status).toBe('possibly_applicable');
        expect(result.toConfirm.join(' ')).toMatch(/lit\. b\) și c\)/);
      },
    );

    it('un "Nu stiu" -> informatii insuficiente', () => {
      expect(ngo('unknown', 'yes').status).toBe('insufficient_information');
    });
  });
});

describe('buildTrace cu profil juridic', () => {
  const input = {
    axeRuleId: 'image-alt',
    axeTags: ['wcag2a', 'wcag111', 'EN-9.1.1.1'],
    wcagCriteria: ['1.1.1'],
    docsUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
    engineVersion: '4.13.0',
  };

  it('fara profil: aplicabilitatea e "neevaluata"', () => {
    const trace = buildTrace(input);
    expect(trace.applicability).toMatchObject({ status: 'not_assessed', assessedAt: null });
  });

  it('cu profil: preia statusul si rezumatul evaluarii', () => {
    const assessment = evaluateOug112({
      organizationType: 'public_authority',
      publicBroadcaster: 'no',
      audience: 'public',
    });
    const trace = buildTrace({
      ...input,
      legalAssessment: { assessment, assessedAt: '2026-10-28T10:00:00.000Z' },
    });
    expect(trace.applicability).toEqual({
      status: 'applicable',
      message: assessment.summary,
      assessedAt: '2026-10-28T10:00:00.000Z',
    });
  });
});
