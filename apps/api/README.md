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
            ├─> scanner/page-scan.ts (Chrome + axe-core; fiecare cerere trece prin paznic)
            ├─> scanner/normalize.ts (rezultatul brut → tabelele noastre)
            └─> scans/queue.ts       (salveaza rezultatele sau motivul esecului)
```

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

| Cale                        | Rol                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `src/index.ts`              | Pornirea API-ului: citeste configurarea, conecteaza DB, porneste serverul                  |
| `src/worker.ts`             | Pornirea worker-ului: porneste browserul, preia scanarile din coada si le proceseaza       |
| `src/app.ts`                | Construieste aplicatia Express (middleware + rute). Separat de pornire, pentru teste       |
| `src/config/env.ts`         | Valideaza variabilele din `.env` la pornire                                                |
| `src/db/prisma.ts`          | Conexiunea la PostgreSQL prin Prisma                                                       |
| `src/lib/logger.ts`         | Loguri structurate (Pino), cu date sensibile ascunse                                       |
| `src/lib/validation.ts`     | Valideaza datele primite; la eroare raspunde 400 cu lista campurilor gresite               |
| `src/middleware/`           | Functii care ruleaza pentru fiecare cerere (ID, loguri, erori)                             |
| `src/routes/`               | Endpointurile API, pe domenii (`health`, `projects`, `legal-profile`, `scans`, `audits`)   |
| `src/safety/url-guard.ts`   | Paznicul adreselor (protectie SSRF), folosit in API si pentru fiecare cerere a browserului |
| `src/scanner/browser.ts`    | Pornirea browserului (Chrome instalat, Edge sau Chromium), cu limite de timp               |
| `src/scanner/page-scan.ts`  | Deschiderea sigura a unei pagini (`openGuardedPage`) si scanarea ei cu axe-core            |
| `src/discovery/`            | Descoperirea paginilor unui audit: linkuri, robots.txt, sitemap.xml, esantionul propus     |
| `src/audits/`               | Coada descoperirilor (tabelul `audits`) si procesarea unei descoperiri                     |
| `src/scanner/normalize.ts`  | Transforma rezultatul brut axe in randuri pentru `rule_results` si `affected_elements`     |
| `src/scans/queue.ts`        | Coada de scanari din PostgreSQL: rezervare, finalizare, esec                               |
| `@ro-a11y/catalog` (pachet) | Lantul de trasabilitate adaugat fiecarui rezultat (`buildTrace`)                           |
| `src/scans/process-scan.ts` | Procesarea completa a unei scanari (verificare, scanare, salvare)                          |
| `src/scans/worker-loop.ts`  | Un pas al worker-ului: browser pregatit inainte de rezervare, ceas de paza, erori prinse   |
| `src/generated/`            | Cod **generat automat** de Prisma. Nu se editeaza si nu e in Git                           |
| `prisma/schema.prisma`      | Schema bazei de date (tabelele)                                                            |
| `prisma/migrations/`        | Istoricul modificarilor de schema, ca fisiere SQL                                          |
| `prisma/seed.ts`            | Adauga proiectele demo (cele doua site-uri de antrenament)                                 |
| `prisma.config.ts`          | Configurarea uneltei Prisma                                                                |
| `tests/`                    | Teste automate (Vitest + Supertest), pe baza de date separata `ro_a11y_test`               |
| `vitest.config.ts`          | Configurarea testelor (adresa bazei de test, pregatirea ei)                                |
| `.env.example`              | Model pentru `.env` (configurarea locala, inclusiv setarile scannerului)                   |

## Endpointuri existente

| Metoda | Ruta                                        | Raspuns                                                                                                                  |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/health`                                   | 200 cat timp procesul ruleaza                                                                                            |
| GET    | `/api/v1/health/ready`                      | 200 daca si baza de date raspunde, altfel 503                                                                            |
| POST   | `/api/v1/projects`                          | Creeaza un proiect (`name`, `baseUrl`); 201, 400 la date invalide, 409 daca exista deja un proiect pentru aceeasi adresa |
| GET    | `/api/v1/projects`                          | Lista proiectelor, cele mai noi primele                                                                                  |
| GET    | `/api/v1/projects/:projectId`               | Un proiect; 404 daca nu exista                                                                                           |
| GET    | `/api/v1/projects/:projectId/legal-profile` | Intrebarile chestionarului OUG 112/2018 si profilul salvat (sau `null`)                                                  |
| PUT    | `/api/v1/projects/:projectId/legal-profile` | Salveaza raspunsurile si evaluarea lor; 400 daca lipseste un raspuns necesar                                             |
| POST   | `/api/v1/projects/:projectId/scans`         | Pune o scanare in coada (202); 400 daca adresa e nesigura sau de pe alt site                                             |
| GET    | `/api/v1/projects/:projectId/scans`         | Scanarile separate ale proiectului, cu sumar (paginile unui audit apar in audit)                                         |
| POST   | `/api/v1/projects/:projectId/audits`        | Porneste un audit pe mai multe pagini (202); `startUrl`, `maxPages` (1-20, implicit 10), profil                          |
| GET    | `/api/v1/projects/:projectId/audits`        | Auditurile proiectului, cu starea si progresul                                                                           |
| GET    | `/api/v1/audits/:auditId`                   | Un audit: paginile gasite si propuse, ce nu s-a verificat, progresul, paginile scanate                                   |
| POST   | `/api/v1/audits/:auditId/selection`         | Confirma paginile alese (`urls`, 1-20); 400 pentru o pagina de pe alt site, 409 daca au fost deja alese                  |
| GET    | `/api/v1/audits/:auditId/results`           | Rezultatele pe tot site-ul: reguli pe pagini si probleme comune                                                          |
| GET    | `/api/v1/scans/:scanId`                     | O scanare: stare, configuratie, versiuni, sumar                                                                          |
| GET    | `/api/v1/scans/:scanId/results`             | Rezultatele pe reguli, cu elementele afectate si lantul de trasabilitate (filtru `?category=violation`)                  |

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
