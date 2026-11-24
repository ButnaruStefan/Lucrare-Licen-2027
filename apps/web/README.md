# apps/web — interfata (frontend)

**Ce e:** aplicatia React care ruleaza in browser: proiecte, audituri pe mai multe pagini,
scanari, rezultatele cu filtre. In dezvoltare, o serveste Vite pe http://localhost:5173 (`npm run dev:web`).

**Cum ajunge o cerere la API:** browserul cere `/api/...` de la Vite (5173), iar Vite o trimite
mai departe la API (3000). Asta e "proxy-ul" din `vite.config.ts`.

## Ecrane

| Adresa                                | Ecran                                                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `/`                                   | Pagina de start: prezentarea platformei, cu drum spre proiecte si spre limitari                             |
| `/proiecte`                           | Lista proiectelor (cu cautare) si, alaturi, formularul de adaugare                                          |
| `/proiecte/:projectId`                | Profilul juridic, pornirea unei verificari (ce: accesibilitate / aspect; cate pagini), istoricele           |
| `/proiecte/:projectId/profil-juridic` | Chestionarul OUG 112/2018 si rezultatul evaluarii                                                           |
| `/audituri/:auditId`                  | Audit pe mai multe pagini: alegerea paginilor, progresul, rezultatele pe site                               |
| `/scanari/:scanId`                    | Starea, detaliile tehnice, rezultatele de accesibilitate, "Verificare manuala" si / sau "Aspect si afisare" |
| `/despre`                             | Ce face platforma si ce nu poate face (limitari)                                                            |

## Continut

| Cale                                                | Rol                                                                                                                                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.html`                                        | Pagina HTML de baza (`lang="ro"`), in care se monteaza React                                                                                                                                                                                                       |
| `vite.config.ts`                                    | Configurarea Vite: plugin React + proxy catre API                                                                                                                                                                                                                  |
| `vitest.config.ts`                                  | Configurarea testelor interfetei                                                                                                                                                                                                                                   |
| `src/main.tsx`                                      | Punctul de intrare: cache-ul de date (TanStack Query) + traseele (React Router)                                                                                                                                                                                    |
| `src/app/router.tsx`                                | Ce ecran se afiseaza pentru fiecare adresa                                                                                                                                                                                                                         |
| `src/app/Layout.tsx`                                | Structura comuna: "Sari la continut", antet, navigare, subsol                                                                                                                                                                                                      |
| `src/api/client.ts`                                 | Cererile catre API, validarea raspunsurilor, erorile pe campuri                                                                                                                                                                                                    |
| `src/api/queries.ts`                                | Incarcarea datelor (TanStack Query), inclusiv reverificarea scanarilor in curs                                                                                                                                                                                     |
| `src/api/health.ts`                                 | Starea serverului si a bazei de date                                                                                                                                                                                                                               |
| `src/pages/`                                        | Ecranele aplicatiei                                                                                                                                                                                                                                                |
| `src/components/`                                   | Piese refolosibile: titlul paginii, campuri, etichete, mesaje, rezultatul unei reguli, harta problemelor (`IssueMap`), aspectul paginii (`LayoutPanel`), verificarea manuala (`ManualReviewPanel`), pictogramele, alegerea paginilor unui audit si rezultatele lui |
| `src/lib/manual-labels.ts`                          | Textele verificarii manuale: starile, rezultatele de ales, progresul                                                                                                                                                                                               |
| `src/lib/labels.ts`                                 | Textele in romana pentru valorile tehnice si formatarea datelor                                                                                                                                                                                                    |
| `src/styles.css`                                    | Stilurile: culorile din logo, contrast suficient, focus vizibil, mod intunecat, ecrane mici                                                                                                                                                                        |
| `public/logo.png`                                   | Logo-ul W4A (webForAll), cu fundal transparent, pentru modul luminos                                                                                                                                                                                               |
| `public/logo-intunecat.png`                         | Acelasi logo, cu textul deschis la culoare, pentru modul intunecat                                                                                                                                                                                                 |
| `public/favicon.png`, `public/apple-touch-icon.png` | Simbolul din logo, ca iconita in fila browserului si pe telefon                                                                                                                                                                                                    |
| `tests/ui.e2e.test.ts`                              | Testele interfetei in Chrome, inclusiv axe-core pe propriile ecrane                                                                                                                                                                                                |
| `tests/mock-api.ts`                                 | API simulat pentru teste                                                                                                                                                                                                                                           |

## Accesibilitatea interfetei

Interfata unui instrument de accesibilitate trebuie sa fie ea insasi accesibila:

- HTML semantic si repere (`header`, `nav`, `main`, `footer`), legatura "Sari la continut";
- dupa fiecare navigare, focusul trece pe titlul paginii (anuntat de cititorul de ecran);
- campurile au etichete, iar erorile sunt legate de camp (`aria-describedby`, `aria-invalid`);
- schimbarile de stare (scanare in curs, numar de rezultate) sunt anuntate (`role="status"`);
- informatia nu e transmisa doar prin culoare; contrast suficient si in modul intunecat;
- harta problemelor e un ajutor vizual: chenarele sunt ascunse cititoarelor de ecran si nu sunt
  focusabile, echivalentul complet fiind lista regulilor; evidentierea apare si la focus, nu doar la
  mouse; zona capturii se poate derula din tastatura; o pagina statica e o singura imagine; una
  care se schimba la derulare e aratata ecran cu ecran (fiecare ecran separat, cu numarul lui si
  derularea), cum a vazut-o un vizitator;
- testele automate ruleaza axe-core pe fiecare ecran si cer **zero** probleme.

Fragmentele HTML ale paginilor scanate sunt afisate ca **text**, niciodata interpretate
(protectie XSS).
