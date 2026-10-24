import { Worker, type Job } from 'bullmq';
import { QUEUE_NAMES } from '@hookrelay/shared';
import { getRedisConnection } from '../config/redis.js';
import type { DeadLetterJobData } from '../queues/dead-letter.queue.js';

async function processDeadLetterJob(job: Job<DeadLetterJobData>): Promise<void> {
  console.info(
    JSON.stringify({
      level: 'warn',
      message: 'Webhook moved to dead-letter queue',
      eventId: job.data.eventId,
      status: 'dead_letter',
      error: job.data.lastError,
      failedAt: job.data.failedAt,
    }),
  );
}

export function createDeadLetterWorker(): Worker<DeadLetterJobData, void, string> {
  return new Worker<DeadLetterJobData, void, string>(QUEUE_NAMES.deadLetter, processDeadLetterJob, {
    connection: getRedisConnection(),
    autorun: true,
  });
}
