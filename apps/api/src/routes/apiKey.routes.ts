import { Router } from 'express';
import { sendSuccess } from '../http/response.js';
import { authenticate, getAuthenticatedDeveloper } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import * as apiKeyService from '../services/apiKey.service.js';
import { createKeySchema } from '../validators/apiKey.validators.js';

/**
 * API key routes (create, list, revoke).
 *
 * Mounted at `/v1/api-keys`. All routes require JWT authentication
 * (the "authenticate" middleware). The API key auth (x-api-key header)
 * is used for webhook ingestion and is implemented separately.
 */
export const apiKeyRoutes: Router = Router();

apiKeyRoutes.use(authenticate);

apiKeyRoutes.post('/', validate(createKeySchema), async (req, res) => {
  const developer = getAuthenticatedDeveloper(req);

  const result = await apiKeyService.create(developer.id, createKeySchema.parse(req.body).name);

  sendSuccess(res, 201, result);
});

apiKeyRoutes.get('/', async (req, res) => {
  const developer = getAuthenticatedDeveloper(req);

  const apiKeys = await apiKeyService.list(developer.id);

  sendSuccess(res, 200, { apiKeys });
});

apiKeyRoutes.delete('/:keyId', async (req, res) => {
  const developer = getAuthenticatedDeveloper(req);

  const apiKey = await apiKeyService.revoke(developer.id, req.params.keyId);

  sendSuccess(res, 200, { apiKey });
});
