import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const { redisState, mockRedis } = vi.hoisted(() => {
  const state = { count: 1, score: String(Date.now() - 100) };
  const transaction = {
    zremrangebyscore: vi.fn(() => transaction),
    zadd: vi.fn(() => transaction),
    zcard: vi.fn(() => transaction),
    zrange: vi.fn(() => transaction),
    pexpire: vi.fn(() => transaction),
    exec: vi.fn(async () => [
      [null, 0],
      [null, 1],
      [null, state.count],
      [null, ['request-member', state.score]],
      [null, 1],
    ]),
  };
  return {
    redisState: state,
    mockRedis: { multi: vi.fn(() => transaction) },
  };
});

vi.mock('../../src/config/redis.js', () => ({
  getRedisConnection: () => mockRedis,
}));

import { createApiKeyRateLimiter } from '../../src/middleware/rateLimiter.js';

function createTestApp(plan: 'free' | 'pro' | 'team') {
  const app = express();
  app.use((req, _res, next) => {
    req.developer = { id: 'rate-limit-developer', email: 'rate@example.com', plan };
    next();
  });
  app.get('/', createApiKeyRateLimiter({ windowMs: 60_000, max: 100 }), (_req, res) =>
    res.status(200).json({ ok: true }),
  );
  return app;
}

describe('Redis-backed API key rate limiter', () => {
  it('uses the developer plan limit and returns sliding-window headers', async () => {
    redisState.count = 1;
    const response = await request(createTestApp('team')).get('/').set('x-api-key', 'secret-key');

    expect(response.status).toBe(200);
    expect(response.headers['x-ratelimit-limit']).toBe('5000');
    expect(response.headers['x-ratelimit-remaining']).toBe('4999');
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
    expect(mockRedis.multi).toHaveBeenCalledOnce();
  });

  it('returns 429 with Retry-After when the sliding window is exhausted', async () => {
    redisState.count = 101;
    const response = await request(createTestApp('free')).get('/').set('x-api-key', 'secret-key');

    expect(response.status).toBe(429);
    expect(response.body.code).toBe('RATE_LIMITED');
    expect(response.headers['retry-after']).toBeDefined();
    expect(response.headers['x-ratelimit-limit']).toBe('100');
    expect(response.headers['x-ratelimit-remaining']).toBe('0');
  });
});
