import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorResponse } from '@hookrelay/shared';
import type { AppConfig } from '../config/environment.js';
import { AppError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('error-handler');

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(`Route ${req.method} ${req.path} was not found`, 404, 'NOT_FOUND'));
};

function resolveError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError('Request validation failed', 400, 'VALIDATION_ERROR', true, {
      cause: error,
    });
  }
  const candidate = error as { type?: unknown } | null;
  if (candidate?.type === 'entity.too.large') {
    return new AppError(
      'Request payload exceeds the maximum allowed size',
      413,
      'PAYLOAD_TOO_LARGE',
    );
  }
  if (candidate?.type === 'entity.parse.failed') {
    return new AppError('Request body contains invalid JSON', 400, 'INVALID_JSON');
  }
  return new AppError(
    'Internal server error',
    500,
    'INTERNAL_ERROR',
    false,
    error instanceof Error ? { cause: error } : undefined,
  );
}

export function createErrorHandler(config: AppConfig): ErrorRequestHandler {
  return (error, req, res, _next) => {
    const appError = resolveError(error);
    const requestId = res.locals.requestId as string | undefined;
    logger.error(
      {
        err: error,
        requestId,
        method: req.method,
        url: req.path,
        statusCode: appError.statusCode,
        code: appError.code,
        developerId: req.developer?.id,
      },
      'Request failed',
    );

    if (res.headersSent) return;
    const body: ApiErrorResponse = {
      error: appError.isOperational ? appError.message : 'Internal server error',
      code: appError.code,
    };
    if (!config.isProduction && error instanceof Error) {
      body.details = { message: error.message, stack: error.stack ?? null };
    }
    res.status(appError.statusCode).json(body);
  };
}
