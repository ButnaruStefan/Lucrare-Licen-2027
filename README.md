# RO-A11y Observatory

Platformă de audit al accesibilității web pentru site-uri românești. Combină scanarea automată
(Playwright + axe-core), trasabilitatea către WCAG, EN 301 549 și legislația românească,
verificarea manuală ghidată și un studiu empiric.

Lucrare de licență, Ștefan Butnaru, 2027.

> Rezultatele automate sunt **constatări tehnice, nu verdicte juridice**. Platforma nu certifică
> conformitatea cu WCAG sau cu legislația.

## Structura pe scurt

| Folder                               | Rol                                                           |
| ------------------------------------ | ------------------------------------------------------------- |
| [`apps/api`](apps/api)               | Serverul (backend): API REST, baza de date, logica aplicației |
| [`apps/web`](apps/web)               | Interfața (frontend): aplicația React din browser             |
| [`packages/shared`](packages/shared) | Contracte comune API ↔ web (scheme Zod, tipuri)               |
| [`fixtures`](fixtures)               | Site-uri de antrenament: unul accesibil, unul cu probleme     |

## Cerințe

- **Node.js 22+** (testat cu 24)
- **PostgreSQL 17**, instalat local sau pornit prin Docker (vezi mai jos)

## Pornire rapidă

### 1. Baza de date

**macOS (Homebrew):**

```bash
brew install postgresql@17
brew services start postgresql@17
"$(brew --prefix postgresql@17)/bin/psql" postgres -c "CREATE ROLE ro_a11y WITH LOGIN PASSWORD 'ro_a11y' CREATEDB;"
"$(brew --prefix postgresql@17)/bin/psql" postgres -c "CREATE DATABASE ro_a11y OWNER ro_a11y;"
```

**Windows:** instalează PostgreSQL 17 de pe [postgresql.org](https://www.postgresql.org/download/windows/),
apoi, din _SQL Shell (psql)_, rulează aceleași două comenzi `CREATE ROLE` și `CREATE DATABASE`.

**Alternativ, cu Docker:** `docker compose up -d`. Utilizatorul și baza sunt create automat.

### 2. Aplicația

```bash
npm install
cp apps/api/.env.example apps/api/.env      # pe Windows: copy apps\api\.env.example apps\api\.env
npm run db:migrate                           # creează tabelele în baza de date
npm run db:seed                              # adaugă proiectele demo
npm run dev:api                              # terminal 1 → http://localhost:3000
npm run dev:web                              # terminal 2 → http://localhost:5173
npm run dev:fixtures                         # terminal 3 → http://localhost:4000 (site-uri de antrenament)
```

Deschide http://localhost:5173. Pagina trebuie să arate „API: funcționează” și „Bază de date: conectată”.

**Testele** folosesc o bază de date separată, `ro_a11y_test`, creată automat la prima rulare
(PostgreSQL trebuie să fie pornit).

## Comenzi utile

| Comandă              | Ce face                                                 |
| -------------------- | ------------------------------------------------------- |
| `npm test`           | rulează toate testele                                   |
| `npm run typecheck`  | verifică tipurile TypeScript în tot proiectul           |
| `npm run format`     | formatează codul cu Prettier                            |
| `npm run db:migrate` | aplică modificările din `schema.prisma` în baza de date |
| `npm run db:seed`    | adaugă proiectele demo (nu le dublează)                 |
| `npm run db:studio`  | deschide Prisma Studio: vezi tabelele în browser        |
