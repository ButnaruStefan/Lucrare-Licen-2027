/**
 * Contractul pentru verificarile de sanatate ale API-ului.
 *
 * Schemele Zod descriu forma exacta a raspunsurilor. API-ul le foloseste ca tipuri
 * cand raspunde, iar frontendul le foloseste ca sa valideze ce primeste.
 * Daca forma se schimba aici, TypeScript semnaleaza imediat ambele parti.
 */
import { z } from 'zod';

/** GET /health — "procesul API ruleaza?" (nu verifica baza de date). */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  uptimeSeconds: z.number().nonnegative(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** Starea unei dependente (deocamdata doar baza de date). */
export const dependencyStatusSchema = z.enum(['ok', 'error']);

/** GET /api/v1/health/ready — "API-ul poate servi cereri reale?" (verifica si baza de date). */
export const readyResponseSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  checks: z.object({
    database: dependencyStatusSchema,
  }),
});
export type ReadyResponse = z.infer<typeof readyResponseSchema>;
