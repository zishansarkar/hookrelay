import { Router } from 'express';

/**
 * Webhook ingestion routes.
 *
 * Mounted at `/v1/webhooks`. The handlers are added in the ingestion milestone.
 */
export const webhookRoutes: Router = Router();
