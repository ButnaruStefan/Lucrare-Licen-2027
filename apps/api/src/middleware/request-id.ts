/**
 * Atribuie fiecarei cereri HTTP un identificator unic (request ID) si o logheaza.
 *
 * ID-ul apare in loguri, in antetul de raspuns `X-Request-Id` si in orice mesaj de eroare.
 * Daca un utilizator raporteaza o eroare, ID-ul arata exact ce s-a intamplat in server.
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
