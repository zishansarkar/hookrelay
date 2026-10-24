import { Worker, type Job } from 'bullmq';
import { QUEUE_NAMES } from '@hookrelay/shared';
import { getRedisConnection } from '../config/redis.js';
import type { DeadLetterJobData } from '../queues/dead-letter.queue.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('dead-letter-worker');

async function processDeadLetterJob(job: Job<DeadLetterJobData>): Promise<void> {
  logger.warn(
    {
      eventId: job.data.eventId,
      jobId: job.id,
      status: 'dead_letter',
      error: job.data.lastError,
      failedAt: job.data.failedAt,
    },
    'Webhook moved to dead-letter queue',
  );
}

export function createDeadLetterWorker(): Worker<DeadLetterJobData, void, string> {
  return new Worker<DeadLetterJobData, void, string>(QUEUE_NAMES.deadLetter, processDeadLetterJob, {
    connection: getRedisConnection(),
    autorun: true,
  });
}
