# apps/web — interfața (frontend)

**Ce e:** aplicația React care rulează în browser. Afișează datele și trimite cereri către API.
În dezvoltare, o servește Vite pe http://localhost:5173.

**Cum ajunge o cerere la API:** browserul cere `/api/...` de la Vite (5173), iar Vite o trimite
mai departe la API (3000). Asta e „proxy-ul” din `vite.config.ts`.

## Conținut

| Cale             | Rol                                                                   |
| ---------------- | --------------------------------------------------------------------- |
| `index.html`     | Pagina HTML de bază (`lang="ro"`), în care se montează React          |
| `vite.config.ts` | Configurarea Vite: plugin React + proxy către API                     |
| `src/main.tsx`   | Punctul de intrare: pornește React în `#root`                         |
| `src/App.tsx`    | Componenta principală (deocamdată: starea sistemului)                 |
| `src/api/`       | Funcțiile care cer date de la API și le validează cu schemele comune  |
| `src/styles.css` | Stilurile: culori cu contrast suficient, focus vizibil, mod întunecat |

**Regulă de bază:** interfața trebuie să fie ea însăși accesibilă. Folosim HTML semantic,
navigare completă din tastatură, focus vizibil și text, nu doar culoare, pentru stări.
