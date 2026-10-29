/**
 * Remedieri in romana pentru regulile axe-core despre structura paginii: repere (landmarks),
 * titluri, liste, linkuri, zoom, dimensiunea tintelor si continutul pe care axe nu l-a putut testa.
 *
 * Parte a catalogului de remedieri (vezi `../remedieri-ro.ts`, care le aduna pe toate).
 * Redactate de autorul proiectului pe baza documentatiei Deque si W3C; de revizuit de un specialist.
 */
import type { Remediation } from '../remedieri-ro';

/** Eticheta de inchidere pentru o eticheta HTML simpla, ex. "<main>" -> "</main>". */
const closing = (tag: string) => tag.replace('<', '</');

/** Repere care trebuie sa fie la nivelul de sus al paginii (nu in interiorul altor repere). */
function topLevelLandmark(
  axeRuleId: string,
  element: string,
  role: string,
  nameRo: string,
  container: string,
  deprecated = false,
): Remediation {
  const landmark = `${element}…${closing(element)}`;
  return {
    axeRuleId,
    titleRo: `Reperul ${nameRo} nu ar trebui să fie în interiorul altui reper`,
    whatItMeans: `Elementul ${element} (rolul „${role}”) e pus în interiorul altui reper, deci structura paginii e confuză pentru cine o parcurge pe zone. Bună practică${deprecated ? '; regulă scoasă din uz în axe-core' : ''}.`,
    whoIsAffected: 'Utilizatorii de cititoare de ecran, care sar între zonele paginii.',
    howToFix: [`Mută ${element} la nivelul de sus al paginii, în afara celorlalte repere.`],
    example: {
      before: `${container}\n  ${landmark}\n${closing(container)}`,
      after: `${container}…${closing(container)}\n${landmark}`,
    },
    howToVerify: [
      'Afișează lista reperelor (cititor de ecran sau extensie): reperul trebuie să apară la primul nivel.',
    ],
  };
}

/** Repere care trebuie sa apara cel mult o data pe pagina. */
function noDuplicateLandmark(
  axeRuleId: string,
  element: string,
  role: string,
  nameRo: string,
): Remediation {
  const landmark = `${element}…${closing(element)}`;
  return {
    axeRuleId,
    titleRo: `Pagina nu ar trebui să aibă mai multe repere ${nameRo}`,
    whatItMeans: `Pagina are mai multe elemente cu rolul „${role}” (de obicei ${element} pus direct în <body>). Utilizatorul nu știe care e cel principal. Bună practică.`,
    whoIsAffected: 'Utilizatorii de cititoare de ecran, care sar între zonele paginii.',
    howToFix: [
      `Păstrează un singur ${element} la nivelul paginii.`,
      'Elementele de același tip din interiorul secțiunilor (<article>, <section>) nu sunt repere ale paginii și pot rămâne.',
    ],
    example: {
      before: `${landmark}\n${landmark}`,
      after: landmark,
    },
    howToVerify: [`Lista reperelor trebuie să conțină o singură zonă „${role}”.`],
  };
}

