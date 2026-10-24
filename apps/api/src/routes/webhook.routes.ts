import { Router } from 'express';
import { getAuthenticatedDeveloper } from '../middleware/authenticate.js';
import { authenticateApiKey } from '../middleware/authenticateApiKey.js';
import { apiKeyRateLimiter } from '../middleware/rateLimiter.js';
import * as webhookService from '../services/webhook.service.js';
import { createSendWebhookSchema } from '../validators/webhook.validators.js';
import { loadConfig } from '../config/environment.js';
import { sanitizeHeaders } from '../middleware/security.js';
import { webhookIngestionIpRateLimiter } from '../middleware/rate-limiter.js';

/**
 * Webhook ingestion routes.
 *
 * Mounted at `/v1/webhooks`; authentication is by API key, not JWT, because
 * this is the endpoint developer backends call.
 */
export const webhookRoutes: Router = Router();

webhookRoutes.post(
  '/send',
  webhookIngestionIpRateLimiter,
  authenticateApiKey,
  apiKeyRateLimiter,
  sanitizeHeaders,
  (req, res, next) => {
    const developer = getAuthenticatedDeveloper(req);
    const config = loadConfig();
    const schema = createSendWebhookSchema({
      nodeEnv: config.nodeEnv,
      plan: developer.plan,
    });
    void schema
      .safeParseAsync(req.body)
      .then((result) => {
        if (!result.success) {
          const body = {
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: result.error.issues.map((issue) => ({
              field: issue.path.map(String).join('.') || 'body',
              message: issue.message,
            })),
          };
          res.status(400).json(body);
          return;
        }

        req.body = result.data;
        next();
      })
      .catch(next);
  },
  async (req, res) => {
    const developer = getAuthenticatedDeveloper(req);

    const result = await webhookService.send(developer.id, req.body);

    res.status(202).json({
      eventId: result.eventId,
      status: result.status,
      message: result.message,
    });
  },
);
