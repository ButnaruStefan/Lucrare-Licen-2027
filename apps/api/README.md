# apps/api — serverul (backend) si worker-ul de scanare

**Ce e:** aplicatia Node.js + Express care expune API-ul REST, plus worker-ul care ruleaza
scanarile de accesibilitate (Playwright + axe-core). Ambele folosesc aceeasi baza de date
PostgreSQL si acelasi cod, dar ruleaza ca procese separate.

**Cum circula o cerere:**

```text
browser ──HTTP──> index.ts (API)
                    └─> app.ts
                          ├─> middleware/request-id.ts   (ID unic + log pentru fiecare cerere)
                          ├─> routes/*.ts                (logica fiecarui endpoint)
                          │     ├─> safety/url-guard.ts  (adresa e sigura?)
                          │     └─> db/prisma.ts         (citire/scriere in PostgreSQL)
                          └─> middleware/errors.ts       (orice eroare → format standard)

worker.ts (proces separat)
  └─> scans/worker-loop.ts       (un pas: browser pregatit, rezervare, ceas de paza)
  ├─> audits/queue.ts            (1. rezerva urmatoarea descoperire de pagini, are prioritate)
  │   └─> audits/process-discovery.ts
  │         └─> discovery/discover.ts (pagina de start, robots.txt, sitemap.xml → pagini candidate)
  │               ├─> discovery/links.ts   (pagina? alt site? document? exclus?)
  │               ├─> discovery/robots.ts  (regulile robots.txt)
  │               ├─> discovery/sitemap.ts (adresele din sitemap.xml)
  │               └─> discovery/sample.ts  (esantionul propus)
  └─> scans/queue.ts             (2. altfel, rezerva urmatoarea scanare "queued")
      └─> scans/process-scan.ts
            ├─> scanner/page-scan.ts (Chrome; fiecare cerere trece prin paznic; ruleaza doar
            │     │                    verificarile alese: accesibilitatea si / sau aspectul)
            │     ├─> axe-core + scanner/page-facts.ts (ce contine pagina, pentru verificarea manuala)
            │     ├─> scanner/capture.ts (captura + pozitii, pentru harta)
            │     ├─> scanner/contrast-recheck.ts (contrastul re-verificat pe ecran)
            │     └─> scanner/layout-audit.ts (aspectul paginii, de la 1400 la 320 px)
            ├─> scanner/normalize.ts (rezultatul brut → tabelele noastre)
            └─> scans/queue.ts       (salveaza rezultatele, captura si aspectul, sau motivul esecului)
```

## Harta problemelor, pe scurt

Imediat dupa axe-core, in aceeasi sesiune de browser (pagina nu se reincarca), scannerul parcurge
pagina ecran cu ecran, ca un vizitator. Motivul: multe site-uri estompeaza sectiunile pana ajung
pe ecran sau au panouri "lipite" care se schimba la derulare; o singura fotografie a paginii
intregi le-ar prinde estompate, cu goluri albe. Pe fiecare ecran:

1. asteapta sa se aseze pagina: imaginile din ecran, animatiile CSS duse la final; doar daca pagina
   a reactionat la derulare (o vede un `MutationObserver`; elementele fixe nu conteaza), inca
   300 ms pentru efectele facute din JavaScript (valoare aleasa prin masuratoare);
2. calculeaza pozitia elementelor afectate care se vad intregi in acest ecran, in coordonatele
   ecranului;
3. re-verifica regula `color-contrast` pentru elementele semnalate care tocmai au intrat in ecran
   (`contrast-recheck.ts`); rezultatul nou il inlocuieste pe cel facut cu pagina sus;
4. fotografiaza ecranul (PNG); dupa primul ecran ascunde elementele fixe (meniu, cookie-uri).

Ecranele se suprapun putin (64 px). La final scannerul compara, pixel cu pixel, zona suprapusa a
fiecarei perechi de ecrane vecine. Daca toate imbinarile se potrivesc (pagina nu s-a schimbat intre
ecrane) si nu exista elemente lipite in sectiunea lor, pagina e statica si e salvata ca o singura
imagine continua. Altfel ecranele raman separate (o imbinare ar avea cusaturi), iar interfata le
arata cu numarul ecranului si derularea (`frame_height`, `frame_offsets` in `scan_screenshots`).
Imaginea e WebP (calitate 80, facuta intr-un canvas din browser), cel mult 16 000 px; la final
pagina e refacuta.

Captura se salveaza in tabelul `scan_screenshots` (bytea), in aceeasi tranzactie cu rezultatele;
pozitiile, in coloanele `box_*` din `affected_elements`. Interfata deseneaza chenarele peste
imagine. Elementele ascunse sau din iframe-uri nu primesc pozitie. Un esec al capturii nu strica
scanarea: doar harta lipseste.

