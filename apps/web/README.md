# apps/web — interfata (frontend)

**Ce e:** aplicatia React care ruleaza in browser. Afiseaza datele si trimite cereri catre API.
In dezvoltare, o serveste Vite pe http://localhost:5173.

**Cum ajunge o cerere la API:** browserul cere `/api/...` de la Vite (5173), iar Vite o trimite
mai departe la API (3000). Asta e "proxy-ul" din `vite.config.ts`.

## Continut

| Cale             | Rol                                                                   |
| ---------------- | --------------------------------------------------------------------- |
| `index.html`     | Pagina HTML de baza (`lang="ro"`), in care se monteaza React          |
| `vite.config.ts` | Configurarea Vite: plugin React + proxy catre API                     |
| `src/main.tsx`   | Punctul de intrare: porneste React in `#root`                         |
| `src/App.tsx`    | Componenta principala (deocamdata: starea sistemului)                 |
| `src/api/`       | Functiile care cer date de la API si le valideaza cu schemele comune  |
| `src/styles.css` | Stilurile: culori cu contrast suficient, focus vizibil, mod intunecat |

**Regula de baza:** interfata trebuie sa fie ea insasi accesibila. Folosim HTML semantic,
navigare completa din tastatura, focus vizibil si text, nu doar culoare, pentru stari.
