import compression from 'compression';
import cors from 'cors';
import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { API_PREFIX, MAX_PAYLOAD_SIZE_BYTES } from '@hookrelay/shared';
import type { AppConfig } from './config/environment.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { globalRateLimiter } from './middleware/rate-limiter.js';
import { apiKeyRoutes, authRoutes, eventRoutes, webhookRoutes } from './routes/index.js';

/**
 * Liveness/readiness probe.
 */
const healthHandler: RequestHandler = (_req, res) => {
  const body = {
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  res.status(200).json(body);
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

  // `trust proxy` stays off by default: enabling it would let clients spoof
  // `X-Forwarded-For` and bypass the per-IP rate limiter. Turn it on only when
  // the app is known to sit behind a single reverse proxy.
  app.set('trust proxy', false);

  app.use(helmet());
  app.use(
    cors({
      origin: config.frontendUrl,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: MAX_PAYLOAD_SIZE_BYTES }));
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  app.use(globalRateLimiter);

  app.get('/health', healthHandler);

  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/webhooks`, webhookRoutes);
  app.use(`${API_PREFIX}/events`, eventRoutes);
  app.use(`${API_PREFIX}/api-keys`, apiKeyRoutes);

  app.use(notFoundHandler);
  app.use(createErrorHandler(config));

  return app;
}