## Aspectul paginii, pe scurt

O verificare separata de accesibilitate (fara criterii WCAG si fara legatura cu legislatia),
aleasa la pornire (`config.checks.layout`). Metoda vine din lucrarea Walsh, Kapfhammer, McMinn,
"Automated Layout Failure Detection for Responsive Web Pages without an Explicit Oracle" (ISSTA
2017): pagina e comparata cu ea insasi la latimi vecine ale ferestrei.

1. eticheta meta viewport si regulile `@media` ale paginii, prin Chrome DevTools Protocol
   (`CSS.getMediaQueries`, vede si foile de stil de pe alte domenii);
2. fereastra se ingusteaza de la 1400 la 320 px, din 60 in 60, plus latimile din jurul
   breakpoint-urilor paginii; dupa fiecare redimensionare se asteapta scripturile paginii care se
   refac cu intarziere (timerele scurte programate atunci, cel mult 1 s), apoi un script masoara
   aranjarea (`layout-model.ts`);
3. regulile (`layout-rules.ts`, functii simple, testate fara browser) gasesc semnalele: derulare
   orizontala, continut taiat la marginea paginii, elemente suprapuse, continut iesit din
   containerul care il taie, media queries active simultan, meta viewport lipsa sau cu latime fixa.
   Un semnal e raportat doar daca la latimea vecina, mai mare, totul era in regula;
4. capetele exacte ale fiecarui interval: cautare binara intre ultima latime unde semnalul apare
   si latimea vecina unde nu apare (intai la breakpoint-urile paginii), masurand doar elementele
   semnalului;
5. pentru cele mai importante semnale, o captura decupata la latimea problemei (JPEG, cel mult 10).

Rezultatul se salveaza in `scan_layouts` si `layout_issues`. Limita: 45 s pentru masuratori si
cautarea capetelor, apoi verificarea e marcata "partiala" (sau capetele ramase "aproximative").
Un esec nu strica scanarea (motivul e salvat).

## Verificarea manuala, pe scurt

Ce nu poate verifica axe-core (ex. daca textul alternativ are sens, daca pagina merge doar cu
tastatura) verifica un om, pe fiecare pagina scanata pentru accesibilitate. Cele 6 verificari
(pasii din W3C Easy Checks si din tehnicile WCAG, criteriile, sursele) sunt in
`@ro-a11y/catalog` (`verificari-manuale.ts`).

1. la scanare, imediat dupa axe-core, `scanner/page-facts.ts` numara ce contine pagina:
   imaginile, formularele si campurile lor, titlurile (salvat in `scans.page_facts`);
2. `GET /scans/:id/manual-checks` trimite verificarile cu starea lor: rezultatul salvat de om,
   altfel "nu se aplica" (detectat automat: pagina fara imagini sau fara campuri), altfel "de facut";
3. `PUT /scans/:id/manual-checks/:checkId` salveaza rezultatul (cine, note, versiunea pasilor) in
   `manual_evaluations`; `DELETE` il sterge.

Un rezultat manual nu se completeaza niciodata automat din axe-core. Progresul (`manual`) apare
in fiecare scanare si pe fiecare pagina a unui audit.

## Auditul pe mai multe pagini, pe scurt

1. `POST /projects/:id/audits` creeaza un audit `discovery_queued`.
2. Worker-ul deschide pagina de start (cu aceleasi protectii ca scannerul), citeste linkurile
   cu meniul din care face parte fiecare, apoi robots.txt si sitemap.xml. Clasifica linkurile
   (pagini, servicii externe, documente, excluse) si propune un esantion: pagina de start,
   paginile esentiale (contact, accesibilitate), cate una din fiecare sectiune, 1-2 aleatorii.
   Paginile interzise de robots.txt nu sunt propuse, dar raman in lista, marcate.
3. Utilizatorul confirma lista (`POST /audits/:id/selection`); fiecare pagina aleasa devine o
   scanare obisnuita, pusa in coada in ordinea aleasa. Worker-ul face o pauza de 1 s intre lucrari.
4. `GET /audits/:id/results` aduna rezultatele: pe reguli (pe cate pagini apare fiecare) si
   problemele comune (acelasi element, cu aceeasi problema, pe mai multe pagini: sablonul site-ului).

Nu e un crawler: nu merge din link in link, citeste doar pagina de start si sitemap-ul.

## Continut

