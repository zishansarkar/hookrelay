import { rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import type { ApiErrorResponse } from '@hookrelay/shared';

/** Length of the rate limiting window, in milliseconds. */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Maximum number of requests allowed per IP within the window. */
export const RATE_LIMIT_MAX_REQUESTS = 100;

/**
 * Global rate limiter: 100 requests per minute per client IP.
 */
export const globalRateLimiter: RequestHandler = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX_REQUESTS,
  skip: (req) => req.path === '/v1/webhooks/send',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    const body: ApiErrorResponse = {
      error: 'Too many requests',
      code: 'RATE_LIMITED',
    };

    res.status(429).json(body);
  },
});

/**
 * IP-level guard before API-key authentication so invalid-key traffic cannot
 * bypass rate limiting by never reaching the per-key limiter.
 */
export const webhookIngestionIpRateLimiter: RequestHandler = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: 1_000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    const body: ApiErrorResponse = {
      error: 'Too many webhook requests from this IP',
      code: 'RATE_LIMITED',
    };
    res.status(429).json(body);
  },
});
