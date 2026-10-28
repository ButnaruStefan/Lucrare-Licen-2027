/**
 * Profilul juridic OUG 112/2018: intrebarile chestionarului si regulile care transforma
 * raspunsurile intr-o evaluare a aplicabilitatii legii pentru un site.
 *
 * Folosit de API (ruta /legal-profile) si, indirect, de lantul de trasabilitate (pasul
 * "Aplicabilitate pentru acest site").
 *
 * Reguli de prudenta:
 *   - evaluarea se bazeaza DOAR pe raspunsurile declarate; nu ghicim nimic;
 *   - orice "Nu stiu" duce la "informatii insuficiente", nu la o presupunere;
 *   - fiecare argument citeaza exact articolul din textul oficial (verificat de teste fata de
 *     `data/oug-112-2018-art1-5.txt`);
 *   - rezultatul cere mereu confirmare umana si nu e o concluzie juridica.
 *
 * Ordinea regulilor:
 *   1. administrator necunoscut -> informatii insuficiente;
 *   2. administrator privat -> neaplicabila (legea priveste organismele din sectorul public);
 *   3. o exceptie de la art. 1 confirmata prin raspunsuri -> neaplicabila;
 *   4. un raspuns "Nu stiu" la o intrebare relevanta -> informatii insuficiente;
 *   5. autoritate sau institutie publica -> aplicabila (conform raspunsurilor);
 *   6. organism de drept public, asociatie sau ONG -> posibil aplicabila (incadrarea trebuie
 *      confirmata de un specialist).
 */
import type { LegalAssessment, LegalProfileAnswers, LegalReason, Question } from '@ro-a11y/shared';
import { OUG_112_2018 } from './legislatie';
import { CATALOG_VERSION } from './trace';

/** Citatele exacte folosite de evaluare (verificate de teste fata de textul oficial). */
export const OUG_112_QUOTES = {
  objective: {
    articleRef: 'art. 1 alin. (1)',
    quote:
      'Prezenta ordonanță de urgență are drept obiectiv stabilirea cerințelor privind accesibilitatea site-urilor web și a aplicațiilor mobile ale organismelor din sectorul public',
  },
  publicBody: {
    articleRef: 'art. 2 lit. a)',
    quote:
      'organism din sectorul public - autoritățile și instituțiile publice centrale sau locale, organismele de drept public, astfel cum sunt definite la art. 4 alin. (2) din Legea nr. 98/2016 privind achizițiile publice',
  },
  association: {
    articleRef: 'art. 2 lit. a)',
    quote:
      'asociațiile formate din una sau mai multe astfel de autorități ori din unul sau mai multe astfel de organisme de drept public, dacă respectivele asociații sunt instituite cu scopul explicit de a răspunde nevoilor de interes general, neavând un caracter industrial sau comercial',
  },
  broadcaster: {
    articleRef: 'art. 1 alin. (3) lit. a)',
    quote:
      'site-urile web și aplicațiile mobile ale serviciilor publice de radiodifuziune și ale filialelor societăților care prestează astfel de servicii',
  },
  nonProfitEssential: {
    articleRef: 'art. 1 alin. (3) lit. b)',
    quote:
      'site-urile web și aplicațiile mobile ale persoanelor juridice fără scop patrimonial care nu prestează servicii esențiale pentru public',
  },
  nonProfitDisability: {
    articleRef: 'art. 1 alin. (3) lit. c)',
    quote:
      'site-urile web și aplicațiile mobile ale persoanelor juridice fără scop patrimonial care nu prestează servicii care vizează în mod specific nevoile persoanelor cu dizabilități sau care le sunt destinate acestora',
  },
  intranet: {
    articleRef: 'art. 1 alin. (4) lit. g)',
    quote:
      'conținutul site-urilor de tip extranet și intranet, și anume al site-urilor web disponibile numai pentru un grup restrâns de persoane, și nu publicului larg ca atare, publicat înainte de 23 septembrie 2019, până în momentul în care astfel de site-uri web fac obiectul unei revizuiri substanțiale',
  },
  contentExceptions: {
    articleRef: 'art. 1 alin. (4)',
    quote:
      'Prezenta ordonanță de urgență nu se aplică următoarelor tipuri de conținut al site-urilor web și al aplicațiilor mobile',
  },
  disproportionateBurden: {
    articleRef: 'art. 4 alin. (1)',
    quote:
      'Organismele din sectorul public aplică cerințele privind accesibilitatea prevăzute la art. 3, în măsura în care aplicarea acestor cerințe nu impune o sarcină disproporționată.',
  },
} as const;

