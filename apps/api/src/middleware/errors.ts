/**
 * Tratarea centralizată a erorilor.
 *
 * - `notFoundHandler`: răspunde cu 404 pentru orice rută inexistentă.
 * - `errorHandler`: prinde orice eroare aruncată în rute și o transformă în formatul
 *   standard { error: { code, message, requestId } }. Detaliile tehnice ajung doar în
 *   loguri; clientul nu vede niciodată stack trace-ul.
 */
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiError } from '@ro-a11y/shared';

/** Eroare „așteptată”, cu cod HTTP și cod intern clar (ex. 400 INVALID_URL). */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiError = {
    error: {
      code: 'NOT_FOUND',
      message: `Ruta ${req.method} ${req.path} nu există.`,
      requestId: String(req.id),
    },
  };
  res.status(404).json(body);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const isKnown = err instanceof HttpError;
  if (!isKnown) {
    req.log.error({ err }, 'Eroare neașteptată');
  }
  const body: ApiError = {
    error: {
      code: isKnown ? err.code : 'INTERNAL_ERROR',
      message: isKnown ? err.message : 'A apărut o eroare internă.',
      requestId: String(req.id),
    },
  };
  res.status(isKnown ? err.status : 500).json(body);
};
