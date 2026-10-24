export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    isOperational = true,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Request validation failed', options?: ErrorOptions) {
    super(message, 400, 'VALIDATION_ERROR', true, options);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'You are not authorized to perform this action') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMITED');
  }
}

const ERROR_WINDOW_SECONDS = 5 * 60;
const errorBuckets = new Map<number, number>();

export function recordError(now = Date.now()): number {
  const second = Math.floor(now / 1_000);
  pruneErrors(second);
  errorBuckets.set(second, (errorBuckets.get(second) ?? 0) + 1);
  return getRecentErrorCount(now);
}

export function getRecentErrorCount(now = Date.now()): number {
  const second = Math.floor(now / 1_000);
  pruneErrors(second);
  let count = 0;
  for (const bucketCount of errorBuckets.values()) count += bucketCount;
  return count;
}

function pruneErrors(currentSecond: number): void {
  const cutoff = currentSecond - ERROR_WINDOW_SECONDS + 1;
  for (const bucket of errorBuckets.keys()) {
    if (bucket < cutoff) errorBuckets.delete(bucket);
  }
}
