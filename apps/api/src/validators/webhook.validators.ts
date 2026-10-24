import { z } from 'zod';
import { type Plan } from '@hookrelay/shared';
import { validateTargetUrl } from '../utils/ssrf-protection.js';

const HTTP_METHODS = ['POST', 'PUT', 'PATCH'] as const;

/**
 * Headers managed by HookRelay itself. Letting a caller set them would allow
 * request smuggling or signature spoofing on the outbound delivery.
 */
const DANGEROUS_HEADERS = new Set([
  'host',
  'content-length',
  'connection',
  'transfer-encoding',
  'keep-alive',
  'upgrade',
  'te',
  'trailer',
  'proxy-authorization',
]);

const RESERVED_HEADER_PREFIX = 'x-hookrelay-';

function isForbiddenHeaderName(name: string): boolean {
  const normalized = name.toLowerCase();
  return DANGEROUS_HEADERS.has(normalized) || normalized.startsWith(RESERVED_HEADER_PREFIX);
}

function containsLineBreak(value: string): boolean {
  return value.includes('\r') || value.includes('\n');
}

/** Plan-aware max retries: free up to 3, pro/team up to 5. */
function maxRetriesForPlan(plan: Plan): number {
  return plan === 'free' ? 3 : 5;
}

/**
 * Builds the webhook send schema with plan-aware constraints.
 *
 * `targetUrl` must be http(s); in production only https is allowed.
 * `headers` are capped at 20 entries with per-field length limits.
 */
export function createSendWebhookSchema(options: { nodeEnv: string; plan: Plan }) {
  const { nodeEnv, plan } = options;
  const isProduction = nodeEnv === 'production';
  const planMaxRetries = maxRetriesForPlan(plan);

  const targetUrlField = z
    .string()
    .trim()
    .max(2048, 'Target URL must be 2048 characters or fewer')
    .superRefine(async (value, ctx) => {
      const result = await validateTargetUrl(value, { isProduction });
      if (!result.valid) {
        ctx.addIssue({
          code: 'custom',
          message: result.reason ?? 'Target URL is not allowed',
        });
      }
    });

  const headersField = z
    .record(z.string(), z.string())
    .optional()
    .default({})
    .superRefine((headers, ctx) => {
      const entries = Object.entries(headers);

      if (entries.length > 20) {
        ctx.addIssue({
          code: 'custom',
          message: 'A maximum of 20 headers is allowed',
        });
        return;
      }

      for (const [name, value] of entries) {
        if (name.trim() === '') {
          ctx.addIssue({ code: 'custom', path: [name], message: 'Header name cannot be empty' });
          continue;
        }

        if (name.length > 100) {
          ctx.addIssue({
            code: 'custom',
            path: [name],
            message: 'Header name must be 100 characters or fewer',
          });
        }

        if (value.length > 1000) {
          ctx.addIssue({
            code: 'custom',
            path: [name],
            message: 'Header value must be 1000 characters or fewer',
          });
        }

        if (containsLineBreak(name) || containsLineBreak(value)) {
          ctx.addIssue({
            code: 'custom',
            path: [name],
            message: 'Header names and values cannot contain line breaks',
          });
          continue;
        }

        if (isForbiddenHeaderName(name)) {
          ctx.addIssue({
            code: 'custom',
            path: [name],
            message: `The "${name}" header is set automatically and cannot be overridden`,
          });
        }
      }
    });

  return z.object({
    targetUrl: targetUrlField,
    httpMethod: z.enum(HTTP_METHODS).default('POST'),
    headers: headersField,
    payload: z.unknown().refine((value) => value !== undefined, 'Payload is required'),
    signingSecret: z
      .string()
      .min(32, 'Signing secret must be at least 32 characters long')
      .optional(),
    maxRetries: z
      .number()
      .int('Max retries must be a whole number')
      .min(0, 'Max retries cannot be negative')
      .max(planMaxRetries, `Max retries cannot exceed ${planMaxRetries} for the ${plan} plan`)
      .optional(),
  });
}

/**
 * Default schema used outside the request cycle (e.g. tests). In production
 * it allows http and https; production enforcement is applied by the
 * per-request schema in the route/service layer.
 */
export const sendWebhookSchema = createSendWebhookSchema({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  plan: 'pro',
});

export type SendWebhookInput = z.infer<typeof sendWebhookSchema>;
export { maxRetriesForPlan };
