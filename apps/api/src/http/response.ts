import type { Response } from 'express';
import type { ApiSuccessResponse } from '@hookrelay/shared';

/**
 * Sends a successful response using the API's `{ success, data }` envelope.
 */
export function sendSuccess<T>(res: Response, status: number, data: T): void {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  res.status(status).json(body);
}
