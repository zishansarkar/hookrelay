import { Router } from 'express';
import { authenticate, getAuthenticatedDeveloper } from '../middleware/authenticate.js';
import { sendSuccess } from '../http/response.js';
import * as authService from '../services/auth.service.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/auth.validators.js';

/**
 * Authentication routes.
 *
 * Mounted at `/v1/auth`.
 */
export const authRoutes: Router = Router();

authRoutes.post('/register', validate(registerSchema), async (req, res) => {
  // Already validated by the middleware above; parsing again only narrows the
  // type of `req.body` (which Express types as `any`).
  const result = await authService.register(registerSchema.parse(req.body));

  sendSuccess(res, 201, result);
});

authRoutes.post('/login', validate(loginSchema), async (req, res) => {
  const result = await authService.login(loginSchema.parse(req.body));

  sendSuccess(res, 200, result);
});

authRoutes.get('/me', authenticate, async (req, res) => {
  const current = getAuthenticatedDeveloper(req);
  const developer = await authService.getById(current.id);

  sendSuccess(res, 200, { developer });
});
