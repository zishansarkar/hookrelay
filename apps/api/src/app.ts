import compression from 'compression';
import cors from 'cors';
import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { API_PREFIX, MAX_PAYLOAD_SIZE_BYTES } from '@hookrelay/shared';
import type { AppConfig } from './config/environment.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { globalRateLimiter } from './middleware/rate-limiter.js';
import { requestIdMiddleware } from './middleware/security.js';
import { requestLogger } from './middleware/requestLogger.js';
import { getRedisConnection } from './config/redis.js';
import { webhookQueue } from './queues/webhook.queue.js';
import { deadLetterQueue } from './queues/dead-letter.queue.js';
import { getRecentErrorCount } from './utils/errors.js';
import { createLogger } from './utils/logger.js';
import {
  apiKeyRoutes,
  authRoutes,
  billingRoutes,
  billingWebhookRoutes,
  eventRoutes,
  metricsRoutes,
  usageRoutes,
  verificationRoutes,
  webhookRoutes,
} from './routes/index.js';

/**
 * Liveness/readiness probe.
 */
const logger = createLogger('health');
const HEALTH_CHECK_TIMEOUT_MS = 1_500;

async function checkDependency<T>(check: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      check,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} health check timed out`)),
          HEALTH_CHECK_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const healthHandler: RequestHandler = async (_req, res) => {
  const [database, redis, deliveryQueue, deadLetterCounts] = await Promise.all([
    mongoose.connection.db
      ? checkDependency(mongoose.connection.db.admin().ping(), 'MongoDB').then(
          () => 'connected' as const,
          () => 'unavailable' as const,
        )
      : Promise.resolve('disconnected' as const),
    checkDependency(getRedisConnection().ping(), 'Redis').then(
      () => 'connected' as const,
      () => 'unavailable' as const,
    ),
    checkDependency(
      webhookQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
      'Delivery queue',
    ).catch((error: unknown) => {
      logger.error({ err: error }, 'Failed to read delivery queue counts');
      return null;
    }),
    checkDependency(
      deadLetterQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
      'Dead-letter queue',
    ).catch((error: unknown) => {
      logger.error({ err: error }, 'Failed to read dead-letter queue counts');
      return null;
    }),
  ]);
  const healthy =
    database === 'connected' &&
    redis === 'connected' &&
    deliveryQueue !== null &&
    deadLetterCounts !== null;
  if (!healthy) {
    logger.warn(
      {
        database,
        redis,
        deliveryQueueAvailable: deliveryQueue !== null,
        deadLetterQueueAvailable: deadLetterCounts !== null,
      },
      'Health check reports degraded dependencies',
    );
  }

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dependencies: { database, redis },
    queues: { delivery: deliveryQueue, deadLetter: deadLetterCounts },
    errorRate: { errorsLast5Minutes: getRecentErrorCount() },
    memory: process.memoryUsage(),
  });
};

/**
 * Builds the configured Express application.
 *
 * The app does not listen on a port — that is the job of `server.ts`, so the
 * application can be mounted or exercised in tests without opening a socket.
 */
export function createApp(config: AppConfig): Express {
  const app = express();

  // Never advertise the framework.
  app.disable('x-powered-by');
  app.use(requestIdMiddleware);

  // Render terminates the public connection at one trusted reverse proxy and
  // forwards the client address. Trusting exactly that hop keeps IP-based
  // rate limits accurate without trusting arbitrary client-supplied hops.
  app.set('trust proxy', config.isProduction ? 1 : false);

  app.use(helmet());
  app.use(
    cors({
      origin: config.frontendUrl,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(requestLogger);
  // Capture the Stripe webhook body before JSON parsing; mount its handler below
  // the global limiter so webhook requests remain rate limited.
  app.use(`${API_PREFIX}/billing/webhook`, express.raw({ type: 'application/json', limit: '1mb' }));
  app.use(express.json({ limit: MAX_PAYLOAD_SIZE_BYTES }));
  app.use(globalRateLimiter);

  app.get('/', (_req, res) => {
    res.status(200).json({
      service: 'hookrelay-api',
      status: 'ok',
      health: '/health',
    });
  });

  app.get('/health', healthHandler);

  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/webhooks`, webhookRoutes);
  app.use(`${API_PREFIX}/events`, eventRoutes);
  app.use(`${API_PREFIX}/api-keys`, apiKeyRoutes);
  app.use(`${API_PREFIX}/usage`, usageRoutes);
  app.use(`${API_PREFIX}/billing`, billingWebhookRoutes);
  app.use(`${API_PREFIX}/billing`, billingRoutes);
  app.use(`${API_PREFIX}/metrics`, metricsRoutes);
  app.use(verificationRoutes);

  app.use(notFoundHandler);
  app.use(createErrorHandler(config));

  return app;
}
