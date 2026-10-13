/**
 * Formatul unic al erorilor returnate de API.
 *
 * Orice eroare arată la fel: { "error": { "code", "message", "requestId", "details"? } }.
 * `requestId` leagă răspunsul de linia corespunzătoare din logurile serverului.
 * `details` apare la erorile de validare: ce câmp e greșit și de ce.
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
