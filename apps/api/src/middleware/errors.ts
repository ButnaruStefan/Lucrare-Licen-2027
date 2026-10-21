/**
 * Tratarea centralizata a erorilor.
 *
 * - `notFoundHandler`: raspunde cu 404 pentru orice ruta inexistenta.
 * - `errorHandler`: prinde orice eroare aruncata in rute si o transforma in formatul
 *   standard { error: { code, message, requestId } }. Detaliile tehnice ajung doar in
 *   loguri; clientul nu vede niciodata stack trace-ul.
 */
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiError, FieldError } from '@ro-a11y/shared';

/** Eroare "asteptata", cu cod HTTP si cod intern clar (ex. 400 VALIDATION_ERROR). */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: FieldError[],
    /** Id-ul resursei care exista deja (doar pentru 409 Conflict). */
    public readonly existingId?: string,
  ) {
    super(message);
  }
}

/** Corpul cererii nu e JSON valid (eroare aruncata de express.json()). */
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
    req.log.error({ err }, 'Eroare neasteptata');
  }
  const body: ApiError = {
    error: {
      code: known ? known.code : 'INTERNAL_ERROR',
      message: known ? known.message : 'A apărut o eroare internă.',
      requestId: String(req.id),
      ...(known?.details ? { details: known.details } : {}),
      ...(known?.existingId ? { existingId: known.existingId } : {}),
    },
  };
  res.status(known ? known.status : 500).json(body);
};
