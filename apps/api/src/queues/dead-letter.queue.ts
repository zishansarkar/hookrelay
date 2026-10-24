import { Queue, type Job } from 'bullmq';
import { QUEUE_NAMES } from '@hookrelay/shared';
import { getRedisConnection } from '../config/redis.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('dead-letter-queue');

/**
 * Shape of a job stored in the dead-letter queue.
 *
 * Events reach it after exhausting all retries; keeping the last error and a
 * timestamp lets the dashboard show why delivery failed permanently.
 */
export interface DeadLetterJobData {
  eventId: string;
  lastError: string;
  failedAt: string;
}

export type DeadLetterJob = Job<DeadLetterJobData, void, string>;

/**
 * Dead-letter queue for webhook events that have exhausted all retries.
 */
export const deadLetterQueue = new Queue<DeadLetterJobData, void>(QUEUE_NAMES.deadLetter, {
  connection: getRedisConnection(),
});

deadLetterQueue.on('error', (error: Error) => {
  logger.error({ err: error, queue: QUEUE_NAMES.deadLetter }, 'Queue error');
});

/**
 * Moves a failed event to the dead-letter queue.
 */
export async function moveToDeadLetter(eventId: string, lastError: string): Promise<DeadLetterJob> {
  return deadLetterQueue.add('failed', {
    eventId,
    lastError,
    failedAt: new Date().toISOString(),
  });
}
