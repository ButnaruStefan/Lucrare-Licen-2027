/**
 * Validarea datelor primite de API cu o schema Zod.
 *
 * Daca datele sunt corecte, returneaza varianta curatata (ex. spatii eliminate, adresa
 * normalizata). Daca nu, arunca o eroare 400 VALIDATION_ERROR cu lista campurilor gresite,
 * pe care middleware-ul de erori o trimite clientului in formatul standard.
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
