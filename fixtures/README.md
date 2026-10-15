# fixtures — site-uri de antrenament

Doua variante ale aceluiasi site fictiv (Primaria Comunei Valea Verde), folosite pentru a testa
scannerul pe un rezultat **cunoscut dinainte** si pentru demonstratia de la sustinere, fara
dependenta de internet.

```bash
npm run dev:fixtures   # porneste serverul pe http://localhost:4000
```

| Adresa                            | Continut                                                     |
| --------------------------------- | ------------------------------------------------------------ |
| http://localhost:4000/accessible/ | Varianta corecta: scannerul nu trebuie sa gaseasca nimic     |
| http://localhost:4000/broken/     | Varianta cu 12 probleme detectabile automat + 6 doar manuale |

## Continut

| Cale                        | Rol                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `create-server.ts`          | Serverul static minimal (doar module Node.js), cu protectie impotriva cailor `../`       |
| `server.ts`                 | Il porneste pe portul 4000 (`npm run dev:fixtures`); testele il pornesc pe un port liber |
| `accessible-demo/`          | Varianta corecta (HTML semantic, etichete, alt, contrast, focus vizibil)                 |
| `broken-demo/`              | Varianta cu probleme; fiecare marcata in cod cu `PROBLEMA Bxx/Mxx` si `data-problema`    |
| `broken-demo/probleme.json` | Lista oficiala a problemelor si a rezultatului asteptat de la axe-core                   |
| `shared-assets/`            | Imaginile SVG comune ambelor variante                                                    |

## Rezultatul verificat (axe-core 4.13.0, Chrome 155)

- **accessible-demo:** 0 violari, 0 rezultate incomplete.
- **broken-demo:** cele 12 probleme automate (B01–B12) produc 12 reguli axe incalcate
  (3 dintre ele sunt "bune practici": `heading-order`, `landmark-one-main`, `region`) si
  1 rezultat incomplet (B06, contrast peste imagine).
- **6 probleme reale (M01–M06) NU sunt detectate automat.** Ele demonstreaza de ce auditul
  automat trebuie completat de verificarea manuala.
