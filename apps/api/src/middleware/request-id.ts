/**
 * Atribuie fiecărei cereri HTTP un identificator unic (request ID) și o loghează.
 *
 * ID-ul apare în loguri, în antetul de răspuns `X-Request-Id` și în orice mesaj de eroare.
 * Dacă un utilizator raportează o eroare, ID-ul arată exact ce s-a întâmplat în server.
 */
import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import type { Logger } from '../lib/logger';

export function requestLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId(req, res) {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && incoming.length <= 100 ? incoming : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
  });
}
