/**
 * Prevederile din OUG 112/2018 folosite in lantul de trasabilitate.
 *
 * Citatele sunt copiate EXACT din forma printabila de pe Portalul Legislativ (legislatie.just.ro),
 * consultata la data din `retrievedAt`. Statusul spune ce s-a verificat:
 *   - textul citat e verificat (exista in sursa oficiala, exact asa);
 *   - legatura cu o problema concreta e o INTERPRETARE care trebuie validata de un specialist
 *     si depinde de profilul organizatiei (ex. daca e organism din sectorul public, art. 2 lit. a).
 *
 * Nicio prevedere de aici nu inseamna ca un site "incalca legea": constatarile automate sunt
 * tehnice, iar aplicabilitatea legii depinde de cine administreaza site-ul.
 */
import type { WcagPrinciple } from './wcag';

export const OUG_112_2018 = {
  id: 'RO_OUG_112_2018',
  name: 'OUG nr. 112/2018 privind accesibilitatea site-urilor web și a aplicațiilor mobile ale organismelor din sectorul public',
  publishedIn: 'Monitorul Oficial nr. 1105 din 27 decembrie 2018',
  sourceUrl: 'https://legislatie.just.ro/Public/FormaPrintabila/00000G02CM5N2ASUGXA03X7D7GGJ7I6F',
  retrievedAt: '2026-10-16',
  note:
    'Text consultat în forma printabilă de pe Portalul Legislativ. De verificat dacă forma ' +
    'consolidată (după aprobarea prin Legea nr. 90/2019) modifică articolele citate.',
} as const;

export type LegalReviewStatus = 'text_verified_relevance_to_validate';

export interface LegalProvision {
  framework: typeof OUG_112_2018.id;
  articleRef: string;
  quote: string;
  explanation: string;
  sourceUrl: string;
  retrievedAt: string;
  reviewStatus: LegalReviewStatus;
}

const base = {
  framework: OUG_112_2018.id,
  sourceUrl: OUG_112_2018.sourceUrl,
  retrievedAt: OUG_112_2018.retrievedAt,
  reviewStatus: 'text_verified_relevance_to_validate' as const,
};

/** Art. 3 alin. (2): cele patru principii, identice ca sens cu principiile WCAG. */
const PRINCIPLE_PROVISIONS: Record<WcagPrinciple, LegalProvision> = {
  perceptibil: {
    ...base,
    articleRef: 'art. 3 alin. (2) lit. a)',
    quote:
      'perceptibilitatea - informațiile și componentele interfeței de utilizare trebuie să poată fi prezentate utilizatorilor în moduri pe care aceștia le pot percepe',
    explanation:
      'Criteriul WCAG face parte din principiul „Perceptibil”, corespondentul principiului din lege.',
  },
  operabil: {
    ...base,
    articleRef: 'art. 3 alin. (2) lit. b)',
    quote:
      'operabilitatea - componentele interfeței de utilizare și navigarea trebuie să poată fi utilizate',
    explanation:
      'Criteriul WCAG face parte din principiul „Operabil”, corespondentul principiului din lege.',
  },
  inteligibil: {
    ...base,
    articleRef: 'art. 3 alin. (2) lit. c)',
    quote:
      'inteligibilitatea - informațiile și exploatarea interfeței de utilizare trebuie să poată fi înțelese',
    explanation:
      'Criteriul WCAG face parte din principiul „Inteligibil”, corespondentul principiului din lege.',
  },
  robust: {
    ...base,
    articleRef: 'art. 3 alin. (2) lit. d)',
    quote:
      'robustețea - întreg conținutul trebuie să fie suficient de robust încât să poată fi interpretat în mod fiabil de o gamă largă de agenți utilizatori, inclusiv de tehnologiile de asistare',
    explanation:
      'Criteriul WCAG face parte din principiul „Robust”, corespondentul principiului din lege.',
  },
};

/** Art. 5 alin. (1): prezumtia de conformitate prin standardele armonizate (EN 301 549). */
export const HARMONISED_STANDARD_PROVISION: LegalProvision = {
  ...base,
  articleRef: 'art. 5 alin. (1)',
  quote:
    'Conținutul site-urilor web și al aplicațiilor mobile care respectă standardele armonizate sau părți ale acestora, ale căror referințe au fost publicate de către Comisia Europeană în Jurnalul Oficial al Uniunii Europene […] este considerat a fi în conformitate cu cerințele privind accesibilitatea reglementate la art. 3',
  explanation:
    'Leagă legea de EN 301 549: standardul armonizat publicat în Jurnalul Oficial (V3.2.1, prin Decizia (UE) 2021/1339) oferă prezumția de conformitate.',
};

/** Prevederile relevante pentru un criteriu WCAG din principiul dat. */
export function legalProvisionsFor(
  principle: WcagPrinciple,
  hasEnClause: boolean,
): LegalProvision[] {
  const provisions = [PRINCIPLE_PROVISIONS[principle]];
  if (hasEnClause) provisions.push(HARMONISED_STANDARD_PROVISION);
  return provisions;
}
