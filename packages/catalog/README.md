# packages/catalog — catalogul normativ si motorul de trasabilitate

**Ce e:** datele normative ale proiectului si functia care le leaga, pentru fiecare problema
gasita de scanner, intr-un lant de trasabilitate:

```text
regula axe -> criteriu WCAG 2.2 -> clauza EN 301 549 V3.2.1 -> prevederi OUG 112/2018
```

Fiecare veriga are sursa oficiala, data verificarii si un status (confirmat, dedus, conflict,
de validat). Lantul arata relevanta normativa posibila a unei constatari tehnice, **nu** o
concluzie juridica.

## Surse

| Date                    | Sursa                                                  | Cum e obtinuta                                                                        |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Criteriile WCAG 2.2     | Recomandarile W3C WCAG 2.2 si WCAG 2.1                 | Generate automat: `npm run genereaza:wcag`                                            |
| EN 301 549 V3.2.1       | Decizia de punere in aplicare (UE) 2021/1339 (EUR-Lex) | Regula de numerotare (9. + criteriul WCAG), confirmata cu etichetele EN din axe-core  |
| OUG 112/2018            | Portalul Legislativ (legislatie.just.ro)               | Citate exacte din art. 3 si art. 5, verificate de teste fata de textul oficial salvat |
| Titluri si remedieri RO | Redactate de autor, pe baza documentatiei W3C si Deque | Marcate in aplicatie ca traducere de lucru / de revizuit                              |

## Continut

| Cale                               | Rol                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `scripts/genereaza-wcag.ts`        | Descarca WCAG 2.2 si 2.1 de la W3C si genereaza catalogul criteriilor         |
| `src/data/wcag22.json`             | Catalogul generat: 87 de criterii, nivel, principiu, legaturi oficiale        |
| `src/data/wcag-titluri-ro.ts`      | Titlurile in romana ale criteriilor A si AA (traducere de lucru)              |
| `src/data/oug-112-2018-art1-5.txt` | Textul oficial al art. 1-5 din OUG 112/2018, folosit de teste                 |
| `src/data/remedieri-ro.ts`         | Explicatii si remedieri in romana pentru 14 reguli axe frecvente              |
| `src/wcag.ts`                      | Accesul la catalogul WCAG                                                     |
| `src/en301549.ts`                  | Legatura criteriu WCAG -> clauza EN 301 549 V3.2.1, cu statusul verificarii   |
| `src/legislatie.ts`                | Prevederile din OUG 112/2018 (citate, sursa, status)                          |
| `src/trace.ts`                     | Motorul de trasabilitate (`buildTrace`) si versiunea catalogului              |
| `tests/catalog.test.ts`            | Verificarea datelor: structura WCAG, concordanta cu axe-core, citatele legale |

## Verificari automate

- catalogul WCAG are structura oficiala (87 de criterii; 31 A, 24 AA, 31 AAA; 9 noi in 2.2);
- legatura WCAG -> EN coincide cu etichetele EN ale axe-core pe toate regulile: 73 din 74;
  singura diferenta (`scrollable-region-focusable`, criteriul AAA 2.1.3) e afisata ca "conflict";
- fiecare citat din OUG 112/2018 apare exact in textul oficial.
