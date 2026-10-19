/**
 * Legatura criteriu WCAG -> clauza EN 301 549, editia V3.2.1 (2021-03).
 *
 * De ce aceasta editie: Decizia de punere in aplicare (UE) 2021/1339 a Comisiei (11 august 2021)
 * a publicat in Jurnalul Oficial EN 301 549 V3.2.1 ca standard armonizat pentru site-urile si
 * aplicatiile mobile ale organismelor din sectorul public (Directiva (UE) 2016/2102, transpusa
 * in Romania prin OUG 112/2018). Text verificat pe EUR-Lex.
 *
 * Cum se face legatura: in capitolul 9 (Web) al standardului, fiecare criteriu WCAG 2.1 de
 * nivel A sau AA are o clauza numerotata "9." + numarul criteriului (ex. 1.1.1 -> 9.1.1.1).
 * Editia V3.2.1 se bazeaza pe WCAG 2.1, deci criteriile noi din WCAG 2.2 nu au clauza in ea.
 *
 * Statusul fiecarei legaturi:
 *   - "confirmed": doua surse independente coincid: regula de numerotare de mai sus SI
 *     eticheta EN pe care axe-core (Deque) o pune pe regula care a gasit problema;
 *   - "derived": rezulta doar din regula de numerotare; trebuie verificata in textul standardului;
 *   - "none": criteriul nu are clauza in aceasta editie (ex. criteriile noi din WCAG 2.2);
 *   - "conflict": sursele nu coincid (regula de numerotare spune ca nu exista clauza, dar
 *     axe-core pune totusi o eticheta EN); trebuie verificat in textul standardului.
 */
import wcag from './data/wcag22.json' with { type: 'json' };

export const EN_EDITION = {
  standard: 'EN 301 549',
  version: 'V3.2.1 (2021-03)',
  title: 'Accessibility requirements for ICT products and services',
  basedOn: 'WCAG 2.1',
  harmonisedBy: 'Decizia de punere în aplicare (UE) 2021/1339 a Comisiei din 11 august 2021',
  harmonisedBySourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32021D1339',
  standardSourceUrl:
    'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf',
  verifiedAt: '2026-10-16',
  note:
    'Decizia 2021/1339 a fost verificată pe EUR-Lex. Textul standardului (PDF ETSI) nu a putut fi ' +
    'descărcat din rețeaua de dezvoltare; numerotarea clauzelor e confirmată prin etichetele ' +
    'axe-core. De reverificat înainte de susținere dacă a fost citată o ediție mai nouă.',
} as const;

export type EnLinkStatus = 'confirmed' | 'derived' | 'none' | 'conflict';

export interface EnClauseLink {
  clause: string | null;
  status: EnLinkStatus;
  explanation: string;
}

/** Criteriile WCAG 2.1 de nivel A sau AA = criteriile care au clauza in capitolul 9 din V3.2.1. */
const CRITERIA_WITH_CLAUSE = new Set(
  wcag.criteria
    .filter((c) => c.inWcag21 && (c.levelInWcag21 === 'A' || c.levelInWcag21 === 'AA'))
    .map((c) => c.number),
);

/** Toate clauzele web (capitolul 9) ale editiei V3.2.1, deduse din criteriile WCAG 2.1 A/AA. */
export function allWebClauses(): string[] {
  return [...CRITERIA_WITH_CLAUSE].map((n) => `9.${n}`);
}

/**
 * Clauza EN pentru un criteriu WCAG, cu statusul verificarii.
 * `axeTags` = etichetele regulii axe care a gasit problema (ex. ["wcag2a", "EN-9.1.1.1"]).
 */
export function enClauseFor(wcagNumber: string, axeTags: readonly string[]): EnClauseLink {
  if (!CRITERIA_WITH_CLAUSE.has(wcagNumber)) {
    if (axeTags.includes(`EN-9.${wcagNumber}`)) {
      return {
        clause: `9.${wcagNumber}`,
        status: 'conflict',
        explanation:
          'Sursele nu coincid: după regula de numerotare criteriul nu are clauză în V3.2.1 (nivel AAA sau nou în WCAG 2.2), dar axe-core îl etichetează cu o clauză EN. De verificat în textul standardului.',
      };
    }
    return {
      clause: null,
      status: 'none',
      explanation:
        'Criteriul nu are clauză în EN 301 549 V3.2.1 (ediția se bazează pe WCAG 2.1; criteriul e nou în WCAG 2.2 sau are nivel AAA).',
    };
  }
  const clause = `9.${wcagNumber}`;
  if (axeTags.includes(`EN-${clause}`)) {
    return {
      clause,
      status: 'confirmed',
      explanation:
        'Confirmat de două surse independente: regula de numerotare a standardului și eticheta EN a regulii axe-core.',
    };
  }
  return {
    clause,
    status: 'derived',
    explanation:
      'Dedus din regula de numerotare a standardului (9. + criteriul WCAG); de verificat în textul standardului.',
  };
}
