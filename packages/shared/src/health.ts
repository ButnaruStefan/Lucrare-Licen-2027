/**
 * Contractul pentru verificările de sănătate ale API-ului.
 *
 * Schemele Zod descriu forma exactă a răspunsurilor. API-ul le folosește ca tipuri
 * când răspunde, iar frontendul le folosește ca să valideze ce primește.
 * Dacă forma se schimbă aici, TypeScript semnalează imediat ambele părți.
 */
import { z } from 'zod';

/** GET /health — „procesul API rulează?" (nu verifică baza de date). */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  uptimeSeconds: z.number().nonnegative(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** Starea unei dependențe (deocamdată doar baza de date). */
export const dependencyStatusSchema = z.enum(['ok', 'error']);

/** GET /api/v1/health/ready — „API-ul poate servi cereri reale?" (verifică și baza de date). */
export const readyResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  checks: z.object({
    database: dependencyStatusSchema,
  }),
});
export type ReadyResponse = z.infer<typeof readyResponseSchema>;
