# apps/api — serverul (backend)

**Ce e:** aplicația Node.js + Express care expune API-ul REST. Frontendul îi trimite cereri
HTTP, iar ea citește și scrie în baza de date PostgreSQL.

**Cum circulă o cerere:**

```text
browser ──HTTP──> index.ts (serverul pornit)
                    └─> app.ts (aplicația Express)
                          ├─> middleware/request-id.ts  (ID unic + log pentru fiecare cerere)
                          ├─> routes/*.ts               (logica fiecărui endpoint)
                          │     └─> db/prisma.ts        (citire/scriere în PostgreSQL)
                          └─> middleware/errors.ts      (orice eroare → format standard)
```

## Conținut

| Cale                    | Rol                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `src/index.ts`          | Punctul de pornire: citește configurarea, conectează DB, pornește serverul           |
| `src/app.ts`            | Construiește aplicația Express (middleware + rute). Separat de pornire, pentru teste |
| `src/config/env.ts`     | Validează variabilele din `.env` la pornire                                          |
| `src/db/prisma.ts`      | Conexiunea la PostgreSQL prin Prisma                                                 |
| `src/lib/logger.ts`     | Loguri structurate (Pino), cu date sensibile ascunse                                 |
| `src/middleware/`       | Funcții care rulează pentru fiecare cerere (ID, loguri, erori)                       |
| `src/routes/`           | Endpointurile API, grupate pe domenii (`health`, `projects`)                         |
| `src/lib/validation.ts` | Validează datele primite; la eroare răspunde 400 cu lista câmpurilor greșite         |
| `src/generated/`        | Cod **generat automat** de Prisma. Nu se editează și nu e în Git                     |
| `prisma/schema.prisma`  | Schema bazei de date (tabelele)                                                      |
| `prisma/migrations/`    | Istoricul modificărilor de schemă, ca fișiere SQL                                    |
| `prisma/seed.ts`        | Adaugă proiectele demo (cele două site-uri de antrenament)                           |
| `prisma.config.ts`      | Configurarea uneltei Prisma                                                          |
| `tests/`                | Teste automate (Vitest + Supertest), pe baza de date separată `ro_a11y_test`         |
| `vitest.config.ts`      | Configurarea testelor (adresa bazei de test, pregătirea ei)                          |
| `.env.example`          | Model pentru `.env` (configurarea locală)                                            |

## Endpointuri existente

| Metodă | Rută                          | Răspuns                                                               |
| ------ | ----------------------------- | --------------------------------------------------------------------- |
| GET    | `/health`                     | 200 cât timp procesul rulează                                         |
| GET    | `/api/v1/health/ready`        | 200 dacă și baza de date răspunde, altfel 503                         |
| POST   | `/api/v1/projects`            | Creează un proiect (`name`, `baseUrl`); 201, sau 400 la date invalide |
| GET    | `/api/v1/projects`            | Lista proiectelor, cele mai noi primele                               |
| GET    | `/api/v1/projects/:projectId` | Un proiect; 404 dacă nu există                                        |
