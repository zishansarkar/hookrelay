import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import type { ApiErrorResponse } from '@hookrelay/shared';

/**
 * Builds a middleware that validates `req.body` against a Zod schema.
 *
 * On success the parsed (and coerced) body replaces `req.body`; on failure it
 * responds with 400 and the individual field errors.
 */
export function validate<TOutput>(schema: ZodType<TOutput>): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const body: ApiErrorResponse = {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: result.error.issues.map((issue) => ({
          field: issue.path.map(String).join('.') || 'body',
          message: issue.message,
        })),
      };

      res.status(400).json(body);
      return;
    }

    req.body = result.data;
    next();
  };
}
