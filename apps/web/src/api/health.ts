/**
 * Funcțiile prin care frontendul cere starea sistemului de la API.
 *
 * Răspunsul e validat cu schema din `@ro-a11y/shared`. Dacă API-ul trimite altceva decât
 * spune contractul, aflăm imediat, în loc să afișăm date greșite.
 */
import { readyResponseSchema, type ReadyResponse } from '@ro-a11y/shared';

export async function fetchReadiness(signal?: AbortSignal): Promise<ReadyResponse> {
  const res = await fetch('/api/v1/health/ready', { signal });
  // 503 e un răspuns valid („nu sunt gata”), deci îl citim și pe acela.
  if (!res.ok && res.status !== 503) {
    throw new Error(`API-ul a răspuns cu ${res.status}`);
  }
  return readyResponseSchema.parse(await res.json());
}
