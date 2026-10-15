/**
 * Loggerul aplicatiei (biblioteca Pino): scrie loguri structurate, in format JSON.
 *
 * Campurile sensibile (parole, cookie-uri, token-uri) sunt inlocuite automat cu
 * "[REDACTAT]", ca sa nu ajunga niciodata in loguri.
 * In dezvoltare (`pretty = true`), logurile sunt afisate colorat si lizibil, prin pino-pretty.
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
