/**
 * Explicatii si remedieri in romana pentru regulile axe-core frecvente.
 *
 * Continut redactat de autorul proiectului pe baza documentatiei W3C (Understanding WCAG) si a
 * documentatiei Deque pentru fiecare regula. Statusul "de revizuit" ramane pana la revizuirea
 * de catre un specialist. Exemplele de cod sunt ilustrative: remedierea corecta depinde de
 * contextul fiecarei pagini.
 */
export interface Remediation {
  axeRuleId: string;
  titleRo: string;
  whatItMeans: string;
  whoIsAffected: string;
  howToFix: string[];
  example: { before: string; after: string; note?: string };
  howToVerify: string[];
}

export const REMEDIATIONS_STATUS = 'redactat de autor, de revizuit de un specialist';

export const REMEDIATIONS: Remediation[] = [
  {
    axeRuleId: 'image-alt',
    titleRo: 'Imaginile trebuie să aibă text alternativ',
    whatItMeans:
      'O imagine nu are atributul alt (nici alt mijloc de a-i da un nume). Cititorul de ecran nu are ce să anunțe, sau citește numele fișierului.',
    whoIsAffected:
      'Persoanele nevăzătoare care folosesc cititoare de ecran și utilizatorii la care imaginile nu se încarcă.',
    howToFix: [
      'Dacă imaginea transmite informație, adaugă un text alternativ care spune exact acea informație.',
      'Dacă imaginea este doar decorativă, folosește alt gol (alt=""), ca să fie ignorată.',
      'Nu repeta textul din jur și nu începe cu „imagine cu…”.',
    ],
    example: {
      before: '<img src="sediu.jpg">',
      after: '<img src="sediu.jpg" alt="Intrarea principală în sediul primăriei">',
      note: 'Pentru o imagine decorativă: <img src="ornament.svg" alt="">',
    },
    howToVerify: [
      'Ascultă pagina cu un cititor de ecran: imaginea informativă trebuie anunțată cu un text care are sens.',
      'Textul alternativ nu trebuie să fie numele fișierului (ex. „IMG_2041.jpg”).',
    ],
  },
  {
    axeRuleId: 'color-contrast',
    titleRo: 'Textul trebuie să aibă contrast suficient față de fundal',
    whatItMeans:
      'Diferența de luminozitate dintre text și fundal este prea mică: sub 4,5:1 pentru textul normal sau sub 3:1 pentru textul mare.',
    whoIsAffected:
      'Persoanele cu vedere slabă, persoanele în vârstă și oricine citește pe un ecran în lumină puternică.',
    howToFix: [
      'Închide culoarea textului sau deschide fundalul până la un raport de cel puțin 4,5:1.',
      'Pentru text peste imagini, adaugă un fundal semitransparent sub text sau o umbră.',
      'Verifică noile culori cu un calculator de contrast.',
    ],
    example: {
      before: '.intro { color: #b5b5b5; } /* pe fundal alb: aprox. 2:1 */',
      after: '.intro { color: #55554f; } /* pe fundal alb: peste 7:1 */',
    },
    howToVerify: [
      'Măsoară raportul de contrast cu un instrument dedicat (ex. din instrumentele pentru dezvoltatori ale browserului).',
      'Pentru textul peste imagini, verifică zona cea mai deschisă a imaginii.',
    ],
  },
  {
    axeRuleId: 'label',
    titleRo: 'Câmpurile de formular trebuie să aibă etichete',
    whatItMeans:
      'Un câmp nu are o etichetă legată de el. Cititorul de ecran anunță doar „câmp de text”, fără să spună ce trebuie completat.',
    whoIsAffected:
      'Utilizatorii de cititoare de ecran, utilizatorii de comandă vocală și persoanele cu dificultăți cognitive.',
    howToFix: [
      'Adaugă un element <label> cu atributul for egal cu id-ul câmpului.',
      'Eticheta trebuie să fie vizibilă; textul din placeholder nu înlocuiește eticheta (dispare la tastare).',
    ],
    example: {
      before: '<input name="nume" placeholder="Nume și prenume">',
      after: '<label for="nume">Nume și prenume</label>\n<input id="nume" name="nume">',
    },
    howToVerify: [
      'Dă click pe etichetă: cursorul trebuie să ajungă în câmp.',
      'Cu un cititor de ecran, la intrarea în câmp trebuie anunțată eticheta.',
    ],
  },
  {
    axeRuleId: 'select-name',
    titleRo: 'Listele de selecție trebuie să aibă un nume accesibil',
    whatItMeans:
      'O listă derulantă (<select>) nu are etichetă, deci nu se știe ce alegere se face.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran și de comandă vocală.',
    howToFix: [
      'Adaugă un <label> legat de listă prin atributul for.',
      'Dacă o etichetă vizibilă nu e posibilă, folosește aria-label (soluție de rezervă).',
    ],
    example: {
      before: '<select name="departament">…</select>',
      after:
        '<label for="departament">Departament</label>\n<select id="departament" name="departament">…</select>',
    },
    howToVerify: [
      'Cu un cititor de ecran, la focus pe listă trebuie anunțată eticheta „Departament”.',
    ],
  },
  {
    axeRuleId: 'button-name',
    titleRo: 'Butoanele trebuie să aibă un nume accesibil',
    whatItMeans:
      'Un buton nu are text (de obicei conține doar o iconiță), deci cititorul de ecran anunță doar „buton”.',
    whoIsAffected:
      'Utilizatorii de cititoare de ecran și de comandă vocală (nu pot spune „apasă Caută”).',
    howToFix: [
      'Adaugă text vizibil în buton sau un text ascuns vizual, dar citit de cititorul de ecran.',
      'Iconița decorativă trebuie ascunsă cu aria-hidden="true".',
    ],
    example: {
      before: '<button type="submit"><svg>…</svg></button>',
      after:
        '<button type="submit">\n  <svg aria-hidden="true" focusable="false">…</svg>\n  <span class="visually-hidden">Caută</span>\n</button>',
    },
    howToVerify: ['Cu un cititor de ecran, butonul trebuie anunțat „Caută, buton”.'],
  },
  {
    axeRuleId: 'link-name',
    titleRo: 'Linkurile trebuie să aibă un nume accesibil',
    whatItMeans: 'Un link nu are text (de obicei doar o iconiță), deci nu se știe unde duce.',
    whoIsAffected:
      'Utilizatorii de cititoare de ecran, care parcurg adesea doar lista linkurilor din pagină.',
    howToFix: [
      'Adaugă text în link (vizibil sau ascuns vizual) care spune destinația.',
      'Ascunde iconița decorativă cu aria-hidden="true".',
    ],
    example: {
      before: '<a href="https://facebook.com/primaria"><svg>…</svg></a>',
      after:
        '<a href="https://facebook.com/primaria">\n  <svg aria-hidden="true" focusable="false">…</svg>\n  <span class="visually-hidden">Pagina de Facebook a primăriei</span>\n</a>',
    },
    howToVerify: [
      'Afișează lista linkurilor cu un cititor de ecran: fiecare link trebuie să aibă un nume care spune destinația.',
    ],
  },
  {
    axeRuleId: 'html-has-lang',
    titleRo: 'Pagina trebuie să își declare limba',
    whatItMeans:
      'Elementul <html> nu are atributul lang. Cititorul de ecran nu știe ce limbă să folosească și poate pronunța textul românesc cu reguli englezești.',
    whoIsAffected:
      'Utilizatorii de cititoare de ecran; și traducerea automată sau corectorul ortografic pot funcționa greșit.',
    howToFix: ['Adaugă lang="ro" pe elementul <html>.'],
    example: { before: '<html>', after: '<html lang="ro">' },
    howToVerify: [
      'Ascultă pagina cu un cititor de ecran: textul trebuie pronunțat corect în română.',
    ],
  },
  {
    axeRuleId: 'html-lang-valid',
    titleRo: 'Limba declarată a paginii trebuie să fie validă',
    whatItMeans: 'Atributul lang are o valoare care nu e un cod de limbă valid (ex. „romana”).',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Folosește codul standard al limbii: „ro” pentru română.'],
    example: { before: '<html lang="romana">', after: '<html lang="ro">' },
    howToVerify: ['Verifică în codul sursă că valoarea este un cod de limbă (ex. ro, en, hu).'],
  },
  {
    axeRuleId: 'document-title',
    titleRo: 'Pagina trebuie să aibă un titlu',
    whatItMeans:
      'Lipsește elementul <title>. Titlul apare în fila browserului și este primul lucru anunțat de cititorul de ecran.',
    whoIsAffected:
      'Utilizatorii de cititoare de ecran și oricine are multe file deschise; și motoarele de căutare.',
    howToFix: ['Adaugă în <head> un <title> unic, care descrie pagina, de la specific la general.'],
    example: {
      before: '<head>\n  <meta charset="UTF-8">\n</head>',
      after:
        '<head>\n  <meta charset="UTF-8">\n  <title>Anunțuri — Primăria Valea Verde</title>\n</head>',
    },
    howToVerify: ['Fila browserului trebuie să afișeze un titlu care spune ce conține pagina.'],
  },
  {
    axeRuleId: 'meta-viewport',
    titleRo: 'Mărirea paginii (zoom) nu trebuie blocată',
    whatItMeans:
      'Eticheta meta viewport conține user-scalable=no sau maximum-scale prea mic, deci pe telefon pagina nu poate fi mărită.',
    whoIsAffected: 'Persoanele cu vedere slabă, care măresc textul pe telefon.',
    howToFix: ['Elimină user-scalable=no și maximum-scale din eticheta meta viewport.'],
    example: {
      before:
        '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">',
      after: '<meta name="viewport" content="width=device-width, initial-scale=1">',
    },
    howToVerify: [
      'Pe un telefon, mărește pagina cu două degete: trebuie să se poată mări cel puțin de 2 ori.',
    ],
  },
  {
    axeRuleId: 'aria-valid-attr',
    titleRo: 'Atributele ARIA trebuie să aibă nume valide',
    whatItMeans:
      'Un atribut ARIA e scris greșit (ex. aria-labeledby în loc de aria-labelledby), deci browserul îl ignoră.',
    whoIsAffected:
      'Utilizatorii de tehnologii asistive, care nu primesc informația pe care autorul voia s-o dea.',
    howToFix: [
      'Corectează numele atributului după specificația WAI-ARIA.',
      'Elimină atributul dacă nu e necesar.',
    ],
    example: {
      before: '<input id="email" aria-labeledby="eticheta-email">',
      after: '<input id="email" aria-labelledby="eticheta-email">',
    },
    howToVerify: [
      'Verifică în instrumentele pentru dezvoltatori (arborele de accesibilitate) că elementul are numele așteptat.',
    ],
  },
  {
    axeRuleId: 'heading-order',
    titleRo: 'Nivelurile titlurilor ar trebui să crească pe rând',
    whatItMeans:
      'Se sare un nivel de titlu (ex. de la h2 direct la h4). Bună practică, nu criteriu WCAG obligatoriu.',
    whoIsAffected:
      'Utilizatorii de cititoare de ecran, care navighează pagina după titluri și își fac o imagine a structurii ei.',
    howToFix: [
      'Folosește nivelurile în ordine: h1 → h2 → h3.',
      'Dacă vrei doar un text mai mic, schimbă stilul (CSS), nu nivelul titlului.',
    ],
    example: {
      before: '<h2>Anunțuri</h2>\n<h4>Program special de sărbători</h4>',
      after: '<h2>Anunțuri</h2>\n<h3>Program special de sărbători</h3>',
    },
    howToVerify: [
      'Afișează lista titlurilor cu un cititor de ecran sau cu o extensie: structura trebuie să fie logică.',
    ],
  },
  {
    axeRuleId: 'landmark-one-main',
    titleRo: 'Pagina ar trebui să aibă o zonă principală (main)',
    whatItMeans:
      'Pagina nu are un element <main>. Bună practică: ajută la sărirea directă la conținutul principal.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran și de tastatură.',
    howToFix: ['Pune conținutul principal al paginii într-un singur element <main>.'],
    example: {
      before: '<div class="main">…</div>',
      after: '<main id="continut">…</main>',
    },
    howToVerify: [
      'Cu un cititor de ecran, navigarea pe repere trebuie să găsească zona „principală”.',
    ],
  },
  {
    axeRuleId: 'region',
    titleRo: 'Tot conținutul ar trebui să fie în repere',
    whatItMeans:
      'Există conținut în afara reperelor HTML (header, nav, main, footer). Bună practică: fără repere, pagina e greu de parcurs pe zone.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran, care sar între zonele paginii.',
    howToFix: [
      'Împarte pagina în repere: <header>, <nav>, <main>, <footer>.',
      'Folosește elementele HTML potrivite în loc de <div>-uri generice.',
    ],
    example: {
      before:
        '<div class="site-header">…</div>\n<div class="main">…</div>\n<div class="site-footer">…</div>',
      after: '<header>…</header>\n<main>…</main>\n<footer>…</footer>',
    },
    howToVerify: [
      'Cu un cititor de ecran, lista reperelor trebuie să acopere toate zonele importante ale paginii.',
    ],
  },
];
