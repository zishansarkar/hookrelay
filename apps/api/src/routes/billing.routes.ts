import { Router } from 'express';
import type Stripe from 'stripe';
import { z } from 'zod';
import { loadConfig } from '../config/environment.js';
import { stripe } from '../config/stripe.js';
import { sendSuccess } from '../http/response.js';
import { authenticate, getAuthenticatedDeveloper } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../errors/http-error.js';
import * as billingService from '../services/billing.service.js';
import { createLogger } from '../utils/logger.js';

const checkoutSchema = z.object({
  plan: z.enum(['pro', 'team']),
});
const logger = createLogger('billing-routes');

export const billingRoutes = Router();
billingRoutes.use(authenticate);

billingRoutes.post('/checkout', validate(checkoutSchema), async (req, res) => {
  const developer = getAuthenticatedDeveloper(req);
  const { plan } = checkoutSchema.parse(req.body);
  const url = await billingService.createCheckoutSession(developer.id, plan);
  sendSuccess(res, 200, { url });
});

billingRoutes.post('/portal', async (req, res) => {
  const developer = getAuthenticatedDeveloper(req);
  const url = await billingService.createBillingPortalSession(developer.id);
  sendSuccess(res, 200, { url });
});

export const billingWebhookRoutes = Router();
billingWebhookRoutes.post('/webhook', async (req, res) => {
  const secret = loadConfig().stripeWebhookSecret;
  const signature = req.headers['stripe-signature'];
  if (!secret || !stripe) {
    res.status(503).json({ error: 'Billing is not configured', code: 'BILLING_UNAVAILABLE' });
    return;
  }
  if (!Buffer.isBuffer(req.body) || typeof signature !== 'string') {
    res.status(400).json({ error: 'Invalid Stripe webhook request', code: 'INVALID_WEBHOOK' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, secret);
  } catch (error) {
    logger.warn({ err: error }, 'Stripe webhook signature verification failed');
    res.status(400).json({ error: 'Invalid Stripe webhook signature', code: 'INVALID_SIGNATURE' });
    return;
  }

  try {
    await billingService.handleWebhookEvent(event);
    res.status(200).json({ received: true });
  } catch (error) {
    if (error instanceof HttpError && error.status < 500) {
      res.status(error.status).json({ error: error.message, code: error.code });
      return;
    }
    logger.error(
      { err: error, stripeEventId: event.id, stripeEventType: event.type },
      'Failed to process Stripe event',
    );
    res
      .status(500)
      .json({ error: 'Stripe event processing failed', code: 'WEBHOOK_PROCESSING_FAILED' });
  }
});
