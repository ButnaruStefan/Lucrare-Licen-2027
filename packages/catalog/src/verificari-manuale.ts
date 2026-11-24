/**
 * Cele 6 verificari manuale de accesibilitate: ce verifica omul pe fiecare pagina scanata,
 * pentru ce nu poate verifica axe-core. Folosite de API (`routes/manual-checks.ts`), care le
 * trimite interfetei impreuna cu starea lor pe pagina.
 *
 * De unde vin pasii (citite pe 24.11.2026, nimic scris din memorie):
 *   - W3C WAI "Easy Checks - A First Review of Web Accessibility" (imagini, titluri, focus
 *     vizibil, zoom): https://www.w3.org/WAI/test-evaluate/easy-checks/
 *   - sectiunile "Tests" ale tehnicilor WCAG 2.2: G202 si F10 (tastatura), G149 si G59 (focus),
 *     G83, G85, G177 (erori in formulare), C32 si F102 (reflow), H42 (titluri);
 *   - WCAG-EM 2.0 (W3C, 23.07.2026): componentele comune (antet, meniu, cautare) nu trebuie
 *     reevaluate pe fiecare pagina daca arata si se comporta la fel.
 * Pasii sunt traduceri si adaptari proprii ale acestor surse (nu traduceri oficiale W3C).
 * Titlurile si nivelurile criteriilor vin din catalogul WCAG (generat din sursa W3C).
 *
 * Daca pasii se schimba, se schimba si MANUAL_CHECKS_VERSION: fiecare rezultat salvat pastreaza
 * versiunea dupa care s-a facut verificarea.
 */
import type { ManualCheckId, PageFacts } from '@ro-a11y/shared';
import { wcagCriterion } from './wcag';

export const MANUAL_CHECKS_VERSION = '2026-11-24';

export interface ManualCheckSource {
  label: string;
  url: string;
}

/** De ce depinde daca o verificare se aplica pe o pagina. */
export type ManualAppliesWhen = 'always' | 'images' | 'formFields';

export interface ManualCheckDefinition {
  id: ManualCheckId;
  title: string;
  why: string;
  /** Criteriile WCAG 2.2 verificate (numerele lor). */
  criteria: string[];
  steps: string[];
  passWhen: string;
  cautions: string[];
  sources: ManualCheckSource[];
  appliesWhen: ManualAppliesWhen;
}

const W3C_TECHNIQUES = 'https://www.w3.org/WAI/WCAG22/Techniques';
const EASY_CHECKS = 'https://www.w3.org/WAI/test-evaluate/easy-checks';

/** Componentele comune (WCAG-EM 2.0, pasul 4.1): se verifica o data, nu pe fiecare pagina. */
const COMMON_COMPONENTS =
  'Meniul, antetul și subsolul, identice pe toate paginile, le verifici o dată; pe celelalte pagini poți nota „identic cu pagina de start” (WCAG-EM 2.0: componentele comune nu se reevaluează la fiecare apariție, dacă arată și se comportă la fel).';

const WCAG_EM: ManualCheckSource = {
  label: 'W3C — WCAG-EM 2.0, pasul 4.1 (componentele comune)',
  url: 'https://www.w3.org/TR/WCAG-EM/',
};

