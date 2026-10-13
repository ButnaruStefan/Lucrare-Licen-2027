/**
 * Construiește aplicația Express: leagă middleware-urile și rutele, în ordinea corectă.
 *
 * Nu pornește serverul și nu se conectează singură la baza de date. Primește din exterior
 * tot ce îi trebuie (logger, verificarea bazei de date). Astfel, testele pot crea aplicația
 * cu dependențe false, iar `index.ts` o creează cu cele reale.
 */
import express from 'express';
import type { Logger } from './lib/logger';
import { requestLogger } from './middleware/request-id';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { healthRouter, type HealthDeps } from './routes/health';

export interface AppDeps extends HealthDeps {
  logger: Logger;
}

export function createApp(deps: AppDeps) {
  const app = express();

  app.disable('x-powered-by'); // nu anunțăm public ce tehnologie folosim
  app.use(requestLogger(deps.logger));
  app.use(express.json({ limit: '100kb' }));

  app.use(healthRouter(deps));

  // Trebuie să fie ultimele: prind tot ce n-a fost tratat mai sus.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
