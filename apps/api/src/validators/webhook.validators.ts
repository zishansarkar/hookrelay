import { z } from 'zod';
import { MAX_RETRIES } from '@hookrelay/shared';

const HTTP_METHODS = ['POST', 'PUT', 'PATCH'] as const;

/**
 * Headers managed by HookRelay itself. Letting a caller set them would allow
 * request smuggling or signature spoofing on the outbound delivery.
 */
const RESERVED_HEADERS = new Set([
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
  return RESERVED_HEADERS.has(normalized) || normalized.startsWith(RESERVED_HEADER_PREFIX);
}

/** Rejects header names or values containing CR/LF (header injection). */
function containsLineBreak(value: string): boolean {
  return value.includes('\r') || value.includes('\n');
}

const targetUrlField = z
  .string()
  .trim()
  .pipe(z.url('Target URL must be a valid absolute URL'))
  .refine((value) => {
    // Zod runs later refinements even when the URL check above failed, so a
    // malformed value must not throw here — that would turn a 400 into a 500.
    try {
      const { protocol } = new URL(value);
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return true;
    }
  }, 'Target URL must use http or https');

const headersField = z
  .record(z.string(), z.string())
  .default({})
  .superRefine((headers, ctx) => {
    for (const [name, value] of Object.entries(headers)) {
      if (name.trim() === '') {
        ctx.addIssue({ code: 'custom', path: [name], message: 'Header name cannot be empty' });
        continue;
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
          message: `The "${name}" header is managed by HookRelay and cannot be overridden`,
        });
      }
    }
  });

/**
 * Payload accepted by `POST /v1/webhooks/send`.
 *
 * `payload` must be present, but any JSON value (object, array, string,
 * number, boolean) is allowed.
 */
export const sendWebhookSchema = z.object({
  targetUrl: targetUrlField,
  httpMethod: z.enum(HTTP_METHODS).default('POST'),
  headers: headersField,
  payload: z.unknown().refine((value) => value !== undefined, 'Payload is required'),
  signingSecret: z
    .string()
    .min(16, 'Signing secret must be at least 16 characters long')
    .max(256, 'Signing secret must be 256 characters or fewer')
    .optional(),
  maxRetries: z
    .number()
    .int('Max retries must be a whole number')
    .min(0, 'Max retries cannot be negative')
    .max(MAX_RETRIES, `Max retries cannot exceed ${MAX_RETRIES}`)
    .optional(),
});

export type SendWebhookInput = z.infer<typeof sendWebhookSchema>;