export const MANUAL_CHECKS: readonly ManualCheckDefinition[] = [
  {
    id: 'tastatura',
    title: 'Pagina se poate folosi doar cu tastatura',
    why: 'Nevăzătorii (care folosesc un cititor de ecran) și persoanele care nu pot ține un mouse folosesc site-ul doar de la tastatură. Un meniu care se deschide numai la trecerea mouse-ului îi blochează complet, iar scanarea automată nu poate verifica asta.',
    criteria: ['2.1.1', '2.1.2'],
    steps: [
      'Fă o listă cu ce se poate face pe pagină: meniuri și submeniuri, linkuri, butoane, câmpuri de formular, carusele, file (tab-uri), ferestre care se deschid.',
      'Pune mouse-ul deoparte. Cu Tab mergi înainte, cu Shift+Tab înapoi; cu Enter activezi un link sau un buton, cu Space un buton sau o căsuță, cu săgețile te miști într-un meniu sau o listă.',
      'Verifică fiecare lucru din listă: îl poți folosi complet doar cu tastatura (deschizi submeniul, alegi o opțiune, închizi fereastra).',
      'Verifică că focusul nu rămâne blocat nicăieri: din orice zonă (un video, o hartă, o fereastră) poți ieși cu Tab, Shift+Tab sau Esc, fără să închizi browserul.',
    ],
    passWhen:
      'Tot ce se poate face pe pagină se poate face doar cu tastatura, iar focusul nu rămâne blocat nicăieri.',
    cautions: [
      'În Safari pe Mac, Tab trece prin linkuri doar dacă activezi, în setările avansate, opțiunea pentru Tab (în engleză: „Press Tab to highlight each item on a webpage”). În Chrome merge direct.',
      COMMON_COMPONENTS,
    ],
    sources: [
      {
        label: 'W3C — Tehnica G202: Ensuring keyboard control for all functionality (Tests)',
        url: `${W3C_TECHNIQUES}/general/G202`,
      },
      { label: 'W3C — Eșecul F10: keyboard trap (Tests)', url: `${W3C_TECHNIQUES}/failures/F10` },
      WCAG_EM,
    ],
    appliesWhen: 'always',
  },
  {
    id: 'focus',
    title: 'Focusul se vede și merge într-o ordine logică',
    why: 'Cine folosește tastatura trebuie să vadă în orice moment unde se află, ca un cursor. Dacă focusul e invizibil sau sare haotic prin pagină, utilizatorul se pierde.',
    criteria: ['2.4.7', '2.4.3'],
    steps: [
      'Dă clic în bara de adrese a browserului, apoi apasă Tab de mai multe ori, pornind de la începutul paginii.',
      'La fiecare apăsare, verifică că elementul ajuns în focus se vede clar: un contur, o subliniere, o schimbare de culoare sau de fundal.',
      'Verifică că nu e evidențiat un spațiu gol: înseamnă de obicei un link sau un buton fără text.',
      'Urmărește ordinea în care trece focusul și compar-o cu ordinea logică a paginii (ordinea de citire, pașii unui formular): trebuie să fie aceeași.',
    ],
    passWhen:
      'Focusul se vede clar pe fiecare element, iar ordinea lui urmează ordinea logică a paginii.',
    cautions: [COMMON_COMPONENTS],
    sources: [
      { label: 'W3C — Easy Checks: Visible Keyboard Focus', url: `${EASY_CHECKS}/keyboard-focus/` },
      {
        label: 'W3C — Tehnica G149: componente evidențiate de browser la focus (Tests)',
        url: `${W3C_TECHNIQUES}/general/G149`,
      },
      {
        label: 'W3C — Tehnica G59: ordinea elementelor interactive (Tests)',
        url: `${W3C_TECHNIQUES}/general/G59`,
      },
      WCAG_EM,
    ],
    appliesWhen: 'always',
  },
  {
    id: 'text-alternativ',
    title: 'Textul alternativ al imaginilor are sens',
    why: 'Cititorul de ecran citește textul alternativ (atributul alt) în locul imaginii. Scanarea automată vede doar dacă textul există; dacă spune ceva util (și nu „imagine1.jpg”), doar un om poate judeca.',
    criteria: ['1.1.1'],
    steps: [
      'Vezi textul alternativ al fiecărei imagini: în Chrome, clic dreapta pe imagine → Inspectează (atributul alt), sau instrumentul „Check images” de pe pagina W3C Easy Checks.',
      'Imaginile care transmit o informație au un text alternativ care descrie acea informație.',
      'Imaginile care conțin text au acel text și în textul alternativ.',
      'Imaginile doar decorative au textul alternativ gol (alt="").',
      'Imaginile care sunt linkuri sau butoane au un text care spune unde duc sau ce fac (nu ce reprezintă).',
      'Graficele și schemele au un text scurt (ce fel de imagine e și ideea principală), iar detaliile sunt în pagină sau într-o pagină legată.',
    ],
    passWhen: 'Fiecare imagine are textul alternativ potrivit rolului ei.',
    cautions: [],
    sources: [
      { label: 'W3C — Easy Checks: Images (text alternatives)', url: `${EASY_CHECKS}/image-alt/` },
    ],
    appliesWhen: 'images',
  },
  {
    id: 'erori-formulare',
    title: 'Erorile din formulare sunt explicate',
    why: 'Dacă un formular respinge datele fără să spună ce e greșit, mulți utilizatori nu-l mai pot trimite. Mesajele de eroare apar doar după ce cineva completează formularul, deci scanarea automată nu le vede.',
    criteria: ['3.3.1', '3.3.3'],
    steps: [
      'Completează formularul lăsând gol un câmp obligatoriu și trimite-l. Verifică: un mesaj scris (nu doar o culoare) spune care câmp nu a fost completat.',
      'Verifică că datele completate deja au rămas în formular (în afară de parole).',
      'Completează un câmp cu o valoare în format greșit (o adresă de e-mail fără @, o dată imposibilă) și trimite. Verifică: mesajul spune care câmp e greșit, ce e greșit și cum se corectează.',
      'Unde valoarea corectă se poate ghici, verifică dacă formularul propune o corectură, lângă câmp.',
    ],
    passWhen:
      'Fiecare eroare e semnalată în text, cu câmpul greșit și cum se corectează, iar datele introduse nu se pierd.',
    cautions: [
      'Nu folosi date reale și nu trimite formulare cu efecte reale (o cerere oficială, o plată, o programare). Dacă nu poți testa fără efecte, alege „Nu pot determina”.',
      'Formularul de căutare din antet, prezent pe toate paginile, îl verifici o dată (WCAG-EM 2.0: componentele comune nu se reevaluează la fiecare apariție).',
    ],
    sources: [
      {
        label: 'W3C — Tehnica G83: câmpuri obligatorii necompletate (Tests)',
        url: `${W3C_TECHNIQUES}/general/G83`,
      },
      {
        label: 'W3C — Tehnica G85: valori în format greșit (Tests)',
        url: `${W3C_TECHNIQUES}/general/G85`,
      },
      {
        label: 'W3C — Tehnica G177: corecturi propuse (Tests)',
        url: `${W3C_TECHNIQUES}/general/G177`,
      },
      WCAG_EM,
    ],
    appliesWhen: 'formFields',
  },
  {
    id: 'zoom-reflow',
    title: 'Pagina se poate mări fără să se strice',
    why: 'Persoanele cu vedere slabă măresc pagina. La 400%, o fereastră de 1280 px se comportă ca un ecran de 320 px: conținutul trebuie să se rearanjeze, fără derulare stânga-dreapta și fără să se piardă ceva.',
    criteria: ['1.4.10', '1.4.4'],
    steps: [
      'Fă fereastra browserului de 1280 px lățime (sau cât mai aproape) și mărește pagina la 400% (Ctrl sau Cmd și +, de mai multe ori). Dacă browserul nu ajunge la 400%, micșorează fereastra în proporție (de exemplu, la 300%, 960 px).',
      'Verifică că tot conținutul și toate funcțiile se pot folosi fără derulare orizontală. Excepție: părțile care au nevoie de două dimensiuni (tabele de date, hărți, grafice).',
      'Verifică că tot textul se poate citi și nu e ascuns sub alt text sau sub imagini.',
      'Compară cu pagina la mărime normală: ce dispare la 400% trebuie să fie disponibil altfel (un meniu care se deschide, un buton, un link).',
      'La 200% (Ctrl sau Cmd și +, de cinci ori), verifică și că textul se mărește fără să se taie sau să se suprapună.',
    ],
    passWhen:
      'La 400% pagina se rearanjează fără derulare orizontală și fără să se piardă ceva, iar la 200% textul se mărește fără probleme.',
    cautions: [
      'Dacă scanarea a verificat și aspectul paginii, un semnal „Pagina se derulează pe orizontală” la 320 px e un indiciu pentru acest pas, nu un rezultat.',
    ],
    sources: [
      { label: 'W3C — Easy Checks: Zoom', url: `${EASY_CHECKS}/zoom/` },
      {
        label: 'W3C — Tehnica C32: reflow la 400% (Tests)',
        url: `${W3C_TECHNIQUES}/css/C32`,
      },
      {
        label: 'W3C — Eșecul F102: conținut care dispare la reflow (Tests)',
        url: `${W3C_TECHNIQUES}/failures/F102`,
      },
    ],
    appliesWhen: 'always',
  },
  {
    id: 'titluri',
    title: 'Titlurile reflectă structura paginii',
    why: 'Cei care folosesc un cititor de ecran sar de la un titlu la altul ca să găsească repede ce caută, ca într-un cuprins. Titlurile trebuie să existe în cod (h1–h6), nu doar să arate mari.',
    criteria: ['1.3.1', '2.4.6'],
    steps: [
      'Uită-te la lista titlurilor găsite la scanare (deasupra pașilor) sau folosește instrumentul „Check headings” de pe pagina W3C Easy Checks.',
      'Verifică: pagina are titluri, lista începe cu un h1 și nu sare niveluri (de exemplu, de la h2 direct la h4).',
      'Verifică că nu există titluri goale, fără text.',
      'Caută pe pagină texte care arată ca un titlu (mari, îngroșate, separate), dar nu apar în listă: sunt titluri doar vizuale.',
      'Verifică că textul fiecărui titlu descrie conținutul de sub el, iar nivelurile urmează structura (o subsecțiune are un nivel mai mic decât secțiunea ei).',
      'Verifică că nu e marcat ca titlu un text care nu e titlu (un slogan, un text mare doar ca decor).',
    ],
    passWhen: 'Titlurile există în cod, descriu conținutul și urmează structura paginii.',
    cautions: [],
    sources: [
      { label: 'W3C — Easy Checks: Headings', url: `${EASY_CHECKS}/headings/` },
      {
        label: 'W3C — Tehnica H42: Using h1-h6 to identify headings (Tests)',
        url: `${W3C_TECHNIQUES}/html/H42`,
      },
    ],
    appliesWhen: 'always',
  },
];

