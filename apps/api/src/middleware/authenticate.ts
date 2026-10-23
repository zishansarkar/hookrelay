import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { ApiErrorResponse, Plan } from '@hookrelay/shared';
import { loadConfig } from '../config/environment.js';
import type { AuthenticatedDeveloper } from '../types/express.js';

const BEARER_PREFIX = 'Bearer ';
const PLANS: readonly Plan[] = ['free', 'pro', 'team'];

/**
 * Resolves the JWT signing secret, failing loudly when it is not configured.
 */
function getJwtSecret(): string {
  const { jwtSecret } = loadConfig();
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured — add it to your .env file');
  }
  return jwtSecret;
}

/**
 * Narrows a decoded JWT to the payload this API issues.
 */
function isAuthenticatedDeveloper(value: unknown): value is AuthenticatedDeveloper {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { id?: unknown; email?: unknown; plan?: unknown };

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.plan === 'string' &&
    (PLANS as readonly string[]).includes(candidate.plan)
  );
}

function sendUnauthorized(res: Response, message: string): void {
  const body: ApiErrorResponse = {
    error: message,
    code: 'UNAUTHORIZED',
  };

  res.status(401).json(body);
}

/**
 * Requires a valid `Authorization: Bearer <jwt>` header.
 *
 * On success the decoded payload is attached to `req.developer`.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith(BEARER_PREFIX)) {
    sendUnauthorized(res, 'Authentication required');
    return;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    sendUnauthorized(res, 'Authentication required');
    return;
  }

  let secret: string;
  try {
    secret = getJwtSecret();
  } catch (error) {
    next(error);
    return;
  }

  try {
    const decoded = jwt.verify(token, secret);
    if (!isAuthenticatedDeveloper(decoded)) {
      sendUnauthorized(res, 'Invalid or expired token');
      return;
    }

    req.developer = {
      id: decoded.id,
      email: decoded.email,
      plan: decoded.plan,
    };
    next();
  } catch {
    sendUnauthorized(res, 'Invalid or expired token');
  }
}

/**
 * Returns the authenticated developer, narrowing away the optional marker.
 *
 * Only call this from handlers behind `authenticate`.
 */
export function getAuthenticatedDeveloper(req: Request): AuthenticatedDeveloper {
  if (!req.developer) {
    throw new Error('getAuthenticatedDeveloper() called on an unauthenticated request');
  }
  return req.developer;
}
