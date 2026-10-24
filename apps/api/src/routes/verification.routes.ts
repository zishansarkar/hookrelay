import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../http/response.js';
import { authenticate, getAuthenticatedDeveloper } from '../middleware/authenticate.js';
import { verificationGuide } from '../utils/verification-guide.js';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER } from '@hookrelay/shared';

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

const verificationTestSchema = z.object({
  signingSecret: z.string().min(1).max(1024),
  headers: z.record(z.string(), z.string()),
  body: z.unknown().refine((value) => value !== undefined, 'body is required'),
});

export const verificationRoutes = Router();

verificationRoutes.get('/v1/docs/verification', (_req, res) => {
  sendSuccess(res, 200, verificationGuide);
});

verificationRoutes.post('/v1/webhooks/test', authenticate, (req, res) => {
  getAuthenticatedDeveloper(req);
  const parsed = verificationTestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.map(String).join('.') || 'body',
        message: issue.message,
      })),
    });
    return;
  }

  const headers = new Map(
    Object.entries(parsed.data.headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
  const signatureHeader = headers.get(SIGNATURE_HEADER);
  const separateTimestamp = headers.get(TIMESTAMP_HEADER);
  const match = signatureHeader?.match(/^t=(\d+),v1=([a-f0-9]{64})$/i);
  if (!match) {
    sendSuccess(res, 200, { valid: false, reason: 'Signature header format is invalid' });
    return;
  }

  const timestampText = match[1];
  const suppliedSignature = match[2];
  if (!timestampText || !suppliedSignature) {
    sendSuccess(res, 200, { valid: false, reason: 'Signature header format is invalid' });
    return;
  }

  const timestamp = Number(timestampText);
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(Math.floor(Date.now() / 1000) - timestamp) > TIMESTAMP_TOLERANCE_SECONDS
  ) {
    sendSuccess(res, 200, {
      valid: false,
      reason: 'Signature timestamp is outside the 5-minute window',
    });
    return;
  }
  if (separateTimestamp !== undefined && separateTimestamp !== timestampText) {
    sendSuccess(res, 200, { valid: false, reason: 'Timestamp headers do not match' });
    return;
  }

  const serializedBody = JSON.stringify(parsed.data.body);
  if (serializedBody === undefined) {
    sendSuccess(res, 200, { valid: false, reason: 'Body is not JSON serializable' });
    return;
  }
  const expected = createHmac('sha256', parsed.data.signingSecret)
    .update(`${timestampText}.${serializedBody}`)
    .digest();
  const supplied = Buffer.from(suppliedSignature, 'hex');
  const valid = supplied.length === expected.length && timingSafeEqual(supplied, expected);
  sendSuccess(res, 200, {
    valid,
    ...(valid ? {} : { reason: 'Signature does not match the supplied body and secret' }),
  });
});
