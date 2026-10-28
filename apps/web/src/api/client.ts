/**
 * Clientul comun pentru cererile catre API.
 *
 * - trimite cererea si citeste raspunsul JSON;
 * - valideaza raspunsul cu schema din `@ro-a11y/shared` (daca API-ul trimite altceva decat
 *   spune contractul, aflam imediat);
 * - transforma raspunsurile de eroare ({ error: { code, message, details } }) intr-o eroare
 *   `ApiRequestError`, pe care paginile o pot afisa (inclusiv erorile pe fiecare camp).
 */
import type { z } from 'zod';
import { apiErrorSchema, type FieldError } from '@ro-a11y/shared';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: FieldError[] = [],
    /** Id-ul resursei care exista deja (la 409 Conflict), ca sa putem trimite spre ea. */
    public readonly existingId?: string,
  ) {
    super(message);
  }
}

export async function apiRequest<S extends z.ZodType>(
  path: string,
  schema: S,
  init: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown; signal?: AbortSignal } = {},
): Promise<z.output<S>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
    });
  } catch {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Serverul nu poate fi contactat. Este pornit?');
  }

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(data);
    if (parsed.success) {
      const { code, message, details, existingId } = parsed.data.error;
      throw new ApiRequestError(res.status, code, message, details, existingId);
    }
    throw new ApiRequestError(
      res.status,
      'HTTP_ERROR',
      `Serverul a răspuns cu codul ${res.status}.`,
    );
  }
  return schema.parse(data);
}
