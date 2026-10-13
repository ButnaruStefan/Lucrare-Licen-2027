/**
 * Validarea datelor primite de API cu o schemă Zod.
 *
 * Dacă datele sunt corecte, returnează varianta curățată (ex. spații eliminate, adresa
 * normalizată). Dacă nu, aruncă o eroare 400 VALIDATION_ERROR cu lista câmpurilor greșite,
 * pe care middleware-ul de erori o trimite clientului în formatul standard.
 */
import type { z } from 'zod';
import { HttpError } from '../middleware/errors';

export function validate<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const details = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || '(corpul cererii)',
    message: issue.message,
  }));
  throw new HttpError(400, 'VALIDATION_ERROR', 'Datele trimise nu sunt valide.', details);
}
