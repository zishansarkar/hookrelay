import type { Worker } from 'bullmq';
import type { DeadLetterJobData } from '../queues/dead-letter.queue.js';
import type { WebhookJobData } from '../queues/webhook.queue.js';
import { createDeadLetterWorker } from './dead-letter.worker.js';
import { createDeliveryWorker } from './delivery.worker.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('workers');
let activeWorkerCount = 0;

export function getActiveWorkerCount(): number {
  return activeWorkerCount;
}

export interface HookRelayWorkers {
  delivery: Worker<WebhookJobData, void, string>;
  deadLetter: Worker<DeadLetterJobData, void, string>;
  close(): Promise<void>;
}

export function startWorkers(): HookRelayWorkers {
  const delivery = createDeliveryWorker();
  const deadLetter = createDeadLetterWorker();
  activeWorkerCount = 2;

  delivery.on('error', (error) => {
    logger.error({ err: error, queue: 'webhook-delivery' }, 'Delivery worker error');
  });
  delivery.on('failed', (job, error) => {
    logger.error(
      {
        err: error,
        eventId: job?.data.eventId ?? null,
        developerId: job?.data.developerId ?? null,
        attemptNumber: job?.data.attemptNumber ?? null,
        targetUrl: job?.data.targetUrl ?? null,
        status: 'worker_error',
      },
      'Delivery worker job failed outside processor handling',
    );
  });

  deadLetter.on('error', (error) => {
    logger.error({ err: error, queue: 'webhook-dead-letter' }, 'Dead-letter worker error');
  });
  deadLetter.on('failed', (job, error) => {
    logger.error(
      { err: error, jobId: job?.id ?? null, eventId: job?.data.eventId ?? null },
      'Dead-letter job failed',
    );
  });

  logger.info({ queue: 'webhook-delivery' }, 'Delivery worker started');
  logger.info({ queue: 'webhook-dead-letter' }, 'Dead-letter worker started');

  return {
    delivery,
    deadLetter,
    async close(): Promise<void> {
      try {
        await Promise.all([delivery.close(), deadLetter.close()]);
      } finally {
        activeWorkerCount = 0;
      }
    },
  };
}
