import { Router } from 'express';
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

eventRoutes.get('/stats', async (req, res) => {
  const developer = getAuthenticatedDeveloper(req);
  const result = await webhookService.getEventStats(developer.id);
  sendSuccess(res, 200, result);
});

eventRoutes.get('/', async (req, res) => {
  const developer = getAuthenticatedDeveloper(req);
  const { page, limit, status, targetUrl, startDate, endDate } = req.query;

  const parsedPage = typeof page === 'string' ? Number.parseInt(page, 10) : undefined;
  const parsedLimit = typeof limit === 'string' ? Number.parseInt(limit, 10) : undefined;
  const parsedStatus =
    typeof status === 'string' &&
    status !== DeliveryStatus.QUEUED &&
    status !== DeliveryStatus.DELIVERING &&
    Object.values(DeliveryStatus).includes(status as DeliveryStatus)
      ? (status as DeliveryStatus)
      : undefined;
  const parsedTargetUrl = typeof targetUrl === 'string' ? targetUrl : undefined;
  const parsedStartDate =
    typeof startDate === 'string' && !Number.isNaN(Date.parse(startDate))
      ? new Date(startDate)
      : undefined;
  const parsedEndDate =
    typeof endDate === 'string' && !Number.isNaN(Date.parse(endDate))
      ? new Date(endDate)
      : undefined;

  const result = await webhookService.listEvents(developer.id, {
    page: parsedPage,
    limit: parsedLimit,
    status: parsedStatus,
    targetUrl: parsedTargetUrl,
    startDate: parsedStartDate,
    endDate: parsedEndDate,
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
