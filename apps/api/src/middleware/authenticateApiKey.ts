import type { NextFunction, Request, Response } from 'express';
import type { ApiErrorResponse } from '@hookrelay/shared';
import { PLAN_LIMITS } from '@hookrelay/shared';
import * as apiKeyService from '../services/apiKey.service.js';

const API_KEY_HEADER = 'x-api-key';

function sendUnauthorized(res: Response, message: string): void {
  const body: ApiErrorResponse = {
    error: message,
    code: 'INVALID_API_KEY',
  };

  res.status(401).json(body);
}

function sendQuotaExceeded(res: Response, message: string): void {
  const body: ApiErrorResponse = {
    error: message,
    code: 'QUOTA_EXCEEDED',
  };

  res.status(403).json(body);
}

/**
 * API key authentication middleware used by the webhook ingestion endpoint.
 *
 * This is a separate auth path from JWT `authenticate`: it reads the key from
 * the `x-api-key` header, while `authenticate` reads a JWT from
 * `Authorization: Bearer`. On success both attach the same `req.developer`
 * shape so handlers do not care how the request was authenticated.
 *
 * Responds 401 for a missing/invalid/inactive key and 403 when the
 * developer's monthly webhook quota is exhausted.
 */
export async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const headerValue = req.headers[API_KEY_HEADER];

  if (typeof headerValue !== 'string' || headerValue.trim() === '') {
    sendUnauthorized(res, 'API key required');
    return;
  }

  const result = await apiKeyService.getByRawKey(headerValue.trim());

  if (!result) {
    sendUnauthorized(res, 'Invalid API key');
    return;
  }

  const { developer } = result;
  const { monthlyWebhooks } = PLAN_LIMITS[developer.plan];

  if (developer.webhooksUsedThisMonth >= monthlyWebhooks) {
    sendQuotaExceeded(
      res,
      `Monthly webhook quota exceeded (${monthlyWebhooks} on the ${developer.plan} plan)`,
    );
    return;
  }

  req.developer = {
    id: developer.id,
    email: developer.email,
    plan: developer.plan,
  };

  next();
}
