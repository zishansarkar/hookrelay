import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiErrorResponse } from '@hookrelay/shared';
import type { AppConfig } from '../config/environment.js';
import { HttpError } from '../errors/http-error.js';

/**
 * Catch-all handler for requests that matched no route.
 */
export const notFoundHandler: RequestHandler = (_req, res) => {
  const body: ApiErrorResponse = {
    error: 'Resource not found',
    code: 'NOT_FOUND',
  };

  res.status(404).json(body);
};

/**
 * Extracts the HTTP status an error wants to be sent with.
 *
 * Client errors (a malformed JSON body, a payload that is too large) keep
 * their own 4xx status; everything else is treated as a server fault.
 */
function resolveStatus(error: unknown): number {
  const candidate = error as { status?: unknown; statusCode?: unknown } | null;

  const status = typeof candidate?.status === 'number' ? candidate.status : candidate?.statusCode;

  if (typeof status === 'number' && status >= 400 && status < 500) {
    return status;
  }

  return 500;
}

/**
 * Global error handler.
 *
 * The full error (message and stack) is always logged on the server, but it
 * is only ever echoed back to the client outside of production.
 */
export function createErrorHandler(config: AppConfig): ErrorRequestHandler {
  return (error, _req, res, _next) => {
    // Expected, well-described failures (duplicate email, bad credentials)
    // are part of the API contract and are not logged as crashes.
    if (error instanceof HttpError) {
      const body: ApiErrorResponse = {
        error: error.message,
        code: error.code,
      };

      res.status(error.status).json(body);
      return;
    }

    const parserError = error as { type?: unknown } | null;
    if (parserError?.type === 'entity.too.large') {
      const body: ApiErrorResponse = {
        error: 'Request payload exceeds the maximum allowed size',
        code: 'PAYLOAD_TOO_LARGE',
      };
      res.status(400).json(body);
      return;
    }

    const status = resolveStatus(error);
    const isServerError = status >= 500;

    console.error('[hookrelay-api] unhandled error:', error);

    const body: ApiErrorResponse = {
      error: isServerError ? 'Internal server error' : 'Request could not be processed',
      code: 'INTERNAL_ERROR',
    };

    if (!config.isProduction) {
      const details = error as { message?: unknown; stack?: unknown } | null;
      body.details = {
        message: details?.message ?? String(error),
        stack: details?.stack ?? null,
      };
    }

    res.status(status).json(body);
  };
}
