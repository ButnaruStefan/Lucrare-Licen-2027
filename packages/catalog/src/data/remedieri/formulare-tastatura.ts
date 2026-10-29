/**
 * Remedieri in romana pentru regulile axe-core despre culori, formulare si tastatura.
 *
 * Parte a catalogului de remedieri (vezi `../remedieri-ro.ts`, care le aduna pe toate).
 * Redactate de autorul proiectului pe baza documentatiei Deque si W3C; de revizuit de un specialist.
 */
import type { Remediation } from '../remedieri-ro';

export const REMEDIATIONS_FORMS_KEYBOARD: Remediation[] = [
  // ─── Culori ───
  {
    axeRuleId: 'color-contrast-enhanced',
    titleRo: 'Textul ar trebui să aibă contrast ridicat față de fundal (nivel AAA)',
    whatItMeans:
      'Contrastul dintre text și fundal e sub pragul ridicat: 7:1 pentru textul normal, 4,5:1 pentru textul mare. E un criteriu de nivel AAA, mai strict decât cel cerut de obicei (AA).',
    whoIsAffected: 'Persoanele cu vedere slabă, mai ales cele cu sensibilitate redusă la contrast.',
    howToFix: [
      'Închide culoarea textului sau deschide fundalul până la 7:1 (4,5:1 pentru textul mare).',
      'Pentru textul important (ex. instrucțiuni, avertismente), urmărește nivelul AAA chiar dacă restul paginii respectă doar AA.',
    ],
    example: {
      before: '.nota { color: #6b6b6b; } /* pe alb: aprox. 5,3:1 */',
      after: '.nota { color: #4a4a4a; } /* pe alb: peste 8:1 */',
    },
    howToVerify: ['Măsoară raportul de contrast cu un calculator de contrast: cel puțin 7:1.'],
  },
  {
    axeRuleId: 'link-in-text-block',
    titleRo: 'Linkurile din text trebuie să se distingă și altfel decât prin culoare',
    whatItMeans:
      'Un link dintr-un paragraf se deosebește de textul din jur doar prin culoare (fără subliniere), iar diferența de contrast față de text e sub 3:1.',
    whoIsAffected:
      'Persoanele care nu disting culorile (ex. daltoniștii) și persoanele cu vedere slabă.',
    howToFix: [
      'Subliniază linkurile din text (cea mai simplă soluție).',
      'Sau asigură un contrast de cel puțin 3:1 față de textul din jur și un indiciu suplimentar la hover și focus.',
    ],
    example: {
      before: 'p a { color: #2a6db0; text-decoration: none; }',
      after: 'p a { color: #2a6db0; text-decoration: underline; }',
    },
    howToVerify: [
      'Privește pagina în tonuri de gri (ex. cu un filtru al sistemului): linkurile din text trebuie să se vadă.',
    ],
  },
  // ─── Formulare ───
  {
    axeRuleId: 'autocomplete-valid',
    titleRo: 'Atributul autocomplete trebuie folosit corect',
    whatItMeans:
      'Un câmp are atributul autocomplete cu o valoare nerecunoscută (ex. autocomplete="telefon" în loc de "tel"), deci browserul nu poate completa automat datele personale.',
    whoIsAffected:
      'Persoanele cu dificultăți motorii sau cognitive, pentru care completarea automată reduce efortul și greșelile.',
    howToFix: [
      'Folosește valorile standard din HTML: name, given-name, family-name, email, tel, street-address, postal-code etc.',
      'Pentru câmpurile care nu cer date personale, poți folosi autocomplete="off" sau poți elimina atributul.',
    ],
    example: {
      before: '<input id="tel" name="tel" autocomplete="telefon">',
      after: '<input id="tel" name="tel" type="tel" autocomplete="tel">',
    },
    howToVerify: [
      'Începe să completezi formularul: browserul trebuie să propună datele salvate potrivite câmpului.',
    ],
  },
  {
    axeRuleId: 'form-field-multiple-labels',
    titleRo: 'Un câmp de formular nu trebuie să aibă mai multe etichete',
    whatItMeans:
      'Același câmp e legat de mai multe elemente <label>. Cititoarele de ecran pot anunța doar una dintre ele sau le pot combina confuz.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran și de comandă vocală.',
    howToFix: [
      'Păstrează o singură etichetă pentru câmp.',
      'Informațiile suplimentare (ex. formatul cerut) leagă-le cu aria-describedby.',
    ],
    example: {
      before:
        '<label for="data">Data nașterii</label>\n<label for="data">(zz.ll.aaaa)</label>\n<input id="data">',
      after:
        '<label for="data">Data nașterii</label>\n<span id="format-data">(zz.ll.aaaa)</span>\n<input id="data" aria-describedby="format-data">',
    },
    howToVerify: [
      'Cu un cititor de ecran, câmpul trebuie anunțat cu eticheta, apoi cu indicația de format.',
    ],
  },
  {
    axeRuleId: 'label-title-only',
    titleRo: 'Câmpurile ar trebui să aibă o etichetă vizibilă',
    whatItMeans:
      'Un câmp are nume doar prin atributul title sau aria-describedby, fără etichetă vizibilă. Bună practică: title apare doar la trecerea mouse-ului și nu e disponibil pe telefon sau cu tastatura.',
    whoIsAffected:
      'Toți utilizatorii, mai ales cei care folosesc tastatura, telefonul sau au dificultăți cognitive.',
    howToFix: ['Adaugă un <label> vizibil, legat de câmp prin atributul for.'],
    example: {
      before: '<input id="cauta" title="Caută pe site">',
      after: '<label for="cauta">Caută pe site</label>\n<input id="cauta">',
    },
    howToVerify: [
      'Fiecare câmp trebuie să aibă deasupra sau alături un text care spune ce se completează.',
    ],
  },
  // ─── Tastatura ───
  {
    axeRuleId: 'accesskeys',
    titleRo: 'Tastele de acces (accesskey) ar trebui să fie unice',
    whatItMeans:
      'Mai multe elemente au aceeași tastă de acces (atributul accesskey), deci scurtătura duce doar la unul dintre ele. Bună practică.',
    whoIsAffected: 'Utilizatorii de tastatură care folosesc scurtături.',
    howToFix: [
      'Dă fiecărui element o tastă diferită, sau renunță la accesskey (poate intra în conflict cu scurtăturile browserului și ale cititoarelor de ecran).',
    ],
    example: {
      before: '<a href="/" accesskey="a">Acasă</a>\n<a href="/anunturi" accesskey="a">Anunțuri</a>',
      after: '<a href="/">Acasă</a>\n<a href="/anunturi">Anunțuri</a>',
    },
    howToVerify: ['Verifică în codul sursă că nicio valoare accesskey nu se repetă.'],
  },
  {
    axeRuleId: 'bypass',
    titleRo: 'Pagina trebuie să permită sărirea peste blocurile repetate',
    whatItMeans:
      'Pagina nu oferă nicio cale de a sări direct la conținutul principal: nici legătură „Sari la conținut”, nici titluri, nici repere (ex. <main>).',
    whoIsAffected:
      'Utilizatorii de tastatură și de cititoare de ecran, care trebuie să treacă prin tot meniul la fiecare pagină.',
    howToFix: [
      'Adaugă la începutul paginii o legătură „Sari la conținutul principal” către <main>.',
      'Folosește repere (<header>, <nav>, <main>) și titluri (<h1>, <h2>).',
    ],
    example: {
      before: '<body>\n  <nav>…50 de linkuri…</nav>\n  <div>Conținut</div>',
      after:
        '<body>\n  <a href="#continut" class="skip-link">Sari la conținutul principal</a>\n  <nav>…</nav>\n  <main id="continut">Conținut</main>',
    },
    howToVerify: [
      'Apasă Tab o dată după încărcarea paginii: trebuie să apară legătura de sărire; Enter trebuie să ducă la conținut.',
    ],
  },
  {
    axeRuleId: 'focus-order-semantics',
    titleRo: 'Elementele care primesc focus ar trebui să aibă un rol potrivit',
    whatItMeans:
      'Un element generic (ex. <div> cu tabindex="0") poate primi focus, dar nu are rol, deci cititorul de ecran nu spune ce este. Regulă experimentală, bună practică.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran care navighează cu tastatura.',
    howToFix: [
      'Folosește elementul nativ potrivit (<button>, <a>), sau adaugă un rol ARIA potrivit.',
      'Dacă elementul nu e interactiv, elimină tabindex.',
    ],
    example: {
      before: '<div tabindex="0" onclick="deschide()">Detalii</div>',
      after: '<button type="button" onclick="deschide()">Detalii</button>',
    },
    howToVerify: [
      'Parcurge pagina cu Tab și un cititor de ecran: fiecare element cu focus trebuie anunțat cu tipul lui.',
    ],
  },
  {
    axeRuleId: 'frame-focusable-content',
    titleRo: 'Cadrele cu conținut interactiv nu trebuie scoase din ordinea de focus',
    whatItMeans:
      'Un <iframe> are tabindex="-1", deși conține linkuri, butoane sau câmpuri. Utilizatorii de tastatură nu pot ajunge la ele.',
    whoIsAffected: 'Utilizatorii de tastatură.',
    howToFix: ['Elimină tabindex="-1" de pe <iframe>.'],
    example: {
      before: '<iframe src="/harta" title="Harta sediilor" tabindex="-1"></iframe>',
      after: '<iframe src="/harta" title="Harta sediilor"></iframe>',
    },
    howToVerify: [
      'Parcurge pagina cu Tab: focusul trebuie să intre în cadru și să ajungă la elementele lui.',
    ],
  },
  {
    axeRuleId: 'nested-interactive',
    titleRo: 'Elementele interactive nu trebuie puse unele în altele',
    whatItMeans:
      'Un element interactiv conține alt element interactiv (ex. un buton într-un link). Cititoarele de ecran și tastatura nu pot ajunge corect la elementul interior.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran și de tastatură.',
    howToFix: [
      'Separă elementele: pune butonul lângă link, nu în el.',
      'Pentru carduri cu link, folosește un singur link pe titlu și restul ca text.',
    ],
    example: {
      before: '<a href="/eveniment">\n  Concert de iarnă <button>Salvează</button>\n</a>',
      after: '<a href="/eveniment">Concert de iarnă</a>\n<button type="button">Salvează</button>',
    },
    howToVerify: [
      'Parcurge cu Tab: fiecare control trebuie să primească focus separat și să fie anunțat corect.',
    ],
  },
  {
    axeRuleId: 'scrollable-region-focusable',
    titleRo: 'Zonele cu derulare trebuie să poată fi folosite cu tastatura',
    whatItMeans:
      'O zonă cu bară de derulare proprie nu poate primi focus și nu conține nimic care primește focus, deci nu poate fi derulată din tastatură.',
    whoIsAffected: 'Utilizatorii de tastatură.',
    howToFix: [
      'Adaugă zonei tabindex="0", un rol (ex. role="region") și un nume (aria-label).',
      'Sau evită zonele cu derulare proprie și lasă conținutul să se extindă.',
    ],
    example: {
      before: '<div class="lista-lunga" style="overflow:auto; height:200px">…</div>',
      after:
        '<div class="lista-lunga" style="overflow:auto; height:200px" tabindex="0" role="region" aria-label="Lista hotărârilor">…</div>',
    },
    howToVerify: ['Ajungi cu Tab în zonă și o poți derula cu săgețile sus/jos.'],
  },
  {
    axeRuleId: 'skip-link',
    titleRo: 'Destinația legăturii „Sari la conținut” ar trebui să existe',
    whatItMeans:
      'Pagina are o legătură de sărire (ex. href="#continut"), dar elementul cu acel id nu există sau nu poate primi focus. Bună practică.',
    whoIsAffected: 'Utilizatorii de tastatură și de cititoare de ecran.',
    howToFix: [
      'Verifică că id-ul din legătură există (ex. <main id="continut">).',
      'Dacă destinația nu e un element care primește focus, adaugă-i tabindex="-1".',
    ],
    example: {
      before: '<a href="#continut">Sari la conținut</a>\n…\n<main id="principal">',
      after: '<a href="#continut">Sari la conținut</a>\n…\n<main id="continut" tabindex="-1">',
    },
    howToVerify: [
      'Apasă legătura de sărire cu Enter, apoi Tab: focusul trebuie să continue din conținutul principal.',
    ],
  },
  {
    axeRuleId: 'tabindex',
    titleRo: 'Elementele nu ar trebui să aibă tabindex mai mare decât 0',
    whatItMeans:
      'Un element are tabindex pozitiv (ex. tabindex="3"). Asta schimbă ordinea firească a focusului și o face greu de prevăzut. Bună practică.',
    whoIsAffected: 'Utilizatorii de tastatură și de cititoare de ecran.',
    howToFix: [
      'Folosește doar tabindex="0" (intră în ordinea firească) sau tabindex="-1" (focus doar din cod).',
      'Ordinea focusului trebuie să urmeze ordinea elementelor în HTML: rearanjează codul, nu numerele.',
    ],
    example: {
      before: '<input id="nume" tabindex="2">\n<input id="email" tabindex="1">',
      after: '<input id="nume">\n<input id="email">',
    },
    howToVerify: [
      'Parcurge pagina cu Tab: focusul trebuie să meargă în ordinea vizuală, de sus în jos și de la stânga la dreapta.',
    ],
  },
];
