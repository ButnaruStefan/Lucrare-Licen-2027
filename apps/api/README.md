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

| Cale                   | Rol                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `src/index.ts`         | Punctul de pornire: citește configurarea, conectează DB, pornește serverul           |
| `src/app.ts`           | Construiește aplicația Express (middleware + rute). Separat de pornire, pentru teste |
| `src/config/env.ts`    | Validează variabilele din `.env` la pornire                                          |
| `src/db/prisma.ts`     | Conexiunea la PostgreSQL prin Prisma                                                 |
| `src/lib/logger.ts`    | Loguri structurate (Pino), cu date sensibile ascunse                                 |
| `src/middleware/`      | Funcții care rulează pentru fiecare cerere (ID, loguri, erori)                       |
| `src/routes/`          | Endpointurile API, grupate pe domenii (deocamdată: `health`)                         |
| `src/generated/`       | Cod **generat automat** de Prisma. Nu se editează și nu e în Git                     |
| `prisma/schema.prisma` | Schema bazei de date (tabelele)                                                      |
| `prisma/migrations/`   | Istoricul modificărilor de schemă, ca fișiere SQL                                    |
| `prisma.config.ts`     | Configurarea uneltei Prisma                                                          |
| `tests/`               | Teste automate (Vitest + Supertest)                                                  |
| `.env.example`         | Model pentru `.env` (configurarea locală)                                            |

## Endpointuri existente

| Metodă | Rută                   | Răspuns                                       |
| ------ | ---------------------- | --------------------------------------------- |
| GET    | `/health`              | 200 cât timp procesul rulează                 |
| GET    | `/api/v1/health/ready` | 200 dacă și baza de date răspunde, altfel 503 |
