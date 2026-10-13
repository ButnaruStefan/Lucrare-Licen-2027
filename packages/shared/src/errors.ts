/**
 * Formatul unic al erorilor returnate de API.
 *
 * Orice eroare arată la fel: { "error": { "code", "message", "requestId" } }.
 * `requestId` leagă răspunsul de linia corespunzătoare din logurile serverului.
 */
import { z } from 'zod';

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
