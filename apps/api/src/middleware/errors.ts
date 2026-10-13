/**
 * Tratarea centralizată a erorilor.
 *
 * - `notFoundHandler`: răspunde cu 404 pentru orice rută inexistentă.
 * - `errorHandler`: prinde orice eroare aruncată în rute și o transformă în formatul
 *   standard { error: { code, message, requestId } }. Detaliile tehnice ajung doar în
 *   loguri; clientul nu vede niciodată stack trace-ul.
 */
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiError, FieldError } from '@ro-a11y/shared';

/** Eroare „așteptată”, cu cod HTTP și cod intern clar (ex. 400 VALIDATION_ERROR). */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: FieldError[],
  ) {
    super(message);
  }
}

/** Corpul cererii nu e JSON valid (eroare aruncată de express.json()). */
function isInvalidJson(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed'
  );
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
  const known = isInvalidJson(err)
    ? new HttpError(400, 'INVALID_JSON', 'Corpul cererii nu este JSON valid.')
    : err instanceof HttpError
      ? err
      : null;

  if (!known) {
    req.log.error({ err }, 'Eroare neașteptată');
  }
  const body: ApiError = {
    error: {
      code: known ? known.code : 'INTERNAL_ERROR',
      message: known ? known.message : 'A apărut o eroare internă.',
      requestId: String(req.id),
      ...(known?.details ? { details: known.details } : {}),
    },
  };
  res.status(known ? known.status : 500).json(body);
};
