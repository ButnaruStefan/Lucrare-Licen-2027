/**
 * Construiește aplicația Express: leagă middleware-urile și rutele, în ordinea corectă.
 *
 * Nu pornește serverul și nu se conectează singură la baza de date. Primește din exterior
 * tot ce îi trebuie (logger, conexiunea la baza de date, verificarea ei). Astfel, testele pot
 * crea aplicația cu dependențe false sau cu o bază de date de test, iar `index.ts` o creează
 * cu cele reale.
 */
import express from 'express';
import type { Logger } from './lib/logger';
import { requestLogger } from './middleware/request-id';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { healthRouter, type HealthDeps } from './routes/health';
import { projectsRouter, type ProjectsDeps } from './routes/projects';

export interface AppDeps extends HealthDeps, ProjectsDeps {
  logger: Logger;
}

export function createApp(deps: AppDeps) {
  const app = express();

  app.disable('x-powered-by'); // nu anunțăm public ce tehnologie folosim
  app.use(requestLogger(deps.logger));
  app.use(express.json({ limit: '100kb' }));

  app.use(healthRouter(deps));
  app.use(projectsRouter(deps));

  // Trebuie să fie ultimele: prind tot ce n-a fost tratat mai sus.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