type QuoteKey = keyof typeof OUG_112_QUOTES;

function reason(code: string, key: QuoteKey, text: string): LegalReason {
  return { code, text, ...OUG_112_QUOTES[key] };
}

const YES_NO_UNKNOWN_OPTIONS = [
  { value: 'yes', label: 'Da' },
  { value: 'no', label: 'Nu' },
  { value: 'unknown', label: 'Nu știu' },
];

/** Intrebarile chestionarului, in ordinea afisarii. */
export const OUG_112_QUESTIONS: Question[] = [
  {
    id: 'organizationType',
    text: 'Cine administrează site-ul?',
    help: 'Legea se aplică organismelor din sectorul public. Alege varianta care descrie cel mai bine organizația.',
    articleRef: 'art. 2 lit. a)',
    options: [
      {
        value: 'public_authority',
        label: 'O autoritate sau instituție publică, centrală ori locală',
        help: 'Ex. minister, primărie, consiliu județean, școală sau universitate de stat, spital public.',
      },
      {
        value: 'public_law_body',
        label: 'Un organism de drept public',
        help: 'Ex. o companie sau o regie înființată pentru nevoi de interes general și finanțată ori controlată de stat (definiția din Legea nr. 98/2016, art. 4 alin. (2)).',
      },
      {
        value: 'public_association',
        label: 'O asociație formată din autorități sau organisme publice',
        help: 'Ex. o asociație de dezvoltare intercomunitară, înființată pentru nevoi de interes general.',
      },
      {
        value: 'non_profit',
        label: 'O organizație fără scop patrimonial (asociație, fundație, ONG)',
      },
      {
        value: 'private',
        label: 'O firmă privată sau o persoană fizică',
      },
      { value: 'unknown', label: 'Nu știu' },
    ],
  },
  {
    id: 'publicBroadcaster',
    text: 'Este site-ul unui serviciu public de radiodifuziune (radio sau televiziune publică) ori al unei filiale a acestuia?',
    help: 'Site-urile serviciilor publice de radiodifuziune sunt exceptate de lege.',
    articleRef: 'art. 1 alin. (3) lit. a)',
    options: YES_NO_UNKNOWN_OPTIONS,
  },
  {
    id: 'nonProfitEssentialServices',
    text: 'Organizația prestează servicii esențiale pentru public?',
    help: 'Site-urile organizațiilor fără scop patrimonial care nu prestează servicii esențiale pentru public sunt exceptate.',
    articleRef: 'art. 1 alin. (3) lit. b)',
    options: YES_NO_UNKNOWN_OPTIONS,
  },
  {
    id: 'nonProfitDisabilityServices',
    text: 'Organizația prestează servicii destinate în mod specific persoanelor cu dizabilități?',
    help: 'Site-urile organizațiilor fără scop patrimonial care nu prestează astfel de servicii sunt exceptate.',
    articleRef: 'art. 1 alin. (3) lit. c)',
    options: YES_NO_UNKNOWN_OPTIONS,
  },
  {
    id: 'audience',
    text: 'Cui îi este destinat site-ul?',
    help: 'Conținutul site-urilor de tip intranet sau extranet publicat înainte de 23 septembrie 2019 și nerevizuit substanțial este exceptat.',
    articleRef: 'art. 1 alin. (4) lit. g)',
    options: [
      { value: 'public', label: 'Publicului larg' },
      {
        value: 'restricted_old',
        label:
          'Unui grup restrâns (intranet sau extranet), publicat înainte de 23 septembrie 2019 și nerevizuit substanțial de atunci',
      },
      {
        value: 'restricted_new',
        label:
          'Unui grup restrâns (intranet sau extranet), publicat sau revizuit substanțial după 23 septembrie 2019',
      },
      { value: 'unknown', label: 'Nu știu' },
    ],
  },
];

