import { AppError } from '../utils/errors.js';

/**
 * An error that carries the HTTP status and API error code it should be
 * reported with.
 *
 * Thrown from services and handled by the global error handler, which turns
 * it into an `ApiErrorResponse` instead of a generic 500.
 */
export class HttpError extends AppError {
  constructor(status: number, message: string, code: string) {
    super(message, status, code);
  }

  get status(): number {
    return this.statusCode;
  }
}
