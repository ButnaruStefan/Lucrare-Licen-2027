/**
 * Remedieri in romana pentru regulile axe-core despre tabele, texte alternative (imagini,
 * cadre, obiecte) si continut media sau care se schimba in timp.
 *
 * Parte a catalogului de remedieri (vezi `../remedieri-ro.ts`, care le aduna pe toate).
 * Redactate de autorul proiectului pe baza documentatiei Deque si W3C; de revizuit de un specialist.
 */
import type { Remediation } from '../remedieri-ro';

export const REMEDIATIONS_TABLES_MEDIA: Remediation[] = [
  // ─── Tabele ───
  {
    axeRuleId: 'scope-attr-valid',
    titleRo: 'Atributul scope ar trebui folosit corect',
    whatItMeans:
      'Atributul scope (care spune dacă un antet e al coloanei sau al rândului) e pus pe alt element decât <th>, sau are o valoare greșită. Bună practică.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran, la citirea tabelelor.',
    howToFix: [
      'Pune scope doar pe <th>, cu valoarea "col" (antet de coloană) sau "row" (antet de rând).',
    ],
    example: {
      before: '<td scope="coloana">Taxa</td>',
      after: '<th scope="col">Taxa</th>',
    },
    howToVerify: [
      'Cu un cititor de ecran, la mutarea între celule trebuie anunțat antetul corect.',
    ],
  },
  {
    axeRuleId: 'table-duplicate-name',
    titleRo: 'Tabelul nu ar trebui să aibă aceeași legendă și același rezumat',
    whatItMeans:
      'Tabelul are același text în <caption> și în atributul summary, deci cititorul de ecran îl anunță de două ori. Bună practică.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Păstrează doar <caption>; atributul summary e scos din uz în HTML.'],
    example: {
      before: '<table summary="Taxe locale 2026">\n  <caption>Taxe locale 2026</caption>',
      after: '<table>\n  <caption>Taxe locale 2026</caption>',
    },
    howToVerify: ['Cu un cititor de ecran, titlul tabelului trebuie anunțat o singură dată.'],
  },
  {
    axeRuleId: 'table-fake-caption',
    titleRo: 'Titlul tabelului nu trebuie pus într-o celulă',
    whatItMeans:
      'Prima celulă a tabelului (întinsă pe toate coloanele) e folosită ca titlu al tabelului, în loc de <caption>. Tabelul nu are un nume recunoscut. Regulă experimentală.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Mută titlul în elementul <caption>, imediat după <table>.'],
    example: {
      before: '<table>\n  <tr><td colspan="3">Program de audiențe</td></tr>',
      after: '<table>\n  <caption>Program de audiențe</caption>',
    },
    howToVerify: ['Cu un cititor de ecran, tabelul trebuie anunțat cu titlul lui.'],
  },
  {
    axeRuleId: 'td-has-header',
    titleRo: 'Celulele tabelelor mari trebuie să aibă antete',
    whatItMeans:
      'Într-un tabel mare (cel puțin 3 × 3), o celulă cu date nu are niciun antet asociat, deci nu se știe ce reprezintă valoarea ei. Regulă experimentală.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Marchează antetele coloanelor și ale rândurilor cu <th> (și scope="col" / "row").'],
    example: {
      before:
        '<tr><td>Serviciu</td><td>Luni</td></tr>\n<tr><td>Registratură</td><td>8–16</td></tr>',
      after:
        '<tr><th scope="col">Serviciu</th><th scope="col">Luni</th></tr>\n<tr><th scope="row">Registratură</th><td>8–16</td></tr>',
    },
    howToVerify: [
      'Cu un cititor de ecran, fiecare valoare trebuie anunțată cu antetul coloanei și al rândului.',
    ],
  },
  {
    axeRuleId: 'td-headers-attr',
    titleRo: 'Atributul headers al celulelor trebuie să trimită la antete din același tabel',
    whatItMeans:
      'O celulă are atributul headers cu id-uri care nu există sau care nu sunt antete (<th>) din același tabel.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: [
      'Verifică că fiecare id din headers aparține unui <th> din același tabel.',
      'Pentru tabelele simple, renunță la headers și folosește scope.',
    ],
    example: {
      before: '<th id="luni">Luni</th>…\n<td headers="marti">8–16</td>',
      after: '<th id="luni">Luni</th>…\n<td headers="luni">8–16</td>',
    },
    howToVerify: ['Cu un cititor de ecran, fiecare celulă trebuie anunțată cu antetul corect.'],
  },
  {
    axeRuleId: 'th-has-data-cells',
    titleRo: 'Antetele unui tabel de date trebuie să aibă celule cu date',
    whatItMeans:
      'Un <th> nu descrie nicio celulă cu date (ex. o coloană goală sau un tabel folosit pentru aranjarea paginii).',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: [
      'Elimină antetele care nu au date sub ele (sau lângă ele).',
      'Dacă tabelul e folosit doar pentru aranjare, înlocuiește-l cu CSS (grid, flex).',
    ],
    example: {
      before:
        '<tr><th>Nume</th><th>Telefon</th><th>Observații</th></tr>\n<tr><td>Ion</td><td>0232…</td></tr>',
      after: '<tr><th>Nume</th><th>Telefon</th></tr>\n<tr><td>Ion</td><td>0232…</td></tr>',
    },
    howToVerify: ['Fiecare antet trebuie să descrie cel puțin o celulă cu date.'],
  },
  // ─── Texte alternative ───
  {
    axeRuleId: 'area-alt',
    titleRo: 'Zonele active ale unei hărți de imagine trebuie să aibă text alternativ',
    whatItMeans:
      'Un element <area> (o zonă pe care se poate da click într-o imagine-hartă) nu are atributul alt, deci nu se știe unde duce.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Adaugă fiecărui <area> un alt care spune destinația zonei.'],
    example: {
      before: '<area shape="rect" coords="0,0,80,80" href="/cartier-nord">',
      after: '<area shape="rect" coords="0,0,80,80" href="/cartier-nord" alt="Cartierul Nord">',
    },
    howToVerify: ['În lista linkurilor, fiecare zonă trebuie să apară cu un nume clar.'],
  },
  {
    axeRuleId: 'frame-title',
    titleRo: 'Cadrele (iframe) trebuie să aibă un nume',
    whatItMeans:
      'Un <iframe> nu are atributul title (sau alt nume accesibil), deci nu se știe ce conține.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Adaugă un title care descrie conținutul cadrului.'],
    example: {
      before: '<iframe src="https://www.youtube.com/embed/…"></iframe>',
      after:
        '<iframe src="https://www.youtube.com/embed/…" title="Video: ședința consiliului local"></iframe>',
    },
    howToVerify: ['Cu un cititor de ecran, cadrul trebuie anunțat cu numele lui.'],
  },
  {
    axeRuleId: 'frame-title-unique',
    titleRo: 'Cadrele trebuie să aibă nume diferite',
    whatItMeans: 'Mai multe <iframe> au același title, deci nu pot fi deosebite.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Dă fiecărui cadru un title unic, care spune ce conține.'],
    example: {
      before: '<iframe title="video" …></iframe>\n<iframe title="video" …></iframe>',
      after:
        '<iframe title="Video: prezentarea proiectului" …></iframe>\n<iframe title="Video: interviu cu primarul" …></iframe>',
    },
    howToVerify: ['Lista cadrelor (cititor de ecran) trebuie să arate nume diferite.'],
  },
  {
    axeRuleId: 'image-redundant-alt',
    titleRo: 'Textul alternativ al imaginii nu ar trebui să repete textul din jur',
    whatItMeans:
      'Textul alternativ al unei imagini e identic cu textul de lângă ea (ex. într-un link sau buton), deci cititorul de ecran îl anunță de două ori. Bună practică.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: ['Dacă textul de lângă imagine spune deja totul, folosește alt="" pentru imagine.'],
    example: {
      before: '<a href="/contact"><img src="tel.svg" alt="Contact"> Contact</a>',
      after: '<a href="/contact"><img src="tel.svg" alt=""> Contact</a>',
    },
    howToVerify: ['Cu un cititor de ecran, numele nu trebuie anunțat de două ori.'],
  },
  {
    axeRuleId: 'input-image-alt',
    titleRo: 'Butoanele de tip imagine trebuie să aibă text alternativ',
    whatItMeans:
      'Un <input type="image"> (buton afișat ca imagine) nu are alt, deci nu se știe ce face.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran și de comandă vocală.',
    howToFix: ['Adaugă un alt care spune acțiunea butonului, nu cum arată imaginea.'],
    example: {
      before: '<input type="image" src="lupa.png">',
      after: '<input type="image" src="lupa.png" alt="Caută">',
    },
    howToVerify: ['Cu un cititor de ecran, butonul trebuie anunțat cu acțiunea lui (ex. „Caută”).'],
  },
  {
    axeRuleId: 'object-alt',
    titleRo: 'Elementele <object> trebuie să aibă text alternativ',
    whatItMeans:
      'Un <object> (ex. un document sau o animație inclusă în pagină) nu are nume sau conținut alternativ.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: [
      'Adaugă un nume (aria-label sau title) și un text alternativ în interiorul elementului, cu un link spre conținut.',
    ],
    example: {
      before: '<object data="buget-2026.pdf" type="application/pdf"></object>',
      after:
        '<object data="buget-2026.pdf" type="application/pdf" aria-label="Bugetul local 2026">\n  <a href="buget-2026.pdf">Descarcă bugetul local 2026 (PDF)</a>\n</object>',
    },
    howToVerify: ['Cu un cititor de ecran, elementul trebuie anunțat cu numele lui.'],
  },
  {
    axeRuleId: 'role-img-alt',
    titleRo: 'Elementele cu rol de imagine trebuie să aibă text alternativ',
    whatItMeans:
      'Un element cu role="img" nu are nume (aria-label sau aria-labelledby), deci imaginea nu e descrisă.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: [
      'Adaugă aria-label cu descrierea imaginii.',
      'Dacă imaginea e decorativă, elimină role="img" și ascunde elementul cu aria-hidden="true".',
    ],
    example: {
      before: '<div role="img" class="harta-judet"></div>',
      after:
        '<div role="img" class="harta-judet" aria-label="Harta județului cu cele 5 orașe"></div>',
    },
    howToVerify: ['Cu un cititor de ecran, imaginea trebuie anunțată cu descrierea ei.'],
  },
  {
    axeRuleId: 'server-side-image-map',
    titleRo: 'Nu trebuie folosite hărți de imagine procesate pe server',
    whatItMeans:
      'O imagine are atributul ismap: zona apăsată se află doar după coordonatele click-ului, deci nu poate fi folosită cu tastatura și nu are nume.',
    whoIsAffected: 'Utilizatorii de tastatură și de cititoare de ecran.',
    howToFix: [
      'Înlocuiește harta cu linkuri obișnuite sau cu o hartă pe client (<map> cu <area> și alt).',
    ],
    example: {
      before: '<a href="/harta"><img src="oras.png" ismap alt="Harta orașului"></a>',
      after:
        '<img src="oras.png" usemap="#cartiere" alt="Harta orașului">\n<map name="cartiere">\n  <area shape="rect" coords="0,0,80,80" href="/cartier-nord" alt="Cartierul Nord">\n</map>',
    },
    howToVerify: ['Toate destinațiile hărții trebuie să poată fi atinse cu Tab.'],
  },
  {
    axeRuleId: 'svg-img-alt',
    titleRo: 'Imaginile SVG cu rol de imagine trebuie să aibă text alternativ',
    whatItMeans:
      'Un <svg> cu role="img" nu are nume (nici <title>, nici aria-label), deci nu e descris.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran.',
    howToFix: [
      'Adaugă un <title> ca prim copil al svg-ului, sau aria-label.',
      'Dacă e decorativ, folosește aria-hidden="true" în loc de role="img".',
    ],
    example: {
      before: '<svg role="img" viewBox="0 0 24 24">…</svg>',
      after: '<svg role="img" viewBox="0 0 24 24">\n  <title>Pagina de Facebook</title>…\n</svg>',
    },
    howToVerify: ['Cu un cititor de ecran, imaginea trebuie anunțată cu descrierea ei.'],
  },
  // ─── Media si continut care se schimba in timp ───
  {
    axeRuleId: 'video-caption',
    titleRo: 'Videoclipurile trebuie să aibă subtitrări',
    whatItMeans:
      'Un <video> nu are o pistă de subtitrări (<track kind="captions">), deci dialogul și sunetele importante nu sunt disponibile ca text.',
    whoIsAffected: 'Persoanele surde sau cu deficiențe de auz și oricine urmărește fără sunet.',
    howToFix: [
      'Adaugă un fișier de subtitrări (de obicei .vtt) cu <track kind="captions">.',
      'Subtitrările trebuie să includă și sunetele importante (ex. [aplauze]).',
    ],
    example: {
      before: '<video src="sedinta.mp4" controls></video>',
      after:
        '<video src="sedinta.mp4" controls>\n  <track kind="captions" src="sedinta.ro.vtt" srclang="ro" label="Română">\n</video>',
    },
    howToVerify: [
      'Pornește videoclipul și activează subtitrările: textul trebuie să urmărească vorbirea.',
    ],
  },
  {
    axeRuleId: 'audio-caption',
    titleRo: 'Înregistrările audio trebuie să aibă o alternativă text',
    whatItMeans:
      'Un <audio> nu are o transcriere sau o pistă de text. Regulă scoasă din uz în axe-core, dar transcrierea rămâne necesară pentru conținutul audio înregistrat.',
    whoIsAffected: 'Persoanele surde sau cu deficiențe de auz.',
    howToFix: ['Publică lângă înregistrare o transcriere completă a ei.'],
    example: {
      before: '<audio src="anunt.mp3" controls></audio>',
      after:
        '<audio src="anunt.mp3" controls></audio>\n<a href="anunt-transcriere.html">Transcrierea anunțului</a>',
    },
    howToVerify: ['Lângă fiecare înregistrare audio trebuie să existe transcrierea ei.'],
  },
  {
    axeRuleId: 'no-autoplay-audio',
    titleRo: 'Sunetul nu trebuie să pornească singur',
    whatItMeans:
      'Un <video> sau <audio> pornește automat cu sunet mai mult de 3 secunde, fără un mod de a-l opri. Sunetul acoperă vocea cititorului de ecran.',
    whoIsAffected: 'Utilizatorii de cititoare de ecran și persoanele cu dificultăți de atenție.',
    howToFix: [
      'Elimină autoplay, sau pornește fără sunet (muted).',
      'Oferă butoane vizibile de pauză și de oprire a sunetului.',
    ],
    example: {
      before: '<video src="prezentare.mp4" autoplay></video>',
      after: '<video src="prezentare.mp4" controls></video>',
    },
    howToVerify: ['La încărcarea paginii nu trebuie să pornească niciun sunet.'],
  },
  {
    axeRuleId: 'blink',
    titleRo: 'Nu trebuie folosit elementul <blink> (text care clipește)',
    whatItMeans:
      'Pagina folosește <blink>, un element scos din uz care face textul să clipească fără oprire.',
    whoIsAffected:
      'Persoanele cu dificultăți de atenție sau de citire și persoanele sensibile la stimuli vizuali.',
    howToFix: [
      'Elimină <blink>; pentru evidențiere, folosește un stil static (ex. îngroșat, culoare).',
    ],
    example: {
      before: '<blink>Termen limită: 30 noiembrie</blink>',
      after: '<strong>Termen limită: 30 noiembrie</strong>',
    },
    howToVerify: ['Pe pagină nu trebuie să existe text care clipește.'],
  },
  {
    axeRuleId: 'meta-refresh',
    titleRo: 'Pagina nu trebuie să se reîncarce sau să redirecționeze singură după o întârziere',
    whatItMeans:
      'Eticheta <meta http-equiv="refresh"> reîncarcă pagina sau trimite la altă adresă după un timp (sub 20 de ore), fără ca utilizatorul să poată opri asta.',
    whoIsAffected:
      'Persoanele care citesc mai încet, utilizatorii de cititoare de ecran (pierd poziția) și de tastatură.',
    howToFix: [
      'Elimină reîncărcarea automată; pentru redirecționări permanente, folosește o redirecționare pe server (cod 301).',
      'Dacă actualizarea e necesară, lasă utilizatorul să o pornească sau să o oprească.',
    ],
    example: {
      before: '<meta http-equiv="refresh" content="30">',
      after: '<!-- fără reîncărcare automată; un buton „Actualizează” în pagină -->',
    },
    howToVerify: [
      'Lasă pagina deschisă câteva minute: nu trebuie să se reîncarce sau să se schimbe singură.',
    ],
  },
  {
    axeRuleId: 'meta-refresh-no-exceptions',
    titleRo: 'Pagina nu ar trebui să se reîncarce singură deloc (nivel AAA)',
    whatItMeans:
      'Eticheta <meta http-equiv="refresh"> reîncarcă sau redirecționează pagina cu întârziere, oricât de lungă. Criteriu de nivel AAA, mai strict decât regula pentru întârzieri sub 20 de ore.',
    whoIsAffected: 'Persoanele care citesc mai încet și utilizatorii de tehnologii asistive.',
    howToFix: [
      'Elimină reîncărcarea automată; folosește redirecționări pe server sau acțiuni pornite de utilizator.',
    ],
    example: {
      before: '<meta http-equiv="refresh" content="86400">',
      after: '<!-- fără meta refresh -->',
    },
    howToVerify: ['Verifică în codul sursă că pagina nu are <meta http-equiv="refresh">.'],
  },
];
