import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../utils/errors.js';

/**
 * Builds a middleware that validates `req.body` against a Zod schema.
 *
 * On success the parsed (and coerced) body replaces `req.body`; on failure it
 * responds with 400 and the individual field errors.
 */
export function validate<TOutput>(schema: ZodType<TOutput>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(new ValidationError('Request validation failed', { cause: result.error }));
      return;
    }

    req.body = result.data;
    next();
  };
}
