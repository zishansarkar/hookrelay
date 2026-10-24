import nock from 'nock';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeliveryStatus } from '@hookrelay/shared';
import { DeliveryAttempt, WebhookEvent } from '../../src/models/index.js';

vi.mock('../../src/queues/webhook.queue.js', () => ({
  addWebhookJob: vi.fn().mockResolvedValue({}),
  getRetryDelayMs: vi.fn((attemptNumber: number) => attemptNumber * 1000),
}));
vi.mock('../../src/queues/dead-letter.queue.js', () => ({
  moveToDeadLetter: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../src/utils/ssrf-protection.js', () => ({
  resolveSafeTarget: vi.fn(async (url: string) => ({
    valid: true,
    target: {
      url: new URL(url),
      address: '127.0.0.1',
      family: 4,
    },
  })),
}));

import { addWebhookJob } from '../../src/queues/webhook.queue.js';
import { processWebhookJob } from '../../src/workers/delivery.worker.js';

const DEVELOPER_ID = 'developer-worker-test';
const SIGNING_SECRET = 'worker-test-signing-secret';

async function createQueuedEvent(maxRetries = 1) {
  return WebhookEvent.create({
    developerId: DEVELOPER_ID,
    targetUrl: 'http://127.0.0.1/hook',
    httpMethod: 'POST',
    headers: { 'x-custom-header': 'custom-value' },
    payload: { type: 'payment.succeeded', amount: 1200 },
    signingSecret: SIGNING_SECRET,
    status: DeliveryStatus.QUEUED,
    attempts: 0,
    maxRetries,
    nextRetryAt: null,
  });
}

afterEach(() => {
  nock.cleanAll();
  vi.clearAllMocks();
});

describe('delivery worker processor', () => {
  it('delivers a signed webhook and records its successful response', async () => {
    const event = await createQueuedEvent();
    const scope = nock('http://127.0.0.1')
      .post('/hook', event.payload)
      .matchHeader('content-type', 'application/json')
      .matchHeader('user-agent', 'HookRelay/1.0')
      .matchHeader('x-hookrelay-event-id', event.id)
      .matchHeader('x-custom-header', 'custom-value')
      .matchHeader('x-hookrelay-timestamp', /^\d+$/)
      .matchHeader('x-hookrelay-signature-256', /^t=\d+,v1=[a-f0-9]{64}$/)
      .reply(202, 'accepted');

    await processWebhookJob({
      eventId: event.id,
      targetUrl: event.targetUrl,
      httpMethod: event.httpMethod,
      headers: event.headers,
      payload: event.payload,
      signingSecret: SIGNING_SECRET,
      attemptNumber: 0,
      maxRetries: 1,
      developerId: DEVELOPER_ID,
    });

    const updatedEvent = await WebhookEvent.findOne({ id: event.id });
    const attempts = await DeliveryAttempt.find({ eventId: event.id });

    expect(scope.isDone()).toBe(true);
    expect(updatedEvent?.status).toBe(DeliveryStatus.SUCCESS);
    expect(updatedEvent?.attempts).toBe(1);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      attemptNumber: 1,
      statusCode: 202,
      responseBody: 'accepted',
      error: null,
    });
    expect(attempts[0]?.responseTimeMs).toEqual(expect.any(Number));
  });

  it('records a failed response and queues the next attempt explicitly', async () => {
    const event = await createQueuedEvent();
    const scope = nock('http://127.0.0.1').post('/hook').reply(503, 'try again');

    await processWebhookJob({
      eventId: event.id,
      targetUrl: event.targetUrl,
      httpMethod: event.httpMethod,
      headers: event.headers,
      payload: event.payload,
      signingSecret: SIGNING_SECRET,
      attemptNumber: 0,
      maxRetries: 1,
      developerId: DEVELOPER_ID,
    });

    const updatedEvent = await WebhookEvent.findOne({ id: event.id });
    const attempt = await DeliveryAttempt.findOne({ eventId: event.id });

    expect(scope.isDone()).toBe(true);
    expect(updatedEvent?.status).toBe(DeliveryStatus.PENDING);
    expect(updatedEvent?.attempts).toBe(1);
    expect(updatedEvent?.nextRetryAt).toBeInstanceOf(Date);
    expect(attempt).toMatchObject({
      attemptNumber: 1,
      statusCode: 503,
      responseBody: 'try again',
      error: 'Receiver responded with HTTP 503',
    });
    expect(addWebhookJob).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: event.id,
        attemptNumber: 1,
      }),
      1_000,
    );
  });
});
