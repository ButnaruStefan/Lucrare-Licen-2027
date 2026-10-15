/**
 * Citeste si valideaza variabilele de mediu (din `.env` sau din sistem) la pornire.
 *
 * Daca lipseste ceva obligatoriu (ex. DATABASE_URL) sau are o valoare gresita,
 * aplicatia se opreste imediat cu un mesaj clar, in loc sa cada mai tarziu, la prima cerere.
 * Restul codului importa `env` de aici si nu mai citeste direct `process.env`.
 */
import 'dotenv/config';
import { z } from 'zod';
import { BROWSER_CHANNELS } from '../scanner/browser';

/** Lista de origini separate prin virgula: "http://localhost:4000, http://localhost:4001". */
const originList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => new URL(item).origin),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().startsWith('postgresql://', {
    message: 'DATABASE_URL trebuie sa inceapa cu postgresql://',
  }),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // --- Scanner ---
  /** Browserul folosit de worker: chrome (instalat), msedge sau chromium (descarcat de Playwright). */
  BROWSER_CHANNEL: z.enum(BROWSER_CHANNELS).default('chrome'),
  /** Origini locale pe care scannerul are voie sa le deschida (doar dezvoltare/teste). */
  SCAN_ALLOWED_LOCAL_ORIGINS: originList,
  /** Timpul maxim de incarcare a unei pagini, in milisecunde. */
  SCAN_PAGE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(30_000),
  /** Cat de des verifica worker-ul daca au aparut scanari noi, in milisecunde. */
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(200).max(60_000).default(2000),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configurare invalida in .env:\n${problems}`);
  }
  return result.data;
}

export const env = loadEnv();
