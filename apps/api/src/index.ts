/**
 * Punctul de pornire al API-ului (`npm run dev:api`).
 *
 * Citeste configurarea, se conecteaza la baza de date, creeaza aplicatia si o porneste
 * pe portul din .env. La oprire (Ctrl+C), inchide curat serverul si conexiunea la baza de date.
 */
import { createApp } from './app';
import { env } from './config/env';
import { createPrismaClient, pingDatabase } from './db/prisma';
import { createLogger } from './lib/logger';

const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV === 'development');
const db = createPrismaClient(env.DATABASE_URL);

const app = createApp({
  logger,
  db,
  checkDatabase: () => pingDatabase(db),
  guardOptions: { allowedLocalOrigins: env.SCAN_ALLOWED_LOCAL_ORIGINS },
  scanTimeoutMs: env.SCAN_PAGE_TIMEOUT_MS,
});

const server = app.listen(env.PORT, () => {
  logger.info(`API pornit pe http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`Semnal ${signal} primit, opresc API-ul...`);
  server.close();
  await db.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
