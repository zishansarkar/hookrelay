import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';
import { getRetryDelayMs } from './apps/api/src/queues/webhook.queue.ts';
import { QUEUE_NAMES, RETRY_SCHEDULE_MS } from './packages/shared/src/constants/index.ts';

const logger = pino({ base: { service: 'hookrelay-queue-check' } });
logger.info({ retryScheduleMs: RETRY_SCHEDULE_MS }, 'Retry schedule');
for (const attemptNumber of [0, 1, 2, 3, 5]) {
  logger.info({ attemptNumber, delayMs: getRetryDelayMs(attemptNumber) }, 'Retry delay');
}

const redis = new Redis('redis://localhost:6379', { maxRetriesPerRequest: null });
const q = new Queue(QUEUE_NAMES.delivery, { connection: redis });
const dlq = new Queue(QUEUE_NAMES.deadLetter, { connection: redis });
try {
  await redis.ping();
  logger.info({ queues: [QUEUE_NAMES.delivery, QUEUE_NAMES.deadLetter] }, 'Queues connected');
  const job = await q.add(
    'deliver',
    {
      eventId: 'x',
      targetUrl: 'http://x',
      httpMethod: 'POST',
      headers: {},
      payload: {},
      signingSecret: '',
      attemptNumber: 0,
      maxRetries: 3,
      developerId: 'y',
    },
    { jobId: 'x-attempt-0' },
  );
  const exists = await q.getJob('x-attempt-0');
  logger.info({ jobId: job.id, existingJobId: exists?.id }, 'Queue job checked');
  await q.remove('x-attempt-0');
} catch (error) {
  logger.error({ err: error }, 'Queue check failed');
  process.exitCode = 1;
} finally {
  await Promise.allSettled([q.close(), dlq.close()]);
  redis.disconnect();
}
