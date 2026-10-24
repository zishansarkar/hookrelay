import { Router } from 'express';
import { DeliveryStatus } from '@hookrelay/shared';
import { authenticate } from '../middleware/authenticate.js';
import { DeliveryAttempt, WebhookEvent } from '../models/index.js';
import { deadLetterQueue } from '../queues/dead-letter.queue.js';
import { webhookQueue } from '../queues/webhook.queue.js';
import { createLogger } from '../utils/logger.js';
import { getActiveWorkerCount } from '../workers/index.js';
import { sendSuccess } from '../http/response.js';

const logger = createLogger('metrics');
export const metricsRoutes = Router();

metricsRoutes.get('/', authenticate, async (_req, res) => {
  const [totalEvents, statusCounts, attempts, deliveryQueueCounts, deadLetterCounts] =
    await Promise.all([
      WebhookEvent.countDocuments(),
      WebhookEvent.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      DeliveryAttempt.aggregate<{ averageResponseTimeMs: number | null }>([
        { $match: { responseTimeMs: { $ne: null } } },
        { $group: { _id: null, averageResponseTimeMs: { $avg: '$responseTimeMs' } } },
      ]),
      webhookQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
      deadLetterQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
    ]).catch((error: unknown) => {
      logger.error({ err: error }, 'Failed to collect API metrics');
      throw error;
    });

  const counts = new Map(statusCounts.map(({ _id, count }) => [_id, count]));
  const successful = counts.get(DeliveryStatus.SUCCESS) ?? 0;
  const failed =
    (counts.get(DeliveryStatus.FAILED) ?? 0) + (counts.get(DeliveryStatus.DEAD_LETTER) ?? 0);
  const completed = successful + failed;

  sendSuccess(res, 200, {
    totalEventsProcessed: totalEvents,
    successCount: successful,
    failureCount: failed,
    successRate: completed > 0 ? successful / completed : 0,
    failureRate: completed > 0 ? failed / completed : 0,
    averageResponseTimeMs: attempts[0]?.averageResponseTimeMs ?? 0,
    queueDepth: {
      delivery:
        (deliveryQueueCounts.waiting ?? 0) +
        (deliveryQueueCounts.active ?? 0) +
        (deliveryQueueCounts.delayed ?? 0),
      deadLetter:
        (deadLetterCounts.waiting ?? 0) +
        (deadLetterCounts.active ?? 0) +
        (deadLetterCounts.delayed ?? 0),
    },
    activeWorkers: getActiveWorkerCount(),
  });
});
