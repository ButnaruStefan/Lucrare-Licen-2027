/**
 * Rutele de "sanatate" ale API-ului:
 *
 * - GET /health — procesul ruleaza? Raspunde mereu 200 cat timp serverul e pornit.
 * - GET /api/v1/health/ready — API-ul poate lucra? Verifica si baza de date.
 *   200 daca totul e in regula, 503 (Service Unavailable) daca baza de date nu raspunde.
 *
 * Verificarea bazei de date vine din exterior (`checkDatabase`), ca testele sa o poata
 * inlocui fara o baza de date reala.
 */
import { Router } from 'express';
import type { HealthResponse, ReadyResponse } from '@ro-a11y/shared';

export interface HealthDeps {
  checkDatabase: () => Promise<void>;
}

export function healthRouter({ checkDatabase }: HealthDeps): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      service: 'ro-a11y-api',
      uptimeSeconds: Math.round(process.uptime()),
    };
    res.json(body);
  });

  router.get('/api/v1/health/ready', async (req, res) => {
    let database: ReadyResponse['checks']['database'] = 'ok';
    try {
      await checkDatabase();
    } catch (err) {
      req.log.warn({ err }, 'Baza de date nu raspunde');
      database = 'error';
    }
    const body: ReadyResponse = {
      status: database === 'ok' ? 'ready' : 'not_ready',
      checks: { database },
    };
    res.status(database === 'ok' ? 200 : 503).json(body);
  });

  return router;
}