export const REMEDIATIONS_STRUCTURE: Remediation[] = [
  // ─── Repere (landmarks) ───
  topLevelLandmark(
    'landmark-banner-is-top-level',
    '<header>',
    'banner',
    'antet (banner)',
    '<main>',
  ),
  topLevelLandmark(
    'landmark-complementary-is-top-level',
    '<aside>',
    'complementary',
    'complementar (aside)',
    '<nav>',
    true,
  ),
  topLevelLandmark(
    'landmark-contentinfo-is-top-level',
    '<footer>',
    'contentinfo',
    'subsol (contentinfo)',
    '<main>',
  ),
  topLevelLandmark('landmark-main-is-top-level', '<main>', 'main', 'principal (main)', '<aside>'),
  noDuplicateLandmark('landmark-no-duplicate-banner', '<header>', 'banner', 'de antet'),
  noDuplicateLandmark('landmark-no-duplicate-contentinfo', '<footer>', 'contentinfo', 'de subsol'),
  noDuplicateLandmark('landmark-no-duplicate-main', '<main>', 'main', 'principale'),
  {
    axeRuleId: 'landmark-unique',
    titleRo: 'Reperele de același tip ar trebui să aibă nume diferite',
    whatItMeans:
      'Pagina are mai multe repere de același tip fără nume care să le deosebească (ex. două <nav>: meniul principal și meniul din subsol). În lista reperelor, apar identice. Bună practică.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran, care aleg zona din lista reperelor.',
    howToFix: ['Dă fiecărui reper un nume unic cu aria-label sau aria-labelledby.'],
    example: {
      before: '<nav>…</nav>\n…\n<nav>…</nav>',
      after:
        '<nav aria-label="Meniul principal">…</nav>\n…\n<nav aria-label="Linkuri utile">…</nav>',
    },
    howToVerify: [
      'Lista reperelor trebuie să afișeze nume diferite (ex. „Meniul principal”, „Linkuri utile”).',
    ],
  },
  // ─── Titluri si text ───
  {
    axeRuleId: 'p-as-heading',
    titleRo: 'Paragrafele nu trebuie folosite pe post de titluri',
    whatItMeans:
      'Un <p> e stilizat ca un titlu (îngroșat, mai mare), dar în cod e un paragraf obișnuit. Vizual pare titlu, dar cititorul de ecran nu îl găsește printre titluri. Regulă experimentală.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran, care navighează după titluri.',
    howToFix: ['Folosește elementul de titlu potrivit (<h2>, <h3>…) și stilizează-l cu CSS.'],
    example: {
      before: '<p class="mare-ingrosat">Documente necesare</p>',
      after: '<h2>Documente necesare</h2>',
    },
    howToVerify: [
      'Afișează lista titlurilor: tot ce arată ca un titlu în pagină trebuie să apară în listă.',
    ],
  },
  {
    axeRuleId: 'page-has-heading-one',
    titleRo: 'Pagina ar trebui să aibă un titlu principal (h1)',
    whatItMeans:
      'Pagina nu are niciun <h1>. Titlul principal spune despre ce e pagina și e primul punct de reper la navigarea după titluri. Bună practică.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Adaugă un <h1> la începutul conținutului principal, care descrie pagina.'],
    example: {
      before: '<main>\n  <div class="titlu">Taxe și impozite</div>',
      after: '<main>\n  <h1>Taxe și impozite</h1>',
    },
    howToVerify: ['Lista titlurilor trebuie să înceapă cu un titlu de nivel 1.'],
  },
  {
    axeRuleId: 'identical-links-same-purpose',
    titleRo: 'Linkurile cu același text ar trebui să ducă în același loc (nivel AAA)',
    whatItMeans:
      'Mai multe linkuri au același text (ex. „Citește mai mult”), dar duc în locuri diferite. Scoase din context, nu pot fi deosebite. Criteriu de nivel AAA.',
    whoIsAffected:
      'Utilizatorii de cititoare de ecran, care parcurg adesea doar lista linkurilor din pagină.',
    howToFix: [
      'Fă textul fiecărui link unic și descriptiv (ex. „Citește anunțul despre colectarea deșeurilor”).',
      'Sau completează numele cu un text ascuns vizual.',
    ],
    example: {
      before: '<a href="/anunt/12">Citește mai mult</a>\n<a href="/anunt/13">Citește mai mult</a>',
      after:
        '<a href="/anunt/12">Citește mai mult<span class="visually-hidden"> despre colectarea deșeurilor</span></a>\n<a href="/anunt/13">Citește mai mult<span class="visually-hidden"> despre ședința consiliului</span></a>',
    },
    howToVerify: [
      'În lista linkurilor, fiecare link trebuie să poată fi înțeles fără textul din jur.',
    ],
  },
  {
    axeRuleId: 'label-content-name-mismatch',
    titleRo: 'Numele accesibil trebuie să conțină textul vizibil',
    whatItMeans:
      'Un buton sau un link are un nume (prin aria-label) diferit de textul afișat (ex. textul „Trimite”, dar numele „Expediază formularul”). Cine folosește comanda vocală spune „apasă Trimite” și nu se întâmplă nimic. Regulă experimentală.',
    whoIsAffected: 'Utilizatorii de comandă vocală și de cititoare de ecran.',
    howToFix: [
      'Fă ca numele accesibil să înceapă cu textul vizibil, sau elimină aria-label și lasă textul vizibil să fie numele.',
    ],
    example: {
      before: '<button aria-label="Expediază formularul">Trimite</button>',
      after: '<button>Trimite</button>',
    },
    howToVerify: [
      'Cu o aplicație de comandă vocală, rostește textul vizibil al butonului: butonul trebuie să fie apăsat.',
    ],
  },
  // ─── Liste ───
  {
    axeRuleId: 'list',
    titleRo: 'Listele <ul> și <ol> trebuie să conțină direct doar elemente <li>',
    whatItMeans:
      'O listă conține direct alte elemente decât <li> (ex. un <div> sau un <p>), deci cititorul de ecran poate anunța greșit numărul de elemente.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Pune fiecare element al listei într-un <li>; celelalte elemente mută-le în <li>.'],
    example: {
      before: '<ul>\n  <div>Certificat de urbanism</div>\n</ul>',
      after: '<ul>\n  <li>Certificat de urbanism</li>\n</ul>',
    },
    howToVerify: ['Cu un cititor de ecran, lista trebuie anunțată cu numărul corect de elemente.'],
  },
  {
    axeRuleId: 'listitem',
    titleRo: 'Elementele <li> trebuie să fie în interiorul unei liste',
    whatItMeans:
      'Un <li> nu e în interiorul unui <ul> sau <ol>, deci nu face parte dintr-o listă recunoscută.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Pune elementele <li> într-un <ul> (listă simplă) sau <ol> (listă numerotată).'],
    example: {
      before: '<div>\n  <li>Cerere tip</li>\n</div>',
      after: '<ul>\n  <li>Cerere tip</li>\n</ul>',
    },
    howToVerify: ['Cu un cititor de ecran, elementele trebuie anunțate ca parte a unei liste.'],
  },
  {
    axeRuleId: 'definition-list',
    titleRo: 'Listele de definiții (<dl>) trebuie să aibă structura corectă',
    whatItMeans:
      'Un <dl> conține direct alte elemente decât perechi <dt> (termen) și <dd> (descriere), sau <div>-uri care le grupează.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: [
      'Folosește în <dl> doar <dt> și <dd> (eventual grupate în <div>), în ordinea termen → descriere.',
    ],
    example: {
      before: '<dl>\n  <p>Program</p>\n  <dd>Luni–Vineri, 8–16</dd>\n</dl>',
      after: '<dl>\n  <dt>Program</dt>\n  <dd>Luni–Vineri, 8–16</dd>\n</dl>',
    },
    howToVerify: [
      'Cu un cititor de ecran, fiecare termen trebuie anunțat împreună cu descrierea lui.',
    ],
  },
  {
    axeRuleId: 'dlitem',
    titleRo: 'Elementele <dt> și <dd> trebuie să fie într-un <dl>',
    whatItMeans: 'Un <dt> sau <dd> stă în afara unei liste de definiții <dl>.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Pune perechile <dt> / <dd> într-un <dl>.'],
    example: {
      before: '<div>\n  <dt>Telefon</dt>\n  <dd>0232 000 000</dd>\n</div>',
      after: '<dl>\n  <dt>Telefon</dt>\n  <dd>0232 000 000</dd>\n</dl>',
    },
    howToVerify: ['Cu un cititor de ecran, perechile trebuie anunțate ca listă de definiții.'],
  },
  // ─── Zoom, spatiere, orientare, dimensiunea tintelor ───
  {
    axeRuleId: 'meta-viewport-large',
    titleRo: 'Utilizatorii ar trebui să poată mări pagina de până la 5 ori',
    whatItMeans:
      'Eticheta meta viewport limitează mărirea (ex. maximum-scale=2), deci pe telefon pagina nu poate fi mărită suficient. Bună practică.',
    whoIsAffected: 'Persoanele cu vedere slabă care folosesc telefonul.',
    howToFix: ['Elimină maximum-scale din meta viewport, sau pune o valoare de cel puțin 5.'],
    example: {
      before:
        '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=2">',
      after: '<meta name="viewport" content="width=device-width, initial-scale=1">',
    },
    howToVerify: ['Pe un telefon, pagina trebuie să se poată mări cu două degete de multe ori.'],
  },
  {
    axeRuleId: 'target-size',
    titleRo: 'Țintele de atingere trebuie să aibă cel puțin 24 × 24 px sau spațiu suficient',
    whatItMeans:
      'Un buton, link sau altă țintă de click e mai mic de 24 × 24 pixeli și prea aproape de alte ținte, deci e ușor să apeși greșit.',
    whoIsAffected:
      'Persoanele cu tremur sau dificultăți motorii și oricine folosește telefonul cu o mână.',
    howToFix: [
      'Mărește zona de click la cel puțin 24 × 24 px (de exemplu cu padding).',
      'Sau lasă suficient spațiu liber între țintele mici.',
    ],
    example: {
      before: '.social a { width: 16px; height: 16px; margin: 0; }',
      after: '.social a { min-width: 24px; min-height: 24px; padding: 4px; }',
    },
    howToVerify: [
      'Măsoară țintele în instrumentele pentru dezvoltatori; pe telefon, apasă-le cu degetul fără să nimerești alta.',
    ],
  },
  {
    axeRuleId: 'avoid-inline-spacing',
    titleRo: 'Spațierea textului trebuie să poată fi modificată de utilizator',
    whatItMeans:
      'Un element are spațierea textului (letter-spacing, word-spacing sau line-height) fixată în atributul style cu !important, deci utilizatorul nu o poate mări cu propriile stiluri.',
    whoIsAffected:
      'Persoanele cu dislexie sau vedere slabă, care măresc spațiile dintre litere, cuvinte și rânduri.',
    howToFix: ['Elimină !important din stilurile de spațiere puse direct pe element.'],
    example: {
      before: '<p style="line-height: 1.2 !important">…</p>',
      after: '<p style="line-height: 1.5">…</p>',
    },
    howToVerify: [
      'Aplică stilurile de test pentru spațiere (ex. un bookmarklet „text spacing”): textul trebuie să se adapteze fără să se suprapună.',
    ],
  },
  {
    axeRuleId: 'css-orientation-lock',
    titleRo: 'Pagina nu trebuie blocată într-o singură orientare a ecranului',
    whatItMeans:
      'Stilurile CSS forțează afișarea doar pe orizontală sau doar pe verticală. Regulă experimentală.',
    whoIsAffected:
      'Persoanele care au telefonul sau tableta montate fix (ex. pe un scaun cu rotile).',
    howToFix: ['Elimină regulile care rotesc sau ascund conținutul în funcție de orientare.'],
    example: {
      before: '@media (orientation: portrait) {\n  body { transform: rotate(90deg); }\n}',
      after: '/* conținutul se adaptează la ambele orientări */',
    },
    howToVerify: ['Rotește telefonul: pagina trebuie să funcționeze în ambele orientări.'],
  },
  // ─── Continut pe care axe nu l-a putut testa ───
  {
    axeRuleId: 'frame-tested',
    titleRo: 'Conținutul cadrelor (iframe) ar trebui testat',
    whatItMeans:
      'Pagina conține un <iframe> în care axe-core nu a putut rula (ex. conținut de pe alt site sau încărcat prea târziu). Problemele din cadru nu apar în rezultate. Bună practică.',
    whoIsAffected:
      'Oricine folosește conținutul cadrului; problemele lui pot rămâne nedescoperite.',
    howToFix: [
      'Scanează separat adresa cadrului, dacă e de pe același site.',
      'Pentru conținut de pe alte site-uri (hărți, videoclipuri, formulare), verifică manual sau cere furnizorului informații despre accesibilitate.',
    ],
    example: {
      before: '<iframe src="https://harti.exemplu.ro/…"></iframe>',
      after: '<iframe src="https://harti.exemplu.ro/…" title="Harta sediilor primăriei"></iframe>',
      note: 'Titlul ajută la identificarea cadrului; conținutul lui trebuie verificat separat.',
    },
    howToVerify: [
      'Deschide adresa cadrului într-o filă nouă și verifică-l cu tastatura și un cititor de ecran.',
    ],
  },
  {
    axeRuleId: 'hidden-content',
    titleRo: 'Conținutul ascuns ar trebui verificat',
    whatItMeans:
      'Pagina are conținut ascuns (ex. meniuri închise, file nevizibile, ferestre care apar la click), pe care axe-core nu l-a putut analiza. Regulă experimentală.',
    whoIsAffected: 'Oricine deschide ulterior acel conținut.',
    howToFix: ['Deschide conținutul ascuns (meniu, filă, dialog) și verifică-l din nou.'],
    example: {
      before: '<div class="meniu" hidden>…</div>',
      after: '<div class="meniu">…</div>',
      note: 'Exemplul arată starea în care meniul e deschis pentru verificare, nu o modificare definitivă.',
    },
    howToVerify: [
      'Deschide fiecare zonă ascunsă și verifică-o cu tastatura și cu un instrument de accesibilitate.',
    ],
  },
];
