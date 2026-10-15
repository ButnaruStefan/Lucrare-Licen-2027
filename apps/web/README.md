# apps/web — interfata (frontend)

**Ce e:** aplicatia React care ruleaza in browser: proiecte, pornirea scanarilor, rezultatele
cu filtre. In dezvoltare, o serveste Vite pe http://localhost:5173 (`npm run dev:web`).

**Cum ajunge o cerere la API:** browserul cere `/api/...` de la Vite (5173), iar Vite o trimite
mai departe la API (3000). Asta e "proxy-ul" din `vite.config.ts`.

## Ecrane

| Adresa                 | Ecran                                                                            |
| ---------------------- | -------------------------------------------------------------------------------- |
| `/`                    | Lista proiectelor si formularul de adaugare                                      |
| `/proiecte/:projectId` | Pornirea unei scanari (pagina, standard, bune practici) si istoricul             |
| `/scanari/:scanId`     | Starea (actualizata automat), detaliile tehnice, sumarul, rezultatele filtrabile |
| `/despre`              | Ce face platforma si ce nu poate face (limitari)                                 |

## Continut

| Cale                   | Rol                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `index.html`           | Pagina HTML de baza (`lang="ro"`), in care se monteaza React                          |
| `vite.config.ts`       | Configurarea Vite: plugin React + proxy catre API                                     |
| `vitest.config.ts`     | Configurarea testelor interfetei                                                      |
| `src/main.tsx`         | Punctul de intrare: cache-ul de date (TanStack Query) + traseele (React Router)       |
| `src/app/router.tsx`   | Ce ecran se afiseaza pentru fiecare adresa                                            |
| `src/app/Layout.tsx`   | Structura comuna: "Sari la continut", antet, navigare, subsol                         |
| `src/api/client.ts`    | Cererile catre API, validarea raspunsurilor, erorile pe campuri                       |
| `src/api/queries.ts`   | Incarcarea datelor (TanStack Query), inclusiv reverificarea scanarilor in curs        |
| `src/api/health.ts`    | Starea serverului si a bazei de date                                                  |
| `src/pages/`           | Ecranele aplicatiei                                                                   |
| `src/components/`      | Piese refolosibile: titlul paginii, campuri, etichete, mesaje, rezultatul unei reguli |
| `src/lib/labels.ts`    | Textele in romana pentru valorile tehnice si formatarea datelor                       |
| `src/styles.css`       | Stilurile: contrast suficient, focus vizibil, mod intunecat, ecrane mici              |
| `public/favicon.svg`   | Iconita din fila browserului                                                          |
| `tests/ui.e2e.test.ts` | Testele interfetei in Chrome, inclusiv axe-core pe propriile ecrane                   |
| `tests/mock-api.ts`    | API simulat pentru teste                                                              |

## Accesibilitatea interfetei

Interfata unui instrument de accesibilitate trebuie sa fie ea insasi accesibila:

- HTML semantic si repere (`header`, `nav`, `main`, `footer`), legatura "Sari la continut";
- dupa fiecare navigare, focusul trece pe titlul paginii (anuntat de cititorul de ecran);
- campurile au etichete, iar erorile sunt legate de camp (`aria-describedby`, `aria-invalid`);
- schimbarile de stare (scanare in curs, numar de rezultate) sunt anuntate (`role="status"`);
- informatia nu e transmisa doar prin culoare; contrast suficient si in modul intunecat;
- testele automate ruleaza axe-core pe fiecare ecran si cer **zero** probleme.

Fragmentele HTML ale paginilor scanate sunt afisate ca **text**, niciodata interpretate
(protectie XSS).
