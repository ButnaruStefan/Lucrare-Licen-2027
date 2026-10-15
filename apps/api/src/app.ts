/**
 * Construieste aplicatia Express: leaga middleware-urile si rutele, in ordinea corecta.
 *
 * Nu porneste serverul si nu se conecteaza singura la baza de date. Primeste din exterior
 * tot ce ii trebuie (logger, conexiunea la baza de date, verificarea ei). Astfel, testele pot
 * crea aplicatia cu dependente false sau cu o baza de date de test, iar `index.ts` o creeaza
 * cu cele reale.
 */
import express from 'express';
import type { Logger } from './lib/logger';
import { requestLogger } from './middleware/request-id';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { healthRouter, type HealthDeps } from './routes/health';
import { projectsRouter, type ProjectsDeps } from './routes/projects';
import { scansRouter, type ScansDeps } from './routes/scans';

export interface AppDeps extends HealthDeps, ProjectsDeps, ScansDeps {
  logger: Logger;
}

export function createApp(deps: AppDeps) {
  const app = express();

  app.disable('x-powered-by'); // nu anuntam public ce tehnologie folosim
  app.use(requestLogger(deps.logger));
  app.use(express.json({ limit: '100kb' }));

  app.use(healthRouter(deps));
  app.use(projectsRouter(deps));
  app.use(scansRouter(deps));

  // Trebuie sa fie ultimele: prind tot ce n-a fost tratat mai sus.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
