# packages/shared — contracte comune

**Ce e:** codul folosit **si** de API, **si** de frontend: schemele Zod care descriu forma
datelor schimbate intre ele, plus tipurile TypeScript deduse din aceste scheme.

**De ce exista:** daca API-ul trimite `{ status: "ready" }`, frontendul trebuie sa se astepte
exact la asta. Cu o singura definitie comuna, o schimbare facuta doar intr-o parte e semnalata
de TypeScript in cealalta, la compilare, nu in fata utilizatorului.

## Continut

| Cale            | Rol                                                     |
| --------------- | ------------------------------------------------------- |
| `src/index.ts`  | Re-exporta tot; se importa cu `from '@ro-a11y/shared'`  |
| `src/health.ts` | Forma raspunsurilor `/health` si `/api/v1/health/ready` |
| `src/errors.ts` | Formatul standard al erorilor API                       |

Pachetul nu are pas de build: API-ul (prin `tsx`) si frontendul (prin Vite) citesc direct fisierele `.ts`.
