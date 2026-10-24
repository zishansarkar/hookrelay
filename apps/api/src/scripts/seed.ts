import { randomBytes } from 'node:crypto';
import { DeliveryStatus } from '@hookrelay/shared';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { ApiKey, DeliveryAttempt, Developer, WebhookEvent, hashPassword } from '../models/index.js';
import { buildSignatureHeader, signPayload } from '../utils/signing.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('seed');
const DEMO_EMAIL = 'demo@hookrelay.com';
const DEMO_PASSWORD = 'Demo1234!';
const EVENT_COUNT = 50;
const statuses = [
  ...Array.from({ length: 24 }, () => DeliveryStatus.SUCCESS),
  ...Array.from({ length: 10 }, () => DeliveryStatus.FAILED),
  ...Array.from({ length: 8 }, () => DeliveryStatus.PENDING),
  ...Array.from({ length: 8 }, () => DeliveryStatus.DEAD_LETTER),
] as const;

function makePayload(index: number): Record<string, unknown> {
  switch (index % 3) {
    case 0:
      return {
        type: 'payment.succeeded',
        data: {
          paymentId: `pay_demo_${String(index + 1).padStart(5, '0')}`,
          amount: 4999 + index * 100,
          currency: 'USD',
          customerId: `cus_demo_${String(index + 1).padStart(4, '0')}`,
        },
      };
    case 1:
      return {
        type: 'order.updated',
        data: {
          orderId: `ord_demo_${String(index + 1).padStart(5, '0')}`,
          status: ['processing', 'shipped', 'delivered'][index % 3],
          trackingNumber: `TRK${String(100_000 + index)}`,
        },
      };
    default:
      return {
        type: 'user.signup',
        data: {
          userId: `usr_demo_${String(index + 1).padStart(5, '0')}`,
          email: `customer${index + 1}@example.com`,
          plan: index % 2 === 0 ? 'starter' : 'business',
        },
      };
  }
}

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo seed is disabled in production because it creates a public demo login.');
  }

  await connectDatabase();
  try {
    let developer = await Developer.findOne({ email: DEMO_EMAIL });
    if (!developer) {
      developer = await Developer.create({
        email: DEMO_EMAIL,
        passwordHash: await hashPassword(DEMO_PASSWORD),
        companyName: 'HookRelay Demo',
        plan: 'pro',
      });
    }

    let rawApiKey: string | undefined;
    const existingKey = await ApiKey.findOne({
      developerId: developer.id,
      name: 'HookRelay demo key',
      isActive: true,
    });
    if (!existingKey) {
      const generated = ApiKey.generateKey();
      rawApiKey = generated.rawKey;
      await ApiKey.create({
        developerId: developer.id,
        key: generated.hashedKey,
        lastFour: generated.rawKey.slice(-4),
        name: 'HookRelay demo key',
      });
    }

    const existingEvents = await WebhookEvent.find({
      developerId: developer.id,
      id: /^demo-event-/,
    }).select({ id: 1 });
    const existingEventIds = existingEvents.map(({ id }) => id);
    await DeliveryAttempt.deleteMany({ eventId: { $in: existingEventIds } });
    await WebhookEvent.deleteMany({ id: { $in: existingEventIds } });

    const now = Date.now();
    const signingSecret = randomBytes(32).toString('hex');
    const events = statuses.map((status, index) => {
      const id = `demo-event-${String(index + 1).padStart(3, '0')}`;
      const createdAt = new Date(now - (index % 30) * 24 * 60 * 60 * 1000 - (index % 24) * 60 * 60 * 1000);
      const payload = makePayload(index);
      const attemptCount =
        status === DeliveryStatus.DEAD_LETTER ? 4 : status === DeliveryStatus.FAILED ? 2 : 1;
      const timestamp = Math.floor(createdAt.getTime() / 1000);
      const signature = buildSignatureHeader(signPayload(payload, signingSecret, timestamp), timestamp);
      const headers = {
        'content-type': 'application/json',
        'x-hookrelay-signature-256': signature,
        'x-hookrelay-timestamp': String(timestamp),
      };

      return {
        id,
        developerId: developer.id,
        targetUrl: `https://webhooks.example.com/${['payments', 'orders', 'users'][index % 3]}`,
        httpMethod: (index % 5 === 0 ? 'PATCH' : index % 3 === 0 ? 'PUT' : 'POST') as
          | 'POST'
          | 'PUT'
          | 'PATCH',
        headers: {},
        payload,
        signingSecret,
        status,
        attempts: attemptCount,
        maxRetries: 3,
        nextRetryAt:
          status === DeliveryStatus.PENDING ? new Date(now + 60_000 * (index + 1)) : null,
        createdAt,
        updatedAt: new Date(createdAt.getTime() + attemptCount * 12_000),
        attemptCount,
        requestHeaders: headers,
      };
    });

    await WebhookEvent.insertMany(
      events.map(({ attemptCount: _attemptCount, requestHeaders: _requestHeaders, ...event }) => event),
    );
    await DeliveryAttempt.insertMany(
      events.flatMap((event) =>
        Array.from({ length: event.attemptCount }, (_, index) => {
          const attemptNumber = index + 1;
          const isPendingLastAttempt =
            event.status === DeliveryStatus.PENDING && attemptNumber === event.attemptCount;
          const isSuccess = event.status === DeliveryStatus.SUCCESS;
          const statusCode = isPendingLastAttempt
            ? null
            : isSuccess
              ? index === 0 && event.id.endsWith('001')
                ? 201
                : 200
              : event.status === DeliveryStatus.DEAD_LETTER
                ? [503, 502, 504, 500][index]!
                : 503;

          return {
            id: `${event.id}-attempt-${attemptNumber}`,
            eventId: event.id,
            attemptNumber,
            requestHeaders: event.requestHeaders,
            statusCode,
            responseHeaders: statusCode === null ? {} : { 'content-type': 'application/json' },
            responseBody:
              statusCode === null
                ? null
                : JSON.stringify(
                    isSuccess
                      ? { received: true, eventId: event.id }
                      : { error: 'Temporary receiver failure', retryable: true },
                  ),
            responseTimeMs: statusCode === null ? null : 80 + ((event.id.length * 31 + index * 47) % 1800),
            error: statusCode === null ? null : isSuccess ? null : 'Receiver returned a temporary error',
            createdAt: new Date(event.createdAt.getTime() + attemptNumber * 12_000),
          };
        }),
      ),
    );

    logger.info(
      { developerId: developer.id, eventCount: EVENT_COUNT },
      'Demo developer and webhook events seeded',
    );
    process.stdout.write(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}\n`);
    if (rawApiKey) {
      process.stdout.write(`Demo API key (shown once): ${rawApiKey}\n`);
    } else {
      process.stdout.write(
        'An active demo API key already exists; its secret cannot be displayed again.\n',
      );
    }
  } finally {
    await disconnectDatabase();
  }
}

seed().catch((error: unknown) => {
  logger.error({ err: error }, 'Demo data seeding failed');
  process.exitCode = 1;
});
