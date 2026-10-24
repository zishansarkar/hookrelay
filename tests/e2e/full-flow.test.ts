import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { DeliveryStatus, type DeliveryAttempt, type WebhookEvent } from '@hookrelay/shared';
import type { Worker } from 'bullmq';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SsrfProtection from '../../apps/api/src/utils/ssrf-protection.js';
import type { webhookQueue as WebhookQueueInstance } from '../../apps/api/src/queues/webhook.queue.js';
import type { deadLetterQueue as DeadLetterQueueInstance } from '../../apps/api/src/queues/dead-letter.queue.js';
import type { closeRedisConnection as CloseRedisConnection } from '../../apps/api/src/config/redis.js';

vi.mock('../../apps/api/src/utils/ssrf-protection.js', async (importOriginal) => {
  const actual = await importOriginal<SsrfProtection>();
  const allowLoopbackForTest = (value: string) => {
    const url = new URL(value);
    return {
      valid: true as const,
      target: { url, address: '127.0.0.1', family: 4 as const },
    };
  };

  return {
    ...actual,
    resolveSafeTarget: async (value: string, options?: { isProduction?: boolean }) =>
      new URL(value).hostname === '127.0.0.1'
        ? allowLoopbackForTest(value)
        : actual.resolveSafeTarget(value, options),
    validateTargetUrl: async (value: string, options?: { isProduction?: boolean }) =>
      new URL(value).hostname === '127.0.0.1'
        ? { valid: true }
        : actual.validateTargetUrl(value, options),
  };
});

const runEndToEndTests = process.env.RUN_E2E_TESTS === 'true';
const TEST_RETRY_DELAY_MS = 25;
const TEST_SIGNING_SECRET = 'e2e-signing-secret-with-at-least-32-bytes';

interface ReceivedRequest {
  headers: IncomingMessage['headers'];
  body: Buffer;
}

interface TestReceiver {
  url: string;
  received: ReceivedRequest[];
  close(): Promise<void>;
}

interface TestCredentials {
  token: string;
  apiKey: string;
}

interface EventDetail extends WebhookEvent {
  deliveryAttempts: DeliveryAttempt[];
}

let app: Express;
let deliveryWorker: Worker | undefined;
let webhookQueue: typeof WebhookQueueInstance | undefined;
let deadLetterQueue: typeof DeadLetterQueueInstance | undefined;
let closeRedisConnection: typeof CloseRedisConnection | undefined;
let testSequence = 0;

