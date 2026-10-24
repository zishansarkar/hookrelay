import { Router } from 'express';
import { authenticate, getAuthenticatedDeveloper } from '../middleware/authenticate.js';
import { sendSuccess } from '../http/response.js';
import { getDailyUsage, getUsage } from '../services/usage.service.js';

export const usageRoutes = Router();

usageRoutes.get('/', authenticate, async (req, res) => {
  const developer = getAuthenticatedDeveloper(req);
  const usage = await getUsage(developer.id);
  sendSuccess(res, 200, usage);
});

usageRoutes.get('/daily', authenticate, async (req, res) => {
  const developer = getAuthenticatedDeveloper(req);
  const dailyUsage = await getDailyUsage(developer.id);
  sendSuccess(res, 200, { dailyUsage });
});
