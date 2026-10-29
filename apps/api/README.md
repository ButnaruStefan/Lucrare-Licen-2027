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
  └─> scans/queue.ts             (rezerva urmatoarea scanare "queued")
  └─> scans/process-scan.ts
        ├─> scanner/page-scan.ts (Chrome + axe-core; fiecare cerere trece prin paznic)
        ├─> scanner/normalize.ts (rezultatul brut → tabelele noastre)
        └─> scans/queue.ts       (salveaza rezultatele sau motivul esecului)
```

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
| `src/routes/`               | Endpointurile API, grupate pe domenii (`health`, `projects`, `legal-profile`, `scans`)     |
| `src/safety/url-guard.ts`   | Paznicul adreselor (protectie SSRF), folosit in API si pentru fiecare cerere a browserului |
| `src/scanner/browser.ts`    | Pornirea browserului (Chrome instalat, Edge sau Chromium), cu limite de timp               |
| `src/scanner/page-scan.ts`  | Scanarea unei pagini: incarcare sigura (inclusiv redirectionari) + axe-core                |
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
| GET    | `/api/v1/projects/:projectId/scans`         | Scanarile proiectului, cu sumar                                                                                          |
| GET    | `/api/v1/scans/:scanId`                     | O scanare: stare, configuratie, versiuni, sumar                                                                          |
| GET    | `/api/v1/scans/:scanId/results`             | Rezultatele pe reguli, cu elementele afectate si lantul de trasabilitate (filtru `?category=violation`)                  |

## Coduri de eroare ale unei scanari esuate

| Cod                  | Cand apare                                                                     |
| -------------------- | ------------------------------------------------------------------------------ |
| `UNSAFE_URL`         | Adresa (sau o redirectionare) duce spre o retea interna sau rezervata          |
| `NAVIGATION_TIMEOUT` | Pagina nu s-a incarcat in timpul permis                                        |
| `NAVIGATION_FAILED`  | Pagina nu a putut fi deschisa (domeniu inexistent, prea multe redirectionari)  |
| `HTTP_ERROR`         | Serverul a raspuns cu un cod de eroare (ex. 404, 500)                          |
| `ANALYSIS_FAILED`    | axe-core nu a putut analiza pagina                                             |
| `SCAN_TIMEOUT`       | Scanarea a depasit limita totala de timp (implicit 90 s); browserul e repornit |
| `WORKER_INTERRUPTED` | Worker-ul s-a oprit in timpul scanarii                                         |
| `INTERNAL_ERROR`     | Eroare neprevazuta                                                             |

O scanare esuata inseamna o problema tehnica, **nu** ca site-ul e inaccesibil.
