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

| Cale                        | Rol                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `create-server.ts`          | Serverul static minimal (doar module Node.js), cu protectie impotriva cailor `../`; serveste si `/robots.txt` si `/sitemap.xml` |
| `server.ts`                 | Il porneste pe portul 4000 (`npm run dev:fixtures`); testele il pornesc pe un port liber                                        |
| `accessible-demo/`          | Varianta corecta (HTML semantic, etichete, alt, contrast, focus vizibil)                                                        |
| `broken-demo/`              | Varianta cu probleme; fiecare marcata in cod cu `PROBLEMA Bxx/Mxx/Pxx` si `data-problema`                                       |
| `broken-demo/probleme.json` | Lista oficiala a problemelor si a rezultatului asteptat de la axe-core                                                          |
| `shared-assets/`            | Imaginile SVG comune ambelor variante                                                                                           |

## Mai multe pagini (pentru auditul pe mai multe pagini)

Ambele site-uri au acelasi meniu (cu submeniul "Servicii") si aceleasi pagini interioare:
`anunturi.html`, `contact.html`, `servicii/taxe-locale.html`, `servicii/stare-civila.html`,
plus `declaratie-accesibilitate.html`, care **nu** apare in meniu: e gasita doar prin
`/sitemap.xml`. Subsolul contine linkuri pe care descoperirea trebuie sa le trateze separat:
un serviciu extern (Ghiseul.ro), un document PDF, e-mail, telefon, o zona interzisa de
`/robots.txt` (`admin/`) si o pagina de autentificare (exclusa ca "actiune").

In `broken-demo`, paginile interioare au acelasi sablon cu probleme ca pagina principala
(fara `lang`, zoom blocat, fara repere, link fara nume in subsol), deci un audit le arata ca
**probleme comune** pe toate cele 6 pagini, plus cate o problema proprie (`P01`–`P04`):
imagine fara `alt`, lista fara eticheta, buton fara nume, contrast insuficient.

## Rezultatul verificat (axe-core 4.13.0, Chrome 155)

- **accessible-demo:** 0 violari, 0 rezultate incomplete, pe toate cele 6 pagini.
- **broken-demo:** cele 12 probleme automate (B01–B12) produc 12 reguli axe incalcate
  (3 dintre ele sunt "bune practici": `heading-order`, `landmark-one-main`, `region`) si
  1 rezultat incomplet (B06, contrast peste imagine).
- **6 probleme reale (M01–M06) NU sunt detectate automat.** Ele demonstreaza de ce auditul
  automat trebuie completat de verificarea manuala.
- **Auditul pe 6 pagini ale broken-demo:** `html-has-lang`, `meta-viewport`, `link-name`,
  `landmark-one-main` si `region` apar pe toate paginile (probleme comune); `image-alt`,
  `select-name`, `button-name` si `color-contrast` pe cate 2 pagini.
