# RO-A11y Observatory

Platforma de audit al accesibilitatii web pentru site-uri romanesti. Combina scanarea automata
(Playwright + axe-core), trasabilitatea catre WCAG, EN 301 549 si legislatia romaneasca,
verificarea manuala ghidata si un studiu empiric.

Lucrare de licenta, Stefan Butnaru, 2027.

> Rezultatele automate sunt **constatari tehnice, nu verdicte juridice**. Platforma nu certifica
> conformitatea cu WCAG sau cu legislatia.

## Structura pe scurt

| Folder                               | Rol                                                           |
| ------------------------------------ | ------------------------------------------------------------- |
| [`apps/api`](apps/api)               | Serverul (backend): API REST, baza de date, logica aplicatiei |
| [`apps/web`](apps/web)               | Interfata (frontend): aplicatia React din browser             |
| [`packages/shared`](packages/shared) | Contracte comune API ↔ web (scheme Zod, tipuri)               |
| [`fixtures`](fixtures)               | Site-uri de antrenament: unul accesibil, unul cu probleme     |

## Cerinte

- **Node.js 22+** (testat cu 24)
- **PostgreSQL 17**, instalat local sau pornit prin Docker (vezi mai jos)
- **Google Chrome** instalat (folosit de scanner). Alternativ, pe Windows/Linux, Chromium-ul
  oferit de Playwright: `npx playwright install chromium` si `BROWSER_CHANNEL=chromium` in `.env`

## Pornire rapida

### 1. Baza de date

**macOS (Homebrew):**

```bash
brew install postgresql@17
brew services start postgresql@17
"$(brew --prefix postgresql@17)/bin/psql" postgres -c "CREATE ROLE ro_a11y WITH LOGIN PASSWORD 'ro_a11y' CREATEDB;"
"$(brew --prefix postgresql@17)/bin/psql" postgres -c "CREATE DATABASE ro_a11y OWNER ro_a11y;"
```

**Windows:** instaleaza PostgreSQL 17 de pe [postgresql.org](https://www.postgresql.org/download/windows/),
apoi, din _SQL Shell (psql)_, ruleaza aceleasi doua comenzi `CREATE ROLE` si `CREATE DATABASE`.

**Alternativ, cu Docker:** `docker compose up -d`. Utilizatorul si baza sunt create automat.

### 2. Aplicatia

```bash
npm install
cp apps/api/.env.example apps/api/.env      # pe Windows: copy apps\api\.env.example apps\api\.env
npm run db:migrate                           # creeaza tabelele in baza de date
npm run db:seed                              # adauga proiectele demo
npm run dev:api                              # terminal 1 → http://localhost:3000
npm run dev:worker                           # terminal 2 → worker-ul care ruleaza scanarile
npm run dev:web                              # terminal 3 → http://localhost:5173
npm run dev:fixtures                         # terminal 4 → http://localhost:4000 (site-uri de antrenament)
```

Deschide http://localhost:5173. Pagina trebuie sa arate "API: functioneaza" si "Baza de date: conectata".

### 3. Prima scanare

Cu API-ul, worker-ul si site-urile de antrenament pornite:

```bash
# id-ul proiectului demo "cu probleme"
curl http://localhost:3000/api/v1/projects

# porneste scanarea (raspunde 202: scanarea intra in coada)
curl -X POST http://localhost:3000/api/v1/projects/<ID_PROIECT>/scans -H "Content-Type: application/json" -d '{}'

# starea si sumarul scanarii, apoi rezultatele (doar regulile incalcate)
curl http://localhost:3000/api/v1/scans/<ID_SCANARE>
curl "http://localhost:3000/api/v1/scans/<ID_SCANARE>/results?category=violation"
```

**Testele** folosesc o baza de date separata, `ro_a11y_test`, creata automat la prima rulare
(PostgreSQL trebuie sa fie pornit). Testele scannerului deschid browserul real (Chrome).

## Securitate

Scannerul deschide adrese primite de la utilizatori, deci e protejat impotriva SSRF: refuza
adresele care duc spre retele interne, localhost sau servicii de metadate cloud, verificand
fiecare cerere a browserului, inclusiv redirectionarile (urmate pas cu pas) si resursele
incarcate de pagina. Exceptie: originile din `SCAN_ALLOWED_LOCAL_ORIGINS` (doar pentru
site-urile de antrenament). Limita cunoscuta: o instalare publica ar trebui sa adauge si
filtrare la nivel de retea (protectie completa impotriva DNS rebinding).

## Comenzi utile

| Comanda              | Ce face                                                 |
| -------------------- | ------------------------------------------------------- |
| `npm test`           | ruleaza toate testele (inclusiv scannerul, cu Chrome)   |
| `npm run dev:worker` | porneste worker-ul care proceseaza scanarile din coada  |
| `npm run typecheck`  | verifica tipurile TypeScript in tot proiectul           |
| `npm run format`     | formateaza codul cu Prettier                            |
| `npm run db:migrate` | aplica modificarile din `schema.prisma` in baza de date |
| `npm run db:seed`    | adauga proiectele demo (nu le dubleaza)                 |
| `npm run db:studio`  | deschide Prisma Studio: vezi tabelele in browser        |
