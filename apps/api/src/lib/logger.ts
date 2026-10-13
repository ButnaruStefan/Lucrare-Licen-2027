/**
 * Loggerul aplicației (biblioteca Pino): scrie loguri structurate, în format JSON.
 *
 * Câmpurile sensibile (parole, cookie-uri, token-uri) sunt înlocuite automat cu
 * „[REDACTAT]”, ca să nu ajungă niciodată în loguri.
 * În dezvoltare (`pretty = true`), logurile sunt afișate colorat și lizibil, prin pino-pretty.
 */
import { pino } from 'pino';

export function createLogger(level: string, pretty = false) {
  return pino({
    level,
    transport: pretty
      ? {
          target: 'pino-pretty',
          options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        }
      : undefined,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.token',
      ],
      censor: '[REDACTAT]',
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
