import { createHash, randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Plan } from '@hookrelay/shared';
import { getRedisConnection } from '../config/redis.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('api-key-rate-limiter');

const PLAN_REQUEST_LIMITS: Record<Plan, number> = {
  free: 100,
  pro: 1_000,
  team: 5_000,
};

interface RateLimiterOptions {
  windowMs: number;
  max: number;
}

function getPlanLimit(req: Request, defaultLimit: number): number {
  const plan = req.developer?.plan;
  return plan && plan in PLAN_REQUEST_LIMITS ? PLAN_REQUEST_LIMITS[plan] : defaultLimit;
}

function getLimitKey(req: Request): string | null {
  const apiKey = req.get('x-api-key')?.trim();
  if (apiKey) {
    const digest = createHash('sha256').update(apiKey).digest('hex');
    return `hookrelay:rate-limit:key:${digest}`;
  }

  const developerId = req.developer?.id;
  return developerId ? `hookrelay:rate-limit:developer:${developerId}` : null;
}

function sendUnavailable(res: Response): void {
  res.status(503).json({
    error: 'Rate limiting service is temporarily unavailable',
    code: 'RATE_LIMIT_UNAVAILABLE',
  });
}

/**
 * Creates an atomic sliding-window limiter backed by a Redis sorted set.
 *
 * A single MULTI/EXEC round trip prunes expired requests, records this request,
 * counts the window, and reads its oldest timestamp for reset headers.
 */
export function createApiKeyRateLimiter(options: RateLimiterOptions): RequestHandler {
  if (!Number.isInteger(options.windowMs) || options.windowMs < 1) {
    throw new Error('Rate limiter windowMs must be a positive integer');
  }
  if (!Number.isInteger(options.max) || options.max < 1) {
    throw new Error('Rate limiter max must be a positive integer');
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = getLimitKey(req);
    if (!key) {
      res.status(401).json({ error: 'API key required', code: 'INVALID_API_KEY' });
      return;
    }

    const now = Date.now();
    const windowStart = now - options.windowMs;
    const limit = getPlanLimit(req, options.max);
    const redis = getRedisConnection();

    void redis
      .multi()
      .zremrangebyscore(key, '-inf', String(windowStart))
      .zadd(key, String(now), `${now}:${randomUUID()}`)
      .zcard(key)
      .zrange(key, 0, '0', 'WITHSCORES')
      .pexpire(key, options.windowMs)
      .exec()
      .then((results) => {
        if (!results) {
          sendUnavailable(res);
          return;
        }

        const [removeResult, addResult, countResult, oldestResult, expiryResult] = results;
        const commandError = results.find(([error]) => error)?.[0];
        if (commandError) {
          next(commandError);
          return;
        }
        if (
          !removeResult ||
          !addResult ||
          !countResult ||
          !oldestResult ||
          !expiryResult ||
          typeof countResult[1] !== 'number' ||
          !Array.isArray(oldestResult[1])
        ) {
          sendUnavailable(res);
          return;
        }

        const count = countResult[1];
        const firstScore = oldestResult[1][1];
        const resetAtMs =
          typeof firstScore === 'string' || typeof firstScore === 'number'
            ? Number(firstScore) + options.windowMs
            : now + options.windowMs;
        const remaining = Math.max(0, limit - count);
        const resetAtSeconds = Math.ceil(resetAtMs / 1000);

        res.setHeader('X-RateLimit-Limit', String(limit));
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        res.setHeader('X-RateLimit-Reset', String(resetAtSeconds));

        if (count > limit) {
          const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - now) / 1000));
          res.setHeader('Retry-After', String(retryAfterSeconds));
          res.status(429).json({
            error: 'Rate limit exceeded',
            code: 'RATE_LIMITED',
            details: { limit, remaining: 0, resetAt: resetAtSeconds },
          });
          return;
        }

        next();
      })
      .catch((error: unknown) => {
        logger.error({ err: error, developerId: req.developer?.id }, 'Redis rate limiter failed');
        sendUnavailable(res);
      });
  };
}

export const apiKeyRateLimiter = createApiKeyRateLimiter({
  windowMs: 60_000,
  max: PLAN_REQUEST_LIMITS.free,
});

export { PLAN_REQUEST_LIMITS };
