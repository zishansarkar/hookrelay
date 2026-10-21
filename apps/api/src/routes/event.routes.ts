import { Router } from 'express';

/**
 * Webhook event routes (listing events, delivery attempts, replay).
 *
 * Mounted at `/v1/events`. The handlers are added in the events milestone.
 */
export const eventRoutes: Router = Router();
