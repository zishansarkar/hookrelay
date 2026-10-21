import { Router } from 'express';

/**
 * API key routes (create, list, revoke).
 *
 * Mounted at `/v1/api-keys`. The handlers are added in the API key milestone.
 */
export const apiKeyRoutes: Router = Router();
