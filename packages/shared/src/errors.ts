/**
 * Formatul unic al erorilor returnate de API.
 *
 * Orice eroare arata la fel: { "error": { "code", "message", "requestId", "details"? } }.
 * `requestId` leaga raspunsul de linia corespunzatoare din logurile serverului.
 * `details` apare la erorile de validare: ce camp e gresit si de ce.
 */
import { z } from 'zod';

export const fieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});
export type FieldError = z.infer<typeof fieldErrorSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.array(fieldErrorSchema).optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