const STATUS_SUMMARIES: Record<LegalAssessment['status'], string> = {
  applicable:
    'Conform răspunsurilor, site-ul aparține unui organism din sectorul public și nu se încadrează într-o excepție: OUG 112/2018 pare aplicabilă.',
  possibly_applicable:
    'Conform răspunsurilor, OUG 112/2018 poate fi aplicabilă, dar încadrarea organizației trebuie confirmată de un specialist.',
  not_applicable: 'Conform răspunsurilor, OUG 112/2018 nu pare aplicabilă acestui site.',
  insufficient_information:
    'Nu putem evalua aplicabilitatea: lipsesc informații despre organizația care administrează site-ul.',
  not_assessed: 'Profilul juridic nu a fost completat.',
};

const DISCLAIMER =
  'Încadrare informativă, bazată doar pe răspunsurile declarate. Nu este consultanță juridică și nu stabilește încălcarea vreunei legi; necesită confirmare de specialitate.';

/** Evalueaza aplicabilitatea OUG 112/2018 pe baza raspunsurilor (deja validate). */
export function evaluateOug112(answers: LegalProfileAnswers): LegalAssessment {
  const reasons: LegalReason[] = [];
  const exclusions: LegalReason[] = [];
  const missingFacts: string[] = [];
  const toConfirm: string[] = [];
  const notes: LegalAssessment['notes'] = [];

  const result = (status: LegalAssessment['status']): LegalAssessment => ({
    framework: 'RO_OUG_112_2018',
    status,
    summary: STATUS_SUMMARIES[status],
    reasons: status === 'not_applicable' && exclusions.length > 0 ? exclusions : reasons,
    missingFacts,
    toConfirm,
    notes,
    disclaimer: DISCLAIMER,
    source: {
      name: OUG_112_2018.name,
      url: OUG_112_2018.sourceUrl,
      retrievedAt: OUG_112_2018.retrievedAt,
    },
    catalogVersion: CATALOG_VERSION,
  });

  const org = answers.organizationType;

  // 1. Administrator necunoscut
  if (org === 'unknown') {
    reasons.push(
      reason(
        'ORGANIZATION_UNKNOWN',
        'publicBody',
        'Legea se aplică doar organismelor din sectorul public, deci trebuie știut cine administrează site-ul.',
      ),
    );
    missingFacts.push('Cine administrează site-ul (tipul organizației).');
    return result('insufficient_information');
  }

  // 2. Administrator privat
  if (org === 'private') {
    reasons.push(
      reason(
        'PRIVATE_OPERATOR',
        'objective',
        'Legea privește site-urile organismelor din sectorul public; o firmă privată sau o persoană fizică nu intră în această definiție.',
      ),
    );
    toConfirm.push(
      'Dacă firma prestează servicii publice în numele unei autorități sau e controlată de stat, poate fi un organism de drept public: în acest caz, refă chestionarul.',
    );
    notes.push({
      articleRef: 'Legea nr. 232/2022',
      text: 'Pentru anumite produse și servicii oferite de firme private (ex. comerț electronic, servicii bancare) se poate aplica Legea nr. 232/2022, care nu este evaluată de această platformă.',
    });
    return result('not_applicable');
  }

  // Temeiul: cine administreaza site-ul
  if (org === 'public_authority') {
    reasons.push(
      reason(
        'PUBLIC_AUTHORITY_DECLARED',
        'publicBody',
        'Ai declarat că site-ul aparține unei autorități sau instituții publice: acestea sunt organisme din sectorul public.',
      ),
    );
    toConfirm.push('Că organizația este, într-adevăr, o autoritate sau instituție publică.');
  } else if (org === 'public_law_body') {
    reasons.push(
      reason(
        'PUBLIC_LAW_BODY_DECLARED',
        'publicBody',
        'Ai declarat că site-ul aparține unui organism de drept public, inclus în definiția organismelor din sectorul public.',
      ),
    );
    toConfirm.push(
      'Încadrarea ca organism de drept public, după criteriile din Legea nr. 98/2016, art. 4 alin. (2).',
    );
  } else if (org === 'public_association') {
    reasons.push(
      reason(
        'PUBLIC_ASSOCIATION_DECLARED',
        'association',
        'Ai declarat că site-ul aparține unei asociații formate din autorități sau organisme publice.',
      ),
    );
    toConfirm.push(
      'Că asociația a fost înființată pentru nevoi de interes general, fără caracter industrial sau comercial.',
    );
  } else {
    reasons.push(
      reason(
        'NON_PROFIT_DECLARED',
        'publicBody',
        'Ai declarat că site-ul aparține unei organizații fără scop patrimonial. Legea i se aplică doar dacă organizația este și organism din sectorul public (ex. organism de drept public).',
      ),
    );
    toConfirm.push(
      'Dacă organizația este organism din sectorul public (de regulă, un ONG obișnuit nu este).',
      'Interpretarea excepțiilor pentru organizațiile fără scop patrimonial (art. 1 alin. (3) lit. b) și c)), dacă organizația prestează doar unul dintre cele două tipuri de servicii.',
    );
  }

  // 3. Exceptii (art. 1 alin. 3 si 4)
  if (answers.publicBroadcaster === 'yes') {
    exclusions.push(
      reason(
        'PUBLIC_BROADCASTER_EXCEPTION',
        'broadcaster',
        'Ai declarat că site-ul aparține unui serviciu public de radiodifuziune: legea nu se aplică acestor site-uri.',
      ),
    );
  } else if (answers.publicBroadcaster === 'unknown') {
    missingFacts.push('Dacă site-ul aparține unui serviciu public de radiodifuziune.');
  }

  if (org === 'non_profit') {
    const essential = answers.nonProfitEssentialServices;
    const disability = answers.nonProfitDisabilityServices;
    if (essential === 'no' && disability === 'no') {
      exclusions.push(
        reason(
          'NON_PROFIT_EXCEPTION',
          'nonProfitEssential',
          'Ai declarat că organizația nu prestează servicii esențiale pentru public.',
        ),
        reason(
          'NON_PROFIT_EXCEPTION',
          'nonProfitDisability',
          'Ai declarat că organizația nu prestează servicii destinate în mod specific persoanelor cu dizabilități.',
        ),
      );
    } else {
      if (essential === 'unknown') {
        missingFacts.push('Dacă organizația prestează servicii esențiale pentru public.');
      }
      if (disability === 'unknown') {
        missingFacts.push(
          'Dacă organizația prestează servicii destinate în mod specific persoanelor cu dizabilități.',
        );
      }
    }
  }

  if (answers.audience === 'restricted_old') {
    exclusions.push(
      reason(
        'OLD_INTRANET_EXCEPTION',
        'intranet',
        'Ai declarat că site-ul e un intranet sau extranet publicat înainte de 23 septembrie 2019 și nerevizuit substanțial: conținutul lui e exceptat până la o revizuire substanțială.',
      ),
    );
  } else if (answers.audience === 'unknown') {
    missingFacts.push('Cui îi este destinat site-ul (publicului larg sau unui grup restrâns).');
  }

  if (exclusions.length > 0) return result('not_applicable');
  if (missingFacts.length > 0) return result('insufficient_information');

  // Informatii utile cand legea se poate aplica
  notes.push(
    {
      articleRef: OUG_112_QUOTES.contentExceptions.articleRef,
      text: 'Anumite tipuri de conținut sunt exceptate chiar dacă legea se aplică site-ului: documente de birou publicate înainte de intrarea în vigoare a ordonanței, conținut media în direct sau preînregistrat înainte de 23 septembrie 2020, hărți online, conținutul terților, reproduceri din colecții de patrimoniu, arhive (vezi literele a)–h) din textul oficial).',
    },
    {
      articleRef: OUG_112_QUOTES.disproportionateBurden.articleRef,
      text: 'Cerințele se aplică în măsura în care nu impun o „sarcină disproporționată”, stabilită printr-o evaluare publicată de organism (art. 4); lipsa de timp sau de cunoștințe nu este un motiv legitim (art. 4 alin. (5)).',
    },
  );

  return result(org === 'public_authority' ? 'applicable' : 'possibly_applicable');
}
