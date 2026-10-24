import type { RequestHandler } from 'express';
import { recordError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('http');

export const requestLogger: RequestHandler = (req, res, next) => {
  if (req.path === '/health') {
    res.once('finish', () => {
      if (res.statusCode >= 400) recordError();
    });
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  res.once('finish', () => {
    if (res.statusCode >= 400) recordError();
    const requestId = res.locals.requestId as string | undefined;
    const rawApiKey = req.header('x-api-key');
    logger.info(
      {
        method: req.method,
        url: req.path,
        statusCode: res.statusCode,
        responseTimeMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
        requestId,
        ip: req.ip,
        apiKeyLastFour: rawApiKey ? rawApiKey.slice(-4) : undefined,
      },
      'HTTP request completed',
    );
  });
  next();
};