| Cale                              | Rol                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                    | Pornirea API-ului: citeste configurarea, conecteaza DB, porneste serverul                                 |
| `src/worker.ts`                   | Pornirea worker-ului: porneste browserul, preia scanarile din coada si le proceseaza                      |
| `src/app.ts`                      | Construieste aplicatia Express (middleware + rute). Separat de pornire, pentru teste                      |
| `src/config/env.ts`               | Valideaza variabilele din `.env` la pornire                                                               |
| `src/db/prisma.ts`                | Conexiunea la PostgreSQL prin Prisma                                                                      |
| `src/lib/logger.ts`               | Loguri structurate (Pino), cu date sensibile ascunse                                                      |
| `src/lib/validation.ts`           | Valideaza datele primite; la eroare raspunde 400 cu lista campurilor gresite                              |
| `src/middleware/`                 | Functii care ruleaza pentru fiecare cerere (ID, loguri, erori)                                            |
| `src/routes/`                     | Endpointurile API, pe domenii (`health`, `projects`, `legal-profile`, `scans`, `manual-checks`, `audits`) |
| `src/safety/url-guard.ts`         | Paznicul adreselor (protectie SSRF), folosit in API si pentru fiecare cerere a browserului                |
| `src/safety/page-check.ts`        | Verifica daca o pagina adaugata manual intr-un audit exista (prin paznic, IP verificat la conectare)      |
| `src/scanner/browser.ts`          | Pornirea browserului (Chrome instalat, Edge sau Chromium), cu limite de timp                              |
| `src/scanner/page-scan.ts`        | Deschiderea sigura a unei pagini (`openGuardedPage`) si scanarea ei cu axe-core                           |
| `src/scanner/capture.ts`          | Parcurge pagina ecran cu ecran: captura (WebP) si pozitia elementelor, pentru harta                       |
| `src/scanner/page-facts.ts`       | Numara ce contine pagina (imagini, campuri de formular, titluri), pentru verificarea manuala              |
| `src/scanner/contrast-recheck.ts` | Re-verifica pe ecran contrastul elementelor semnalate (sectiuni estompate la derulare)                    |
| `src/scanner/layout-audit.ts`     | Verificarea aspectului: latimile, masuratorile, semnalele si capturile decupate                           |
| `src/scanner/layout-model.ts`     | Scripturile rulate in pagina pentru aspect (masurarea aranjarii, asteptarea dupa redimensionare)          |
| `src/scanner/layout-rules.ts`     | Regulile aspectului (comparatia intre latimi vecine, capetele exacte), fara browser                       |
| `src/discovery/`                  | Descoperirea paginilor unui audit: linkuri, robots.txt, sitemap.xml, esantionul propus                    |
| `src/audits/`                     | Coada descoperirilor (tabelul `audits`) si procesarea unei descoperiri                                    |
| `src/scanner/normalize.ts`        | Transforma rezultatul brut axe in randuri pentru `rule_results` si `affected_elements`                    |
| `src/scans/queue.ts`              | Coada de scanari din PostgreSQL: rezervare, finalizare, esec                                              |
| `@ro-a11y/catalog` (pachet)       | Lantul de trasabilitate adaugat fiecarui rezultat (`buildTrace`)                                          |
| `src/scans/process-scan.ts`       | Procesarea completa a unei scanari (verificare, scanare, salvare)                                         |
| `src/scans/worker-loop.ts`        | Un pas al worker-ului: browser pregatit inainte de rezervare, ceas de paza, erori prinse                  |
| `src/generated/`                  | Cod **generat automat** de Prisma. Nu se editeaza si nu e in Git                                          |
| `prisma/schema.prisma`            | Schema bazei de date (tabelele)                                                                           |
| `prisma/migrations/`              | Istoricul modificarilor de schema, ca fisiere SQL                                                         |
| `prisma/seed.ts`                  | Adauga proiectele demo (cele doua site-uri de antrenament)                                                |
| `prisma.config.ts`                | Configurarea uneltei Prisma                                                                               |
| `tests/`                          | Teste automate (Vitest + Supertest), pe baza de date separata `ro_a11y_test`                              |
| `vitest.config.ts`                | Configurarea testelor (adresa bazei de test, pregatirea ei)                                               |
| `.env.example`                    | Model pentru `.env` (configurarea locala, inclusiv setarile scannerului)                                  |

## Endpointuri existente

