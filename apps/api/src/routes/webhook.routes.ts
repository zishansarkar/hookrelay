import { Router } from 'express';
import { sendSuccess } from '../http/response.js';
import { getAuthenticatedDeveloper } from '../middleware/authenticate.js';
import { authenticateApiKey } from '../middleware/authenticateApiKey.js';
import { validate } from '../middleware/validate.js';
import * as webhookService from '../services/webhook.service.js';
import { sendWebhookSchema } from '../validators/webhook.validators.js';

/**
 * Webhook ingestion routes.
 *
 * Mounted at `/v1/webhooks`; authentication is by API key, not JWT, because
 * this is the endpoint developer backends call.
 */
export const webhookRoutes: Router = Router();

webhookRoutes.post('/send', authenticateApiKey, validate(sendWebhookSchema), async (req, res) => {
  const developer = getAuthenticatedDeveloper(req);

  const result = await webhookService.sendWebhook(developer.id, sendWebhookSchema.parse(req.body));

  sendSuccess(res, 202, result);
});