/** Verificarea cu id-ul dat (null = nu exista). */
export function manualCheckDefinition(id: string): ManualCheckDefinition | null {
  return MANUAL_CHECKS.find((c) => c.id === id) ?? null;
}

/**
 * De ce nu se aplica o verificare pe o pagina, din ce contine pagina la scanare. null = se
 * aplica, sau nu stim ce contine pagina (scanare mai veche): atunci ramane de facut.
 */
export function autoNotApplicableReason(
  check: ManualCheckDefinition,
  facts: PageFacts | null,
): string | null {
  if (!facts) return null;
  if (check.appliesWhen === 'images' && facts.images === 0) {
    return 'Pagina nu are imagini (detectat automat la scanare).';
  }
  if (check.appliesWhen === 'formFields' && facts.formFields === 0) {
    return 'Pagina nu are câmpuri de formular (detectat automat la scanare).';
  }
  return null;
}

/** Criteriile unei verificari, cu titlurile si nivelul lor din catalogul WCAG. */
export function manualCheckCriteria(check: ManualCheckDefinition) {
  return check.criteria.map((number) => {
    const c = wcagCriterion(number);
    return {
      number,
      titleEn: c?.titleEn ?? number,
      titleRo: c?.titleRo ?? null,
      level: c?.level ?? null,
      understandingUrl: c?.understandingUrl ?? null,
    };
  });
}
