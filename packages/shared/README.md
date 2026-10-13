# packages/shared — contracte comune

**Ce e:** codul folosit **și** de API, **și** de frontend: schemele Zod care descriu forma
datelor schimbate între ele, plus tipurile TypeScript deduse din aceste scheme.

**De ce există:** dacă API-ul trimite `{ status: "ready" }`, frontendul trebuie să se aștepte
exact la asta. Cu o singură definiție comună, o schimbare făcută doar într-o parte e semnalată
de TypeScript în cealaltă, la compilare, nu în fața utilizatorului.

## Conținut

| Cale            | Rol                                                     |
| --------------- | ------------------------------------------------------- |
| `src/index.ts`  | Re-exportă tot; se importă cu `from '@ro-a11y/shared'`  |
| `src/health.ts` | Forma răspunsurilor `/health` și `/api/v1/health/ready` |
| `src/errors.ts` | Formatul standard al erorilor API                       |

Pachetul nu are pas de build: API-ul (prin `tsx`) și frontendul (prin Vite) citesc direct fișierele `.ts`.
