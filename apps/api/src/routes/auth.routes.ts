import { Router } from 'express';

/**
 * Authentication routes (signup, login, session).
 *
 * Mounted at `/v1/auth`. The handlers are added in the auth milestone.
 */
export const authRoutes: Router = Router();
