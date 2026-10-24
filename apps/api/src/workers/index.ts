import type { Worker } from 'bullmq';
import type { DeadLetterJobData } from '../queues/dead-letter.queue.js';
import type { WebhookJobData } from '../queues/webhook.queue.js';
import { createDeadLetterWorker } from './dead-letter.worker.js';
import { createDeliveryWorker } from './delivery.worker.js';

export interface HookRelayWorkers {
  delivery: Worker<WebhookJobData, void, string>;
  deadLetter: Worker<DeadLetterJobData, void, string>;
  close(): Promise<void>;
}

export function startWorkers(): HookRelayWorkers {
  const delivery = createDeliveryWorker();
  const deadLetter = createDeadLetterWorker();

  delivery.on('error', (error) => {
    console.error('[hookrelay-worker] delivery worker error:', error);
  });
  delivery.on('failed', (job, error) => {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Delivery worker job failed outside processor handling',
        eventId: job?.data.eventId ?? null,
        attemptNumber: job?.data.attemptNumber ?? null,
        targetUrl: job?.data.targetUrl ?? null,
        status: 'worker_error',
        responseTimeMs: null,
        error: error.message,
      }),
    );
  });

  deadLetter.on('error', (error) => {
    console.error('[hookrelay-worker] dead-letter worker error:', error);
  });
  deadLetter.on('failed', (job, error) => {
    console.error(`[hookrelay-worker] dead-letter job ${job?.id ?? '<unknown>'} failed:`, error);
  });

  console.info('[hookrelay-worker] delivery worker started');
  console.info('[hookrelay-worker] dead-letter worker started');

  return {
    delivery,
    deadLetter,
    async close(): Promise<void> {
      await Promise.all([delivery.close(), deadLetter.close()]);
    },
  };
}
