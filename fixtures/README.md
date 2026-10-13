# fixtures — site-uri de antrenament

Două variante ale aceluiași site fictiv (Primăria Comunei Valea Verde), folosite pentru a testa
scannerul pe un rezultat **cunoscut dinainte** și pentru demonstrația de la susținere, fără
dependență de internet.

```bash
npm run dev:fixtures   # pornește serverul pe http://localhost:4000
```

| Adresă                            | Conținut                                                     |
| --------------------------------- | ------------------------------------------------------------ |
| http://localhost:4000/accessible/ | Varianta corectă: scannerul nu trebuie să găsească nimic     |
| http://localhost:4000/broken/     | Varianta cu 12 probleme detectabile automat + 6 doar manuale |

## Conținut

| Cale                        | Rol                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `server.ts`                 | Server static minimal (doar module Node.js), cu protecție împotriva căilor `../`      |
| `accessible-demo/`          | Varianta corectă (HTML semantic, etichete, alt, contrast, focus vizibil)              |
| `broken-demo/`              | Varianta cu probleme; fiecare marcată în cod cu `PROBLEMA Bxx/Mxx` și `data-problema` |
| `broken-demo/probleme.json` | Lista oficială a problemelor și a rezultatului așteptat de la axe-core                |
| `shared-assets/`            | Imaginile SVG comune ambelor variante                                                 |

## Rezultatul verificat (axe-core 4.13.0, Chrome 155)

- **accessible-demo:** 0 violări, 0 rezultate incomplete.
- **broken-demo:** cele 12 probleme automate (B01–B12) produc 12 reguli axe încălcate
  (3 dintre ele sunt „bune practici”: `heading-order`, `landmark-one-main`, `region`) și
  1 rezultat incomplet (B06, contrast peste imagine).
- **6 probleme reale (M01–M06) NU sunt detectate automat.** Ele demonstrează de ce auditul
  automat trebuie completat de verificarea manuală.
