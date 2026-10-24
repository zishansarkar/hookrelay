import { Queue, type Job } from 'bullmq';
import { QUEUE_NAMES, RETRY_SCHEDULE_MS } from '@hookrelay/shared';
import { getRedisConnection } from '../config/redis.js';

/** Completed jobs are kept for 7 days… */
const COMPLETED_JOB_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** …or until 1000 of them are stored, whichever comes first. */
const COMPLETED_JOB_MAX_COUNT = 1_000;

/** Name of every delivery job added to the queue. */
export const WEBHOOK_JOB_NAME = 'deliver';

/**
 * Everything the delivery worker needs for one attempt.
 *
 * This is the persisted representation (the worker is a separate process, so
 * nothing may be left implicit), not the public `SendWebhookRequest`.
 */
export interface WebhookJobData {
  eventId: string;
  targetUrl: string;
  httpMethod: string;
  headers: Record<string, string>;
  payload: unknown;
  signingSecret: string;
  attemptNumber: number;
  maxRetries: number;
  developerId: string;
  replayId?: string;
}

export type WebhookJob = Job<WebhookJobData, void, string>;

/**
 * Queue of webhook deliveries.
 *
 * Failed jobs are deliberately kept (`removeOnFail: false`) so they can be
 * inspected and moved to the dead-letter queue.
 */
export const webhookQueue = new Queue<WebhookJobData, void>(QUEUE_NAMES.delivery, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: {
      age: COMPLETED_JOB_MAX_AGE_SECONDS,
      count: COMPLETED_JOB_MAX_COUNT,
    },
    removeOnFail: false,
  },
});

webhookQueue.on('error', (error: Error) => {
  console.error(`[hookrelay-api] queue "${QUEUE_NAMES.delivery}" error: ${error.message}`);
});

/**
 * Delay before an attempt, derived from the canonical retry schedule.
 *
 * Attempt 0 runs immediately; attempt 1 waits 10s, attempt 2 waits 60s and
 * attempt 3 waits 300s. Later attempts reuse the last schedule entry.
 */
export function getRetryDelayMs(attemptNumber: number): number | undefined {
  if (attemptNumber <= 0) {
    return undefined;
  }

  const scheduleIndex = Math.min(attemptNumber - 1, RETRY_SCHEDULE_MS.length - 1);
  return RETRY_SCHEDULE_MS[scheduleIndex];
}

/**
 * Adds one delivery attempt to the queue.
 *
 * The job id is derived from the event and attempt number, so re-adding the
 * same attempt is idempotent instead of producing duplicates.
 */
export async function addWebhookJob(data: WebhookJobData): Promise<WebhookJob> {
  return webhookQueue.add(WEBHOOK_JOB_NAME, data, {
    jobId: `${data.eventId}-attempt-${data.attemptNumber}${data.replayId ? `-replay-${data.replayId}` : ''}`,
    delay: getRetryDelayMs(data.attemptNumber),
  });
}
