/**
 * An error that carries the HTTP status and API error code it should be
 * reported with.
 *
 * Thrown from services and handled by the global error handler, which turns
 * it into an `ApiErrorResponse` instead of a generic 500.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}
