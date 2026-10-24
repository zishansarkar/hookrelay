import Stripe from 'stripe';
import { loadConfig } from './environment.js';

const config = loadConfig();

export const stripe: Stripe | null = config.stripeSecretKey
  ? new Stripe(config.stripeSecretKey)
  : null;

export const PRICE_IDS = {
  pro: config.stripeProPriceId ?? '',
  team: config.stripeTeamPriceId ?? '',
} as const;
