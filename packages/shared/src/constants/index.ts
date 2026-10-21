import type { Developer } from '../types/api.js';

/**
 * Canonical retry schedule used by the delivery worker (MVP engine example):
 *   10 seconds → 1 minute → 5 minutes → dead-letter.
 */
export const RETRY_SCHEDULE_MS = [10_000, 60_000, 300_000] as const;

/** Maximum number of retries after the initial delivery attempt. */
export const MAX_RETRIES = 3;

/**
 * Quotas and features per subscription plan.
 *
 * `teamMembers: -1` means unlimited.
 */
export const PLAN_LIMITS: Record<
  Developer['plan'],
  {
    monthlyWebhooks: number;
    logRetentionDays: number;
    emailAlerts: boolean;
    customRetry: boolean;
    teamMembers: number;
  }
> = {
  free: {
    monthlyWebhooks: 10_000,
    logRetentionDays: 7,
    emailAlerts: false,
    customRetry: false,
    teamMembers: 1,
  },
  pro: {
    monthlyWebhooks: 250_000,
    logRetentionDays: 30,
    emailAlerts: true,
    customRetry: false,
    teamMembers: 5,
  },
  team: {
    monthlyWebhooks: 1_000_000,
    logRetentionDays: 90,
    emailAlerts: true,
    customRetry: true,
    teamMembers: -1,
  },
};

/** Header carrying the HMAC-SHA256 signature of the delivered payload. */
export const SIGNATURE_HEADER = 'x-hookrelay-signature-256';

/** Header carrying the unix timestamp (seconds) the payload was signed at. */
export const TIMESTAMP_HEADER = 'x-hookrelay-timestamp';

/** Maximum accepted request payload size. */
export const MAX_PAYLOAD_SIZE_BYTES = 256 * 1024;

/** API versioning prefix. */
export const API_PREFIX = '/v1' as const;

/** Target p99 latency for the ingestion endpoint, in milliseconds. */
export const INGESTION_TARGET_LATENCY_MS = 50;

/** BullMQ queue identifiers. */
export const QUEUE_NAMES = {
  delivery: 'webhook-delivery',
  deadLetter: 'webhook-dead-letter',
} as const;
