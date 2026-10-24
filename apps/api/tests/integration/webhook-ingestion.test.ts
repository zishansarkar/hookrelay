import { createHash } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import { performance } from 'node:perf_hooks';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryStatus } from '@hookrelay/shared';
import { validateEnvironment } from '../../src/config/environment.js';
import { ApiKey, Developer, WebhookEvent } from '../../src/models/index.js';

const { usageMocks } = vi.hoisted(() => ({
  usageMocks: {
    isWithinLimit: vi.fn(),
    trackUsage: vi.fn(),
    getUsage: vi.fn(),
  },
}));

vi.mock('../../src/services/usage.service.js', () => usageMocks);
vi.mock('../../src/middleware/rateLimiter.js', () => ({
  apiKeyRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../src/queues/webhook.queue.js', () => ({
  addWebhookJob: vi.fn().mockResolvedValue({}),
}));

import { createApp } from '../../src/app.js';

const TEST_DEVELOPER_ID = 'developer-ingestion-test';
const RAW_API_KEY = 'hk_live_0123456789abcdef0123456789abcdef';
const VALID_REQUEST_BODY = {
  targetUrl: 'https://1.1.1.1/webhooks',
  payload: { event: 'payment.succeeded', amount: 1200 },
};

const app = createApp(validateEnvironment());

async function seedDeveloper(plan: 'free' | 'pro' | 'team' = 'free', used = 0): Promise<void> {
  await Developer.create({
    id: TEST_DEVELOPER_ID,
    email: 'ingestion-test@example.com',
    passwordHash: 'test-hash',
    plan,
    webhooksUsedThisMonth: used,
  });
  await ApiKey.create({
    developerId: TEST_DEVELOPER_ID,
    key: createHash('sha256').update(RAW_API_KEY).digest('hex'),
    lastFour: RAW_API_KEY.slice(-4),
    name: 'Integration test key',
  });
}

describe('POST /v1/webhooks/send', () => {
  beforeEach(() => {
    usageMocks.isWithinLimit.mockResolvedValue(true);
    usageMocks.trackUsage.mockResolvedValue(1);
    usageMocks.getUsage.mockResolvedValue({
      used: 3,
      limit: 10_000,
      plan: 'free',
      resetDate: new Date('2026-11-01T00:00:00.000Z'),
    });
  });

  describe('GET /v1/usage', () => {
    it('returns current usage statistics for the JWT-authenticated developer', async () => {
      const config = validateEnvironment();
      const token = sign(
        { id: TEST_DEVELOPER_ID, email: 'ingestion-test@example.com', plan: 'free' },
        config.jwtSecret ?? 'test-jwt-secret',
      );

      const response = await request(app).get('/v1/usage').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        used: 3,
        limit: 10_000,
        plan: 'free',
        resetDate: '2026-11-01T00:00:00.000Z',
      });
      expect(usageMocks.getUsage).toHaveBeenCalledWith(TEST_DEVELOPER_ID);
    });
  });

  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('returns 202 for a valid payload authenticated with a valid API key', async () => {
    await seedDeveloper();

    const response = await request(app)
      .post('/v1/webhooks/send')
      .set('x-api-key', RAW_API_KEY)
      .send(VALID_REQUEST_BODY);

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      status: 'queued',
      message: 'Webhook queued for delivery',
    });
  });

  it('returns 401 when the API key is missing', async () => {
    const response = await request(app).post('/v1/webhooks/send').send(VALID_REQUEST_BODY);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_API_KEY');
  });

  it('returns 401 when the API key is invalid', async () => {
    await seedDeveloper();

    const response = await request(app)
      .post('/v1/webhooks/send')
      .set('x-api-key', 'hk_live_invalid')
      .send(VALID_REQUEST_BODY);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_API_KEY');
  });

  it('returns 400 when targetUrl is not a valid URL', async () => {
    await seedDeveloper();

    const response = await request(app)
      .post('/v1/webhooks/send')
      .set('x-api-key', RAW_API_KEY)
      .send({ ...VALID_REQUEST_BODY, targetUrl: 'not a URL' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when payload is missing', async () => {
    await seedDeveloper();

    const response = await request(app)
      .post('/v1/webhooks/send')
      .set('x-api-key', RAW_API_KEY)
      .send({ targetUrl: VALID_REQUEST_BODY.targetUrl });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when the JSON request exceeds the payload size limit', async () => {
    await seedDeveloper();
    const largeJson = JSON.stringify({
      targetUrl: VALID_REQUEST_BODY.targetUrl,
      payload: 'x'.repeat(256 * 1024),
    });

    const response = await request(app)
      .post('/v1/webhooks/send')
      .set('x-api-key', RAW_API_KEY)
      .set('content-type', 'application/json')
      .send(largeJson);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('returns 429 when the developer has exhausted the monthly plan limit', async () => {
    await seedDeveloper('free', 10_000);
    usageMocks.isWithinLimit.mockResolvedValueOnce(false);

    const response = await request(app)
      .post('/v1/webhooks/send')
      .set('x-api-key', RAW_API_KEY)
      .send(VALID_REQUEST_BODY);

    expect(response.status).toBe(429);
    expect(response.body.code).toBe('QUOTA_EXCEEDED');
  });

  it('persists accepted webhook events with QUEUED status', async () => {
    await seedDeveloper();

    const response = await request(app)
      .post('/v1/webhooks/send')
      .set('x-api-key', RAW_API_KEY)
      .send(VALID_REQUEST_BODY);
    const event = await WebhookEvent.findOne({ id: response.body.eventId });

    expect(response.status).toBe(202);
    expect(event).not.toBeNull();
    expect(event?.status).toBe(DeliveryStatus.QUEUED);
    expect(event?.developerId).toBe(TEST_DEVELOPER_ID);
  });

  it('strips sensitive headers before storing outbound delivery headers', async () => {
    await seedDeveloper();

    const response = await request(app)
      .post('/v1/webhooks/send')
      .set('x-api-key', RAW_API_KEY)
      .send({
        ...VALID_REQUEST_BODY,
        headers: {
          Authorization: 'Bearer should-not-forward',
          Cookie: 'session=should-not-forward',
          'x-safe-header': 'forward-me',
        },
      });
    const event = await WebhookEvent.findOne({ id: response.body.eventId });

    expect(response.status).toBe(202);
    expect(event?.headers).toEqual({ 'x-safe-header': 'forward-me' });
  });

  it('accepts a valid request in under 100ms after test setup', async () => {
    await seedDeveloper();
    const startedAt = performance.now();

    const response = await request(app)
      .post('/v1/webhooks/send')
      .set('x-api-key', RAW_API_KEY)
      .send(VALID_REQUEST_BODY);
    const elapsedMs = performance.now() - startedAt;

    expect(response.status).toBe(202);
    expect(elapsedMs).toBeLessThan(100);
  });
});
