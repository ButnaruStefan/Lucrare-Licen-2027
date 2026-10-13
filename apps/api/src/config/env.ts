/**
 * Citește și validează variabilele de mediu (din `.env` sau din sistem) la pornire.
 *
 * Dacă lipsește ceva obligatoriu (ex. DATABASE_URL) sau are o valoare greșită,
 * aplicația se oprește imediat cu un mesaj clar, în loc să cadă mai târziu, la prima cerere.
 * Restul codului importă `env` de aici și nu mai citește direct `process.env`.
 */
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().startsWith('postgresql://', {
    message: 'DATABASE_URL trebuie să înceapă cu postgresql://',
  }),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configurare invalidă în .env:\n${problems}`);
  }
  return result.data;
}

export const env = loadEnv();
