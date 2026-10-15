/**
 * Functiile prin care frontendul cere starea sistemului de la API.
 *
 * Raspunsul e validat cu schema din `@ro-a11y/shared`. Daca API-ul trimite altceva decat
 * spune contractul, aflam imediat, in loc sa afisam date gresite.
 */
import { readyResponseSchema, type ReadyResponse } from '@ro-a11y/shared';

export async function fetchReadiness(signal?: AbortSignal): Promise<ReadyResponse> {
  const res = await fetch('/api/v1/health/ready', { signal });
  // 503 e un raspuns valid ("nu sunt gata"), deci il citim si pe acela.
  if (!res.ok && res.status !== 503) {
    throw new Error(`API-ul a răspuns cu ${res.status}`);
  }
  return readyResponseSchema.parse(await res.json());
}
