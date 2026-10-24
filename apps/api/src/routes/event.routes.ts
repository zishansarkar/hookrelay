import { Router } from 'express';
import { z } from 'zod';
import { DeliveryStatus } from '@hookrelay/shared';
import { sendSuccess } from '../http/response.js';
import { authenticate, getAuthenticatedDeveloper } from '../middleware/authenticate.js';
import * as webhookService from '../services/webhook.service.js';

/**
 * Webhook event routes (listing events, delivery attempts, replay).
 *
 * Mounted at `/v1/events`. Uses JWT authentication for the dashboard.
 */
export const eventRoutes: Router = Router();

eventRoutes.use(authenticate);

const eventListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z
      .enum([
        DeliveryStatus.SUCCESS,
        DeliveryStatus.PENDING,
        DeliveryStatus.FAILED,
        DeliveryStatus.DEAD_LETTER,
      ])
      .optional(),
    targetUrl: z.string().trim().max(2048).optional(),
    startDate: z.iso
      .datetime()
      .transform((value) => new Date(value))
      .optional(),
    endDate: z.iso
      .datetime()
      .transform((value) => new Date(value))
      .optional(),
  })
  .strict()
  .refine(
    ({ startDate, endDate }) => !startDate || !endDate || startDate.getTime() <= endDate.getTime(),
    { path: ['endDate'], message: 'End date must be on or after the start date' },
  );

eventRoutes.get('/stats', async (req, res) => {
  const developer = getAuthenticatedDeveloper(req);
  const result = await webhookService.getEventStats(developer.id);
  sendSuccess(res, 200, result);
});

eventRoutes.get('/', async (req, res) => {
  const developer = getAuthenticatedDeveloper(req);
  const { page, limit, status, targetUrl, startDate, endDate } = eventListQuerySchema.parse(
    req.query,
  );

  const result = await webhookService.listEvents(developer.id, {
    page,
    limit,
    status,
    targetUrl,
    startDate,
    endDate,
  });

  sendSuccess(res, 200, result);
});

eventRoutes.get('/:eventId', async (req, res) => {
  const developer = getAuthenticatedDeveloper(req);
  const eventId = req.params.eventId;

  const result = await webhookService.getEvent(developer.id, eventId);

  if (!result) {
    res.status(404).json({ error: 'Event not found', code: 'NOT_FOUND' });
    return;
  }

  sendSuccess(res, 200, result);
});

eventRoutes.post('/:eventId/replay', async (req, res) => {
  const developer = getAuthenticatedDeveloper(req);
  const eventId = req.params.eventId;

  const event = await webhookService.replayEvent(developer.id, eventId);

  sendSuccess(res, 200, { event });
});