| Metoda | Ruta                                                 | Raspuns                                                                                                                                                    |
| ------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                                            | 200 cat timp procesul ruleaza                                                                                                                              |
| GET    | `/api/v1/health/ready`                               | 200 daca si baza de date raspunde, altfel 503                                                                                                              |
| POST   | `/api/v1/projects`                                   | Creeaza un proiect (`name`, `baseUrl`); 201, 400 la date invalide, 409 daca exista deja un proiect pentru aceeasi adresa                                   |
| GET    | `/api/v1/projects`                                   | Lista proiectelor, cele mai noi primele                                                                                                                    |
| GET    | `/api/v1/projects/:projectId`                        | Un proiect; 404 daca nu exista                                                                                                                             |
| GET    | `/api/v1/projects/:projectId/legal-profile`          | Intrebarile chestionarului OUG 112/2018 si profilul salvat (sau `null`)                                                                                    |
| PUT    | `/api/v1/projects/:projectId/legal-profile`          | Salveaza raspunsurile si evaluarea lor; 400 daca lipseste un raspuns necesar                                                                               |
| POST   | `/api/v1/projects/:projectId/scans`                  | Pune o scanare in coada (202); 400 daca adresa e nesigura sau de pe alt site                                                                               |
| GET    | `/api/v1/projects/:projectId/scans`                  | Scanarile separate ale proiectului, cu sumar (paginile unui audit apar in audit)                                                                           |
| POST   | `/api/v1/projects/:projectId/audits`                 | Porneste un audit pe mai multe pagini (202); `startUrl`, `maxPages` (1-20, implicit 10), profil                                                            |
| GET    | `/api/v1/projects/:projectId/audits`                 | Auditurile proiectului, cu starea si progresul                                                                                                             |
| GET    | `/api/v1/audits/:auditId`                            | Un audit: paginile gasite si propuse, ce nu s-a verificat, progresul, paginile scanate                                                                     |
| POST   | `/api/v1/audits/:auditId/page-check`                 | Verifica o pagina adaugata manual (`url`): `{ exists, url, redirected }` sau `{ exists: false, code, message }`; 400 alt site / document, 409 dupa alegere |
| POST   | `/api/v1/audits/:auditId/selection`                  | Confirma paginile alese (`urls`, 1-20); 400 pentru o pagina de pe alt site, 409 daca au fost deja alese                                                    |
| GET    | `/api/v1/audits/:auditId/results`                    | Rezultatele pe tot site-ul: reguli pe pagini si probleme comune                                                                                            |
| GET    | `/api/v1/scans/:scanId`                              | O scanare: stare, configuratie, versiuni, sumar, dimensiunile capturii (`screenshot`)                                                                      |
| GET    | `/api/v1/scans/:scanId/screenshot`                   | Captura paginii (imagine WebP, memorata de browser); 404 daca scanarea nu are captura                                                                      |
| GET    | `/api/v1/scans/:scanId/layout`                       | Verificarea aspectului: latimile, breakpoint-urile, meta viewport, semnalele (404 `LAYOUT_NOT_FOUND` daca nu a fost ceruta)                                |
| GET    | `/api/v1/scans/:scanId/layout/issues/:issueId/image` | Captura decupata a unui semnal de aspect (JPEG); 404 daca semnalul nu are captura                                                                          |
| GET    | `/api/v1/scans/:scanId/manual-checks`                | Verificarea manuala a paginii: cele 6 verificari, starea lor, ce contine pagina, progresul (404 `MANUAL_REVIEW_NOT_AVAILABLE` fara accesibilitate)         |
| PUT    | `/api/v1/scans/:scanId/manual-checks/:checkId`       | Salveaza rezultatul unei verificari (`result`, `evaluator`, `notes`; notele obligatorii la `fail`)                                                         |
| DELETE | `/api/v1/scans/:scanId/manual-checks/:checkId`       | Sterge rezultatul (verificarea redevine de facut)                                                                                                          |
| GET    | `/api/v1/scans/:scanId/results`                      | Rezultatele pe reguli, cu elementele afectate (si pozitia lor, `box`) si lantul de trasabilitate (filtru `?category=violation`)                            |

## Coduri de eroare ale unei scanari (sau descoperiri) esuate

| Cod                  | Cand apare                                                                     |
| -------------------- | ------------------------------------------------------------------------------ |
| `UNSAFE_URL`         | Adresa (sau o redirectionare) duce spre o retea interna sau rezervata          |
| `NAVIGATION_TIMEOUT` | Pagina nu s-a incarcat in timpul permis                                        |
| `NAVIGATION_FAILED`  | Pagina nu a putut fi deschisa (domeniu inexistent, prea multe redirectionari)  |
| `HTTP_ERROR`         | Serverul a raspuns cu un cod de eroare (ex. 404, 500)                          |
| `ANALYSIS_FAILED`    | axe-core nu a putut analiza pagina                                             |
| `SCAN_TIMEOUT`       | Scanarea a depasit limita totala de timp (implicit 90 s); browserul e repornit |
| `DISCOVERY_TIMEOUT`  | Cautarea paginilor unui audit a depasit limita de timp (implicit 150 s)        |
| `WORKER_INTERRUPTED` | Worker-ul s-a oprit in timpul scanarii sau al cautarii paginilor               |
| `INTERNAL_ERROR`     | Eroare neprevazuta                                                             |

O scanare esuata inseamna o problema tehnica, **nu** ca site-ul e inaccesibil.
