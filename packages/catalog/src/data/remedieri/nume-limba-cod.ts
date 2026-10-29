/**
 * Remedieri in romana pentru regulile axe-core despre limba paginii, numele elementelor si
 * corectitudinea codului HTML (id-uri unice, elemente scoase din uz).
 *
 * Parte a catalogului de remedieri (vezi `../remedieri-ro.ts`, care le aduna pe toate).
 * Redactate de autorul proiectului pe baza documentatiei Deque si W3C; de revizuit de un specialist.
 */
import type { Remediation } from '../remedieri-ro';

export const REMEDIATIONS_NAMES_LANGUAGE: Remediation[] = [
  // ─── Limba ───
  {
    axeRuleId: 'html-xml-lang-mismatch',
    titleRo: 'Atributele lang și xml:lang trebuie să indice aceeași limbă',
    whatItMeans:
      'Elementul <html> are atât lang, cât și xml:lang, dar cu limbi diferite (ex. lang="ro" și xml:lang="en"). Tehnologiile asistive nu știu pe care să o folosească.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: [
      'Pune aceeași limbă în ambele atribute, sau elimină xml:lang (nu e necesar în HTML).',
    ],
    example: {
      before: '<html lang="ro" xml:lang="en">',
      after: '<html lang="ro">',
    },
    howToVerify: ['Verifică în codul sursă că elementul <html> declară o singură limbă.'],
  },
  {
    axeRuleId: 'valid-lang',
    titleRo: 'Limba declarată pentru o porțiune de text trebuie să fie validă',
    whatItMeans:
      'Un element din pagină are atributul lang cu o valoare care nu e un cod de limbă (ex. lang="engleza"), deci textul lui poate fi pronunțat greșit.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: [
      'Folosește codul standard al limbii: en (engleză), hu (maghiară), de (germană) etc.',
    ],
    example: {
      before: '<p lang="engleza">Welcome to our city</p>',
      after: '<p lang="en">Welcome to our city</p>',
    },
    howToVerify: [
      'Ascultă porțiunea respectivă cu un cititor de ecran: trebuie pronunțată în limba ei.',
    ],
  },
  // ─── Numele elementelor ───
  {
    axeRuleId: 'empty-heading',
    titleRo: 'Titlurile nu ar trebui să fie goale',
    whatItMeans:
      'Un titlu (<h1>–<h6>) nu are text, sau textul lui e ascuns. Cititorul de ecran anunță un titlu fără conținut. Bună practică.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran, care navighează pagina după titluri.',
    howToFix: ['Pune text în titlu, sau elimină elementul dacă e folosit doar pentru spațiere.'],
    example: {
      before: '<h2></h2>',
      after: '<h2>Anunțuri recente</h2>',
    },
    howToVerify: [
      'Afișează lista titlurilor (cititor de ecran sau extensie): niciunul nu trebuie să fie gol.',
    ],
  },
  {
    axeRuleId: 'empty-table-header',
    titleRo: 'Capetele de tabel nu ar trebui să fie goale',
    whatItMeans:
      'O celulă de antet (<th>) nu are text, deci coloana sau rândul nu are nume. Bună practică.',
    whoIsAffected:
      'Utilizatorii de cititoare de ecran, care aud numele coloanei când se mută între celule.',
    howToFix: ['Pune un text în antet. Dacă celula nu e de fapt un antet, folosește <td>.'],
    example: {
      before: '<tr><th></th><th>Luni</th><th>Marți</th></tr>',
      after: '<tr><th>Serviciu</th><th>Luni</th><th>Marți</th></tr>',
    },
    howToVerify: [
      'Cu un cititor de ecran, la mutarea între celule trebuie anunțat numele coloanei.',
    ],
  },
  {
    axeRuleId: 'input-button-name',
    titleRo: 'Butoanele de tip input trebuie să aibă text',
    whatItMeans:
      'Un <input type="button">, "submit" sau "reset" are atributul value gol, deci butonul nu are nume.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran și de comandă vocală.',
    howToFix: ['Pune în atributul value textul butonului.'],
    example: {
      before: '<input type="submit" value="">',
      after: '<input type="submit" value="Trimite cererea">',
    },
    howToVerify: ['Cu un cititor de ecran, butonul trebuie anunțat cu textul lui.'],
  },
  {
    axeRuleId: 'summary-name',
    titleRo: 'Elementele <summary> trebuie să aibă text',
    whatItMeans:
      'Titlul unei secțiuni pliabile (<summary> din <details>) nu are text, deci nu se știe ce se deschide.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Pune un text în <summary> care spune ce conține secțiunea.'],
    example: {
      before: '<details>\n  <summary><svg>…</svg></summary>…\n</details>',
      after: '<details>\n  <summary>Program de lucru</summary>…\n</details>',
    },
    howToVerify: [
      'Cu un cititor de ecran, secțiunea trebuie anunțată cu titlul ei și starea (închis/deschis).',
    ],
  },
  // ─── Corectitudinea codului ───
  {
    axeRuleId: 'duplicate-id',
    titleRo: 'Valorile atributului id ar trebui să fie unice',
    whatItMeans:
      'Mai multe elemente au același id. Criteriul WCAG 4.1.1 de care ținea această regulă a fost scos în WCAG 2.2, iar regula e scoasă din uz în axe-core; problema poate totuși strica legăturile dintre elemente.',
    whoIsAffected:
      'Indirect, utilizatorii de tehnologii asistive (ex. o etichetă poate fi legată de alt câmp decât cel dorit).',
    howToFix: ['Dă fiecărui element un id unic în pagină.'],
    example: {
      before: '<div id="anunt">…</div>\n<div id="anunt">…</div>',
      after: '<div id="anunt-1">…</div>\n<div id="anunt-2">…</div>',
    },
    howToVerify: [
      'Validează pagina (ex. cu validatorul W3C): nu trebuie să existe id-uri repetate.',
    ],
  },
  {
    axeRuleId: 'duplicate-id-active',
    titleRo: 'Elementele interactive ar trebui să aibă id-uri unice',
    whatItMeans:
      'Mai multe linkuri, butoane sau câmpuri au același id. Regulă scoasă din uz în axe-core (criteriul 4.1.1 nu mai există în WCAG 2.2), dar id-urile repetate pot încurca scripturile și etichetele.',
    whoIsAffected: 'Utilizatorii de tastatură și de tehnologii asistive.',
    howToFix: ['Dă fiecărui element interactiv un id unic.'],
    example: {
      before:
        '<button id="trimite">Trimite</button>\n<button id="trimite">Trimite din nou</button>',
      after:
        '<button id="trimite">Trimite</button>\n<button id="trimite-din-nou">Trimite din nou</button>',
    },
    howToVerify: ['Verifică în codul sursă că niciun id al unui element interactiv nu se repetă.'],
  },
  {
    axeRuleId: 'duplicate-id-aria',
    titleRo: 'Id-urile folosite în ARIA și în etichete trebuie să fie unice',
    whatItMeans:
      'Un id la care trimit aria-labelledby, aria-describedby sau un <label for> apare de mai multe ori. Câmpul poate primi numele sau descrierea altui element.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Dă fiecărui element un id unic și actualizează trimiterile către el.'],
    example: {
      before:
        '<label for="email">E-mail</label><input id="email">\n<label for="email">E-mail de rezervă</label><input id="email">',
      after:
        '<label for="email">E-mail</label><input id="email">\n<label for="email-rezerva">E-mail de rezervă</label><input id="email-rezerva">',
    },
    howToVerify: ['Cu un cititor de ecran, fiecare câmp trebuie anunțat cu propria etichetă.'],
  },
  {
    axeRuleId: 'marquee',
    titleRo: 'Nu trebuie folosit elementul <marquee> (text care se derulează singur)',
    whatItMeans:
      'Pagina folosește <marquee>, un element scos din uz care face textul să se miște continuu, fără posibilitatea de a-l opri.',
    whoIsAffected:
      'Persoanele cu dificultăți de atenție sau de citire și utilizatorii de cititoare de ecran.',
    howToFix: [
      'Înlocuiește <marquee> cu text static.',
      'Dacă mișcarea e necesară, oferă un buton de oprire și oprește mișcarea după cel mult 5 secunde.',
    ],
    example: {
      before: '<marquee>Program special de sărbători</marquee>',
      after: '<p>Program special de sărbători</p>',
    },
    howToVerify: ['Pe pagină nu trebuie să existe text care se mișcă fără să poată fi oprit.'],
  },
];
