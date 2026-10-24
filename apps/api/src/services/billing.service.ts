import type Stripe from 'stripe';
import type { Plan } from '@hookrelay/shared';
import { Developer } from '../models/index.js';
import { PRICE_IDS, stripe } from '../config/stripe.js';
import { loadConfig } from '../config/environment.js';
import { HttpError } from '../errors/http-error.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('billing');

type PaidPlan = 'pro' | 'team';
type SubscriptionStatus = 'active' | 'past_due' | 'cancelled';

function requireStripe(): Stripe {
  if (!stripe) {
    throw new HttpError(503, 'Billing is not configured', 'BILLING_UNAVAILABLE');
  }
  return stripe;
}

function getPriceId(plan: PaidPlan): string {
  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    throw new HttpError(503, `The ${plan} plan is not configured`, 'BILLING_UNAVAILABLE');
  }
  return priceId;
}

function stripeObjectId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === 'string' ? value : (value?.id ?? null);
}

function planForPrice(priceId: string): PaidPlan {
  if (priceId === PRICE_IDS.pro && PRICE_IDS.pro) return 'pro';
  if (priceId === PRICE_IDS.team && PRICE_IDS.team) return 'team';
  throw new Error(`Stripe subscription has an unconfigured price: ${priceId}`);
}

function statusForStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus | null {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due' || status === 'unpaid') return 'past_due';
  if (status === 'canceled') return 'cancelled';
  return null;
}

async function getOrCreateCustomer(developerId: string): Promise<{
  id: string;
  email: string;
}> {
  const stripeClient = requireStripe();
  const developer = await Developer.findOne({ id: developerId });
  if (!developer) {
    throw new HttpError(404, 'Developer not found', 'NOT_FOUND');
  }

  if (developer.stripeCustomerId) {
    return { id: developer.stripeCustomerId, email: developer.email };
  }

  const customer = await stripeClient.customers.create(
    {
      email: developer.email,
      name: developer.companyName ?? undefined,
      metadata: { developerId: developer.id },
    },
    { idempotencyKey: `hookrelay-customer-${developer.id}` },
  );
  await Developer.updateOne(
    {
      id: developer.id,
      $or: [{ stripeCustomerId: { $exists: false } }, { stripeCustomerId: null }],
    },
    { $set: { stripeCustomerId: customer.id } },
  );
  const savedDeveloper = await Developer.findOne({ id: developer.id });
  if (!savedDeveloper?.stripeCustomerId) {
    throw new Error(`Failed to persist Stripe customer for developer ${developer.id}`);
  }

  return { id: savedDeveloper.stripeCustomerId, email: savedDeveloper.email };
}

export async function createCheckoutSession(developerId: string, plan: PaidPlan): Promise<string> {
  const stripeClient = requireStripe();
  const customer = await getOrCreateCustomer(developerId);
  const config = loadConfig();
  const priceId = getPriceId(plan);
  const frontendUrl = config.frontendUrl.replace(/\/+$/, '');
  const session = await stripeClient.checkout.sessions.create({
    mode: 'subscription',
    customer: customer.id,
    client_reference_id: developerId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { developerId, plan },
    subscription_data: {
      metadata: { developerId, plan },
    },
    success_url: `${frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/billing/cancel`,
  });
  if (!session.url) {
    throw new Error('Stripe returned a checkout session without a URL');
  }
  return session.url;
}

export async function createBillingPortalSession(developerId: string): Promise<string> {
  const stripeClient = requireStripe();
  const developer = await Developer.findOne({ id: developerId });
  if (!developer) {
    throw new HttpError(404, 'Developer not found', 'NOT_FOUND');
  }
  if (!developer.stripeCustomerId) {
    throw new HttpError(409, 'No billing account exists for this developer', 'BILLING_NOT_FOUND');
  }

  const session = await stripeClient.billingPortal.sessions.create({
    customer: developer.stripeCustomerId,
    return_url: `${loadConfig().frontendUrl.replace(/\/+$/, '')}/usage`,
  });
  return session.url;
}

async function syncSubscription(
  subscription: Stripe.Subscription,
  explicitDeveloperId?: string,
): Promise<void> {
  const customerId = stripeObjectId(subscription.customer);
  if (!customerId) {
    throw new Error(`Stripe subscription ${subscription.id} has no customer`);
  }

  const developerId = explicitDeveloperId ?? subscription.metadata.developerId;
  const developer = await Developer.findOne({
    $or: [
      { stripeSubscriptionId: subscription.id },
      { stripeCustomerId: customerId },
      ...(developerId
        ? [
            {
              id: developerId,
              $or: [
                { stripeCustomerId: customerId },
                { stripeCustomerId: { $exists: false } },
                { stripeCustomerId: null },
              ],
            },
          ]
        : []),
    ],
  });
  if (!developer) {
    throw new Error(`No HookRelay developer is linked to Stripe customer ${customerId}`);
  }
  if (developer.stripeCustomerId && developer.stripeCustomerId !== customerId) {
    throw new Error(`Stripe customer does not match developer ${developer.id}`);
  }

  const subscriptionStatus = statusForStripeStatus(subscription.status);
  if (!subscriptionStatus) {
    return;
  }

  const update: {
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    subscriptionStatus: SubscriptionStatus;
    plan?: Plan;
  } = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus,
  };

  if (subscriptionStatus === 'cancelled') {
    update.plan = 'free';
  } else {
    const firstItem = subscription.items.data[0];
    if (!firstItem) {
      throw new Error(`Stripe subscription ${subscription.id} has no price item`);
    }
    update.plan = planForPrice(firstItem.price.id);
  }

  await Developer.updateOne({ id: developer.id }, { $set: update });
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const reference = invoice.parent?.subscription_details?.subscription;
  return stripeObjectId(reference);
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  const stripeClient = requireStripe();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const developerId = session.metadata?.developerId ?? session.client_reference_id;
      const customerId = stripeObjectId(session.customer);
      const subscriptionId = stripeObjectId(session.subscription);
      if (!developerId || !customerId || !subscriptionId) {
        throw new Error(`Checkout session ${session.id} is missing its billing references`);
      }

      const developer = await Developer.findOne({ id: developerId });
      if (!developer || (developer.stripeCustomerId && developer.stripeCustomerId !== customerId)) {
        throw new Error(`Checkout session ${session.id} does not match a HookRelay developer`);
      }
      const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
      await syncSubscription(subscription, developerId);
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const current = await stripeClient.subscriptions.retrieve(subscription.id);
      await syncSubscription(current);
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(subscription);
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) {
        logger.warn({ invoiceId: invoice.id }, 'Stripe invoice has no subscription reference');
        break;
      }
      const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
      if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
        await syncSubscription(subscription);
      }
      break;
    }
    default:
      break;
  }
}
