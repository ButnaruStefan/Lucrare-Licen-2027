/**
 * Remedieri in romana pentru regulile axe-core despre atributele si rolurile ARIA.
 *
 * Parte a catalogului de remedieri (vezi `../remedieri-ro.ts`, care le aduna pe toate).
 * Redactate de autorul proiectului pe baza documentatiei Deque si a specificatiei WAI-ARIA;
 * de revizuit de un specialist.
 */
import type { Remediation } from '../remedieri-ro';

export const REMEDIATIONS_ARIA: Remediation[] = [
  {
    axeRuleId: 'aria-allowed-attr',
    titleRo: 'Elementele trebuie să folosească doar atribute ARIA permise pentru rolul lor',
    whatItMeans:
      'Un element are un atribut ARIA care nu e permis pentru rolul lui (ex. aria-checked pe un link). Tehnologiile asistive îl ignoră sau îl interpretează greșit.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran și alte tehnologii asistive.',
    howToFix: [
      'Verifică în specificația WAI-ARIA ce atribute sunt permise pentru rolul elementului.',
      'Elimină atributul nepermis sau schimbă rolul elementului cu unul potrivit.',
    ],
    example: {
      before: '<a href="/abonare" aria-checked="true">Abonare</a>',
      after: '<a href="/abonare">Abonare</a>',
    },
    howToVerify: [
      'În arborele de accesibilitate al browserului, elementul nu trebuie să aibă proprietăți nepotrivite rolului.',
    ],
  },
  {
    axeRuleId: 'aria-allowed-role',
    titleRo: 'Rolul ARIA ar trebui să fie potrivit pentru element',
    whatItMeans:
      'Un element HTML are un rol ARIA care nu i se potrivește (ex. un <button> cu role="link"). Bună practică, nu criteriu WCAG obligatoriu.',
    whoIsAffected:
      'Utilizatorii de cititoare de ecran, care aud un tip de element diferit de cel care funcționează de fapt.',
    howToFix: [
      'Folosește elementul HTML care are deja rolul dorit (ex. <a> pentru un link) și elimină atributul role.',
      'Dacă rolul nu e necesar, elimină-l.',
    ],
    example: {
      before: '<button role="link" onclick="location.href=\'/contact\'">Contact</button>',
      after: '<a href="/contact">Contact</a>',
    },
    howToVerify: [
      'Cu un cititor de ecran, elementul trebuie anunțat cu tipul care corespunde comportamentului lui.',
    ],
  },
  {
    axeRuleId: 'aria-braille-equivalent',
    titleRo: 'Atributele ARIA pentru Braille trebuie să aibă un echivalent obișnuit',
    whatItMeans:
      'Un element folosește aria-braillelabel sau aria-brailleroledescription fără aria-label, respectiv aria-roledescription. Varianta Braille completează textul obișnuit, nu îl înlocuiește.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran, cu sau fără afișaj Braille.',
    howToFix: [
      'Adaugă un nume accesibil obișnuit (ex. aria-label sau text vizibil) lângă aria-braillelabel.',
      'Adaugă aria-roledescription lângă aria-brailleroledescription.',
    ],
    example: {
      before: '<button aria-braillelabel="✓"><img src="bifa.svg" alt=""></button>',
      after:
        '<button aria-label="Confirmă" aria-braillelabel="✓"><img src="bifa.svg" alt=""></button>',
    },
    howToVerify: [
      'Cu un cititor de ecran fără afișaj Braille, elementul trebuie anunțat cu un nume clar.',
    ],
  },
  {
    axeRuleId: 'aria-command-name',
    titleRo: 'Comenzile ARIA (butoane, linkuri, opțiuni de meniu) trebuie să aibă un nume',
    whatItMeans:
      'Un element cu role="button", "link" sau "menuitem" nu are un nume accesibil, deci cititorul de ecran nu poate spune ce face.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran și de comandă vocală.',
    howToFix: [
      'Adaugă text în element sau un nume prin aria-label ori aria-labelledby.',
      'Mai bine: folosește elementele native <button> și <a>, cu text.',
    ],
    example: {
      before: '<div role="button" tabindex="0"><svg>…</svg></div>',
      after: '<button type="button"><svg aria-hidden="true">…</svg> Închide</button>',
    },
    howToVerify: [
      'Cu un cititor de ecran, comanda trebuie anunțată cu numele ei (ex. „Închide, buton”).',
    ],
  },
  {
    axeRuleId: 'aria-conditional-attr',
    titleRo: 'Atributele ARIA trebuie folosite așa cum cere rolul elementului',
    whatItMeans:
      'Un atribut ARIA e permis doar în anumite condiții și e folosit în afara lor (ex. aria-checked pe un <input type="checkbox">, unde starea nativă poate intra în conflict cu atributul).',
    whoIsAffected:
      'Utilizatorii de cititoare de ecran, care pot primi o stare diferită de cea reală.',
    howToFix: [
      'Pentru elementele native (ex. casete de bifat), lasă browserul să comunice starea: elimină atributul ARIA.',
      'Folosește atributele condiționate doar în contextul cerut de specificația WAI-ARIA.',
    ],
    example: {
      before: '<input type="checkbox" aria-checked="true">',
      after: '<input type="checkbox" checked>',
    },
    howToVerify: [
      'Schimbă starea elementului și verifică, cu un cititor de ecran, că starea anunțată e cea reală.',
    ],
  },
  {
    axeRuleId: 'aria-deprecated-role',
    titleRo: 'Nu trebuie folosite roluri ARIA învechite',
    whatItMeans:
      'Un element folosește un rol ARIA scos din specificație (ex. role="directory"). Tehnologiile asistive noi s-ar putea să nu-l mai recunoască.',
    whoIsAffected: 'Utilizatorii de tehnologii asistive.',
    howToFix: [
      'Înlocuiește rolul învechit cu cel recomandat (ex. role="directory" devine o listă: <ul>).',
    ],
    example: {
      before: '<div role="directory">…</div>',
      after: '<ul>…</ul>',
    },
    howToVerify: [
      'Verifică în arborele de accesibilitate că elementul are un rol valid în versiunea curentă WAI-ARIA.',
    ],
  },
  {
    axeRuleId: 'aria-dialog-name',
    titleRo: 'Ferestrele de dialog ar trebui să aibă un nume',
    whatItMeans:
      'Un dialog (role="dialog" sau "alertdialog") nu are nume, deci la deschidere cititorul de ecran nu spune despre ce e vorba. Bună practică.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Leagă dialogul de titlul lui cu aria-labelledby, sau dă-i un nume cu aria-label.'],
    example: {
      before: '<div role="dialog">\n  <h2>Confirmă ștergerea</h2>…\n</div>',
      after:
        '<div role="dialog" aria-labelledby="titlu-dialog">\n  <h2 id="titlu-dialog">Confirmă ștergerea</h2>…\n</div>',
    },
    howToVerify: [
      'Deschide dialogul cu un cititor de ecran: trebuie anunțat titlul lui (ex. „Confirmă ștergerea, dialog”).',
    ],
  },
  {
    axeRuleId: 'aria-hidden-body',
    titleRo: 'Corpul paginii nu trebuie ascuns cu aria-hidden',
    whatItMeans:
      'Elementul <body> are aria-hidden="true", deci toată pagina e ascunsă pentru tehnologiile asistive.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran, care nu mai pot accesa nimic din pagină.',
    howToFix: [
      'Elimină aria-hidden de pe <body>.',
      'Dacă vrei să ascunzi fundalul când e deschis un dialog, ascunde doar zonele din spatele lui (sau folosește atributul inert).',
    ],
    example: {
      before: '<body aria-hidden="true">',
      after: '<body>',
    },
    howToVerify: ['Cu un cititor de ecran, conținutul paginii trebuie să poată fi citit.'],
  },
  {
    axeRuleId: 'aria-hidden-focus',
    titleRo: 'Elementele ascunse cu aria-hidden nu trebuie să poată primi focus',
    whatItMeans:
      'Un element ascuns cu aria-hidden="true" conține linkuri, butoane sau câmpuri care pot primi focus. Utilizatorul de tastatură ajunge pe ele, dar cititorul de ecran nu anunță nimic.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran care navighează cu tastatura.',
    howToFix: [
      'Dacă elementele trebuie ascunse, scoate-le și din ordinea de focus (ex. tabindex="-1", hidden sau inert).',
      'Dacă trebuie să fie folosibile, elimină aria-hidden.',
    ],
    example: {
      before: '<div aria-hidden="true">\n  <a href="/meniu">Meniu</a>\n</div>',
      after: '<div aria-hidden="true" inert>\n  <a href="/meniu">Meniu</a>\n</div>',
    },
    howToVerify: [
      'Parcurge pagina cu Tab: focusul nu trebuie să ajungă pe elemente care nu sunt anunțate de cititorul de ecran.',
    ],
  },
  {
    axeRuleId: 'aria-input-field-name',
    titleRo: 'Câmpurile ARIA trebuie să aibă un nume accesibil',
    whatItMeans:
      'Un câmp construit cu ARIA (ex. role="combobox", "listbox", "searchbox", "slider", "spinbutton", "textbox") nu are nume, deci nu se știe ce trebuie completat.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran și de comandă vocală.',
    howToFix: [
      'Leagă câmpul de o etichetă vizibilă cu aria-labelledby, sau dă-i un nume cu aria-label.',
      'Unde se poate, folosește elementele native (<input>, <select>) cu <label>.',
    ],
    example: {
      before: '<div role="combobox" tabindex="0">…</div>',
      after:
        '<span id="eticheta-oras">Oraș</span>\n<div role="combobox" tabindex="0" aria-labelledby="eticheta-oras">…</div>',
    },
    howToVerify: ['Cu un cititor de ecran, la focus pe câmp trebuie anunțată eticheta lui.'],
  },
  {
    axeRuleId: 'aria-meter-name',
    titleRo: 'Indicatoarele de nivel (meter) trebuie să aibă un nume',
    whatItMeans:
      'Un element cu role="meter" (ex. nivelul unei baterii sau al unui spațiu de stocare) nu are nume, deci nu se știe ce măsoară.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Adaugă un nume cu aria-label sau aria-labelledby.'],
    example: {
      before: '<div role="meter" aria-valuenow="70" aria-valuemin="0" aria-valuemax="100"></div>',
      after:
        '<div role="meter" aria-label="Spațiu de stocare folosit" aria-valuenow="70" aria-valuemin="0" aria-valuemax="100"></div>',
    },
    howToVerify: ['Cu un cititor de ecran, indicatorul trebuie anunțat cu numele și valoarea lui.'],
  },
  {
    axeRuleId: 'aria-progressbar-name',
    titleRo: 'Barele de progres trebuie să aibă un nume',
    whatItMeans:
      'Un element cu role="progressbar" nu are nume, deci nu se știe progresul cărei operații îl arată.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Adaugă un nume cu aria-label sau aria-labelledby.'],
    example: {
      before: '<div role="progressbar" aria-valuenow="40"></div>',
      after:
        '<div role="progressbar" aria-label="Încărcarea documentului" aria-valuenow="40"></div>',
    },
    howToVerify: ['Cu un cititor de ecran, bara trebuie anunțată cu numele și procentul.'],
  },
  {
    axeRuleId: 'aria-prohibited-attr',
    titleRo: 'Elementele trebuie să folosească doar atribute ARIA permise',
    whatItMeans:
      'Un element are un atribut ARIA interzis pentru rolul lui. Cel mai des: aria-label pe un <div> sau <span> fără rol, unde cititoarele de ecran îl ignoră.',
    whoIsAffected:
      'Utilizatorii de cititoare de ecran, care nu primesc informația pusă în atributul interzis.',
    howToFix: [
      'Pune informația ca text vizibil (sau ascuns vizual) în element.',
      'Sau dă elementului un rol potrivit, care permite atributul.',
    ],
    example: {
      before: '<span aria-label="5 stele din 5">★★★★★</span>',
      after:
        '<span aria-hidden="true">★★★★★</span>\n<span class="visually-hidden">5 stele din 5</span>',
    },
    howToVerify: [
      'Cu un cititor de ecran, informația trebuie anunțată (ex. „5 stele din 5”), nu ignorată.',
    ],
  },
  {
    axeRuleId: 'aria-required-attr',
    titleRo: 'Rolurile ARIA trebuie să aibă atributele obligatorii',
    whatItMeans:
      'Un element are un rol care cere anumite atribute, dar acestea lipsesc (ex. role="checkbox" fără aria-checked, role="slider" fără aria-valuenow).',
    whoIsAffected:
      'Utilizatorii de cititoare de ecran, care nu află starea sau valoarea elementului.',
    howToFix: [
      'Adaugă atributele cerute de rol și actualizează-le din JavaScript când se schimbă starea.',
      'Mai simplu: folosește elementul HTML nativ (ex. <input type="checkbox">).',
    ],
    example: {
      before: '<div role="checkbox" tabindex="0">Accept termenii</div>',
      after: '<div role="checkbox" tabindex="0" aria-checked="false">Accept termenii</div>',
    },
    howToVerify: [
      'Schimbă starea elementului: cititorul de ecran trebuie să anunțe noua stare (ex. „bifat”).',
    ],
  },
  {
    axeRuleId: 'aria-required-children',
    titleRo: 'Anumite roluri ARIA trebuie să conțină anumite elemente',
    whatItMeans:
      'Un element are un rol care cere elemente-copil anume, dar acestea lipsesc (ex. role="list" fără role="listitem", role="tablist" fără role="tab").',
    whoIsAffected:
      'Utilizatorii de cititoare de ecran, care nu pot parcurge corect structura (ex. „listă cu 5 elemente”).',
    howToFix: [
      'Adaugă copiilor rolurile cerute.',
      'Sau folosește elementele HTML native (ex. <ul> cu <li>).',
    ],
    example: {
      before: '<div role="list">\n  <div>Primul</div>\n</div>',
      after: '<div role="list">\n  <div role="listitem">Primul</div>\n</div>',
    },
    howToVerify: [
      'Cu un cititor de ecran, structura trebuie anunțată corect (ex. „listă, 3 elemente”).',
    ],
  },
  {
    axeRuleId: 'aria-required-parent',
    titleRo: 'Anumite roluri ARIA trebuie să fie în interiorul anumitor elemente',
    whatItMeans:
      'Un element are un rol care trebuie să stea într-un părinte anume, dar nu stă (ex. role="listitem" în afara unei liste, role="tab" în afara unui role="tablist").',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: [
      'Pune elementul într-un părinte cu rolul cerut, sau folosește elementele HTML native.',
    ],
    example: {
      before: '<div role="tab">Detalii</div>',
      after: '<div role="tablist">\n  <div role="tab">Detalii</div>\n</div>',
    },
    howToVerify: [
      'Cu un cititor de ecran, elementul trebuie anunțat în contextul lui (ex. „filă 1 din 3”).',
    ],
  },
  {
    axeRuleId: 'aria-roledescription',
    titleRo: 'aria-roledescription trebuie folosit doar pe elemente cu rol',
    whatItMeans:
      'Atributul aria-roledescription (descrierea personalizată a tipului de element) e pus pe un element fără rol semantic, unde e ignorat. Regulă scoasă din uz în axe-core.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: [
      'Pune aria-roledescription doar pe elemente cu rol (ex. un <button>), sau elimină-l.',
    ],
    example: {
      before: '<div aria-roledescription="diapozitiv">…</div>',
      after: '<section aria-roledescription="diapozitiv" aria-label="1 din 5">…</section>',
    },
    howToVerify: ['Cu un cititor de ecran, descrierea trebuie anunțată doar unde are sens.'],
  },
  {
    axeRuleId: 'aria-roles',
    titleRo: 'Rolurile ARIA trebuie să aibă valori valide',
    whatItMeans:
      'Atributul role are o valoare care nu există în specificația WAI-ARIA (ex. role="buton" sau o greșeală de scriere), deci e ignorat.',
    whoIsAffected: 'Utilizatorii de tehnologii asistive.',
    howToFix: ['Corectează valoarea (ex. role="button") sau elimină atributul.'],
    example: {
      before: '<div role="buton" tabindex="0">Trimite</div>',
      after: '<button type="submit">Trimite</button>',
    },
    howToVerify: ['Verifică în arborele de accesibilitate că elementul are rolul dorit.'],
  },
  {
    axeRuleId: 'aria-tab-name',
    titleRo: 'Filele ARIA trebuie să aibă un nume',
    whatItMeans: 'Un element cu role="tab" nu are nume, deci nu se știe ce conține fila.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Pune text vizibil în filă, sau dă-i un nume cu aria-label.'],
    example: {
      before: '<button role="tab"><svg>…</svg></button>',
      after: '<button role="tab"><svg aria-hidden="true">…</svg> Documente</button>',
    },
    howToVerify: ['Cu un cititor de ecran, fiecare filă trebuie anunțată cu numele ei.'],
  },
  {
    axeRuleId: 'aria-text',
    titleRo: 'Elementele cu role="text" nu ar trebui să conțină elemente care primesc focus',
    whatItMeans:
      'role="text" face ca un grup de elemente să fie citit ca un singur text. Dacă înăuntru e un link sau buton, acesta nu mai e anunțat corect. Bună practică.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Scoate elementele interactive din grupul cu role="text", sau elimină role="text".'],
    example: {
      before: '<p role="text">Preț: <a href="/oferta">99 lei</a></p>',
      after: '<p>Preț: <a href="/oferta">99 lei</a></p>',
    },
    howToVerify: ['Cu un cititor de ecran, linkurile din text trebuie anunțate ca linkuri.'],
  },
  {
    axeRuleId: 'aria-toggle-field-name',
    titleRo: 'Comutatoarele ARIA trebuie să aibă un nume',
    whatItMeans:
      'Un element cu role="checkbox", "radio", "switch", "menuitemcheckbox" sau "menuitemradio" nu are nume, deci nu se știe ce activează.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran și de comandă vocală.',
    howToFix: [
      'Pune text în element sau leagă-l de o etichetă cu aria-labelledby.',
      'Mai bine: folosește <input type="checkbox"> sau "radio" cu <label>.',
    ],
    example: {
      before: '<div role="switch" tabindex="0" aria-checked="false"></div>',
      after: '<div role="switch" tabindex="0" aria-checked="false">Notificări prin e-mail</div>',
    },
    howToVerify: [
      'Cu un cititor de ecran, comutatorul trebuie anunțat cu numele și starea (ex. „Notificări prin e-mail, oprit”).',
    ],
  },
  {
    axeRuleId: 'aria-tooltip-name',
    titleRo: 'Explicațiile la trecerea mouse-ului (tooltip) trebuie să aibă un nume',
    whatItMeans: 'Un element cu role="tooltip" e gol sau nu are nume accesibil.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Pune textul explicației în element, sau dă-i un nume cu aria-label.'],
    example: {
      before: '<div role="tooltip" id="ajutor-cnp"></div>',
      after: '<div role="tooltip" id="ajutor-cnp">Codul numeric personal are 13 cifre.</div>',
    },
    howToVerify: [
      'Cu un cititor de ecran, explicația trebuie anunțată când elementul legat de ea primește focus.',
    ],
  },
  {
    axeRuleId: 'aria-treeitem-name',
    titleRo: 'Elementele unui arbore ARIA ar trebui să aibă un nume',
    whatItMeans:
      'Un element cu role="treeitem" (ex. un dosar dintr-o listă ierarhică) nu are nume. Bună practică.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Pune text în element, sau dă-i un nume cu aria-label.'],
    example: {
      before: '<li role="treeitem"><svg>…</svg></li>',
      after: '<li role="treeitem"><svg aria-hidden="true">…</svg> Hotărâri 2026</li>',
    },
    howToVerify: [
      'Cu un cititor de ecran, fiecare element al arborelui trebuie anunțat cu numele lui.',
    ],
  },
  {
    axeRuleId: 'aria-valid-attr-value',
    titleRo: 'Atributele ARIA trebuie să aibă valori valide',
    whatItMeans:
      'Un atribut ARIA are o valoare nepermisă (ex. aria-expanded="da" în loc de "true", sau aria-labelledby care trimite la un id inexistent).',
    whoIsAffected:
      'Utilizatorii de tehnologii asistive, care primesc informații greșite sau deloc.',
    howToFix: [
      'Folosește doar valorile permise de specificație (ex. "true" / "false").',
      'Verifică că id-urile din aria-labelledby, aria-describedby sau aria-controls există în pagină.',
    ],
    example: {
      before: '<button aria-expanded="da">Meniu</button>',
      after: '<button aria-expanded="false">Meniu</button>',
    },
    howToVerify: ['Verifică în arborele de accesibilitate că starea elementului e cea așteptată.'],
  },
  {
    axeRuleId: 'presentation-role-conflict',
    titleRo: 'Elementele marcate decorative ar trebui ignorate complet',
    whatItMeans:
      'Un element are role="none" sau "presentation" (adică „ignoră-mă”), dar are și atribute ARIA globale sau poate primi focus, deci browserul nu-l poate ignora. Bună practică.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: [
      'Dacă elementul e cu adevărat decorativ, elimină tabindex și atributele ARIA.',
      'Dacă transmite informație sau e interactiv, elimină role="none" / "presentation".',
    ],
    example: {
      before: '<img src="linie.svg" role="presentation" aria-label="Separator" tabindex="0">',
      after: '<img src="linie.svg" alt="">',
    },
    howToVerify: [
      'Cu Tab, focusul nu trebuie să ajungă pe elemente decorative; cititorul de ecran nu trebuie să le anunțe.',
    ],
  },
];
