import type { Plan } from '@hookrelay/shared';

/**
 * Payload carried by an authenticated request.
 *
 * This is exactly what is embedded in the JWT, so it deliberately stays small
 * — anything else is loaded from the database when it is needed.
 */
export interface AuthenticatedDeveloper {
  id: string;
  email: string;
  plan: Plan;
}

declare global {
  namespace Express {
    interface Request {
      /**
       * Set by the JWT `authenticate` middleware or by the API key
       * `authenticateApiKey` middleware; absent on public routes.
       */
      developer?: AuthenticatedDeveloper;
    }
  }
}