function startReceiver(
  responder: (request: IncomingMessage, response: ServerResponse, body: Buffer) => void,
): Promise<TestReceiver> {
  const received: ReceivedRequest[] = [];
  const server: Server = createServer((incoming, response) => {
    const chunks: Buffer[] = [];
    incoming.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    incoming.on('end', () => {
      const body = Buffer.concat(chunks);
      received.push({ headers: incoming.headers, body });
      responder(incoming, response, body);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      const address = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${address.port}/webhook`,
        received,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()));
          }),
      });
    });
  });
}

async function createCredentials(): Promise<TestCredentials> {
  testSequence += 1;
  const email = `e2e-${testSequence}-${Date.now()}@example.com`;
  const password = 'ValidPass123';
  const registerResponse = await request(app).post('/v1/auth/register').send({ email, password });
  expect(registerResponse.status).toBe(201);
  expect(registerResponse.body.success).toBe(true);

  const loginResponse = await request(app).post('/v1/auth/login').send({ email, password });
  expect(loginResponse.status).toBe(200);
  const token: unknown = loginResponse.body.data?.token;
  expect(typeof token).toBe('string');

  const keyResponse = await request(app)
    .post('/v1/api-keys')
    .set('Authorization', `Bearer ${String(token)}`)
    .send({ name: 'E2E test key' });
  expect(keyResponse.status).toBe(201);
  const apiKey: unknown = keyResponse.body.data?.rawKey;
  expect(typeof apiKey).toBe('string');

  return { token: String(token), apiKey: String(apiKey) };
}

async function sendWebhook(
  credentials: TestCredentials,
  targetUrl: string,
  payload: unknown,
  maxRetries?: number,
): Promise<string> {
  const body = {
    targetUrl,
    payload,
    signingSecret: TEST_SIGNING_SECRET,
    ...(maxRetries === undefined ? {} : { maxRetries }),
  };
  const response = await request(app)
    .post('/v1/webhooks/send')
    .set('x-api-key', credentials.apiKey)
    .send(body);

  expect(response.status).toBe(202);
  const eventId: unknown = response.body.eventId ?? response.body.data?.eventId;
  expect(typeof eventId).toBe('string');
  return String(eventId);
}

async function getEvent(token: string, eventId: string): Promise<EventDetail> {
  const response = await request(app)
    .get(`/v1/events/${encodeURIComponent(eventId)}`)
    .set('Authorization', `Bearer ${token}`);
  expect(response.status).toBe(200);
  return response.body.data as EventDetail;
}

async function waitForEvent(
  token: string,
  eventId: string,
  predicate: (event: EventDetail) => boolean,
  timeoutMs: number,
): Promise<EventDetail> {
  const deadline = Date.now() + timeoutMs;
  let latest: EventDetail | undefined;
  while (Date.now() < deadline) {
    latest = await getEvent(token, eventId);
    if (predicate(latest)) return latest;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error(
    `Timed out waiting for event ${eventId}; last event state: ${JSON.stringify(latest)}`,
  );
}

function verifySignature(received: ReceivedRequest, secret: string): boolean {
  const signatureHeader = received.headers['x-hookrelay-signature-256'];
  if (typeof signatureHeader !== 'string') return false;
  const match = /^t=(\d+),v1=([a-f\d]{64})$/i.exec(signatureHeader);
  if (!match) return false;
  const [, timestamp, signatureHex] = match;
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${received.body.toString('utf8')}`)
    .digest();
  const actual = Buffer.from(signatureHex!, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

describe.skipIf(!runEndToEndTests)('HookRelay full HTTP and delivery flow', () => {
  beforeAll(async () => {
    const [
      { createApp },
      { validateEnvironment },
      deliveryModule,
      webhookQueueModule,
      dlqModule,
      redisModule,
    ] = await Promise.all([
      import('../../apps/api/src/app.js'),
      import('../../apps/api/src/config/environment.js'),
      import('../../apps/api/src/workers/delivery.worker.js'),
      import('../../apps/api/src/queues/webhook.queue.js'),
      import('../../apps/api/src/queues/dead-letter.queue.js'),
      import('../../apps/api/src/config/redis.js'),
    ]);

    app = createApp(validateEnvironment(process.env));
    webhookQueue = webhookQueueModule.webhookQueue;
    deadLetterQueue = dlqModule.deadLetterQueue;
    closeRedisConnection = redisModule.closeRedisConnection;
    deliveryWorker = deliveryModule.createDeliveryWorker(() => TEST_RETRY_DELAY_MS);
    await webhookQueue.waitUntilReady();
    await deadLetterQueue.waitUntilReady();
  });

  beforeEach(async () => {
    if (!webhookQueue || !deadLetterQueue) {
      throw new Error('End-to-end queues were not initialized');
    }
    await webhookQueue.drain(true);
    await deadLetterQueue.drain(true);
  });

  afterAll(async () => {
    await deliveryWorker?.close();
    if (webhookQueue) await webhookQueue.close();
    if (deadLetterQueue) await deadLetterQueue.close();
    await closeRedisConnection?.();
  });

  it('registers, authenticates, delivers a signed webhook, and records a successful attempt', async () => {
    const credentials = await createCredentials();
    const receiver = await startReceiver((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ received: true }));
    });

    try {
      const payload = { type: 'payment.succeeded', paymentId: 'pay_e2e_001', amount: 4250 };
      const eventId = await sendWebhook(credentials, receiver.url, payload);

      const acceptedEvent = await waitForEvent(
        credentials.token,
        eventId,
        (event) => event.status === DeliveryStatus.SUCCESS,
        10_000,
      );

      expect(acceptedEvent.status).toBe(DeliveryStatus.SUCCESS);
      expect(acceptedEvent.attempts).toBe(1);
      expect(acceptedEvent.deliveryAttempts).toHaveLength(1);
      expect(acceptedEvent.deliveryAttempts[0].statusCode).toBe(200);
      expect(receiver.received).toHaveLength(1);
      expect(JSON.parse(receiver.received[0]!.body.toString('utf8'))).toEqual(payload);
      expect(verifySignature(receiver.received[0]!, TEST_SIGNING_SECRET)).toBe(true);
    } finally {
      await receiver.close();
    }
  }, 15_000);

  it('retries two failures and succeeds on the third delivery attempt', async () => {
    const credentials = await createCredentials();
    let requestCount = 0;
    const receiver = await startReceiver((_request, response) => {
      requestCount += 1;
      response.writeHead(requestCount <= 2 ? 500 : 200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ requestCount }));
    });

    try {
      const eventId = await sendWebhook(credentials, receiver.url, { type: 'retry.test' });
      const deliveredEvent = await waitForEvent(
        credentials.token,
        eventId,
        (event) => event.status === DeliveryStatus.SUCCESS && event.deliveryAttempts.length === 3,
        10_000,
      );

      expect(deliveredEvent.status).toBe(DeliveryStatus.SUCCESS);
      expect(deliveredEvent.deliveryAttempts.map((attempt) => attempt.statusCode)).toEqual([
        500, 500, 200,
      ]);
      expect(receiver.received).toHaveLength(3);
    } finally {
      await receiver.close();
    }
  }, 15_000);

  it('moves exhausted deliveries to dead letter and creates a fresh attempt on replay', async () => {
    const credentials = await createCredentials();
    const receiver = await startReceiver((_request, response) => {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'retry later' }));
    });

    try {
      const eventId = await sendWebhook(credentials, receiver.url, { type: 'dead-letter.test' }, 2);
      const deadLetterEvent = await waitForEvent(
        credentials.token,
        eventId,
        (event) =>
          event.status === DeliveryStatus.DEAD_LETTER && event.deliveryAttempts.length === 3,
        10_000,
      );

      expect(deadLetterEvent.status).toBe(DeliveryStatus.DEAD_LETTER);
      expect(deadLetterEvent.attempts).toBe(3);

      const replayResponse = await request(app)
        .post(`/v1/events/${encodeURIComponent(eventId)}/replay`)
        .set('Authorization', `Bearer ${credentials.token}`);
      expect(replayResponse.status).toBe(200);
      expect(replayResponse.body.data.event.status).toBe(DeliveryStatus.QUEUED);

      const replayedEvent = await waitForEvent(
        credentials.token,
        eventId,
        (event) => event.deliveryAttempts.length >= 4,
        10_000,
      );
      expect(replayedEvent.deliveryAttempts).toHaveLength(4);
      expect(receiver.received).toHaveLength(4);
      expect(replayedEvent.deliveryAttempts[3].attemptNumber).toBe(1);
    } finally {
      await receiver.close();
    }
  }, 15_000);
});
