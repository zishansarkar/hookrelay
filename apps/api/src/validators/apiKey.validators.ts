import { z } from 'zod';

export const createKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Key name is required')
    .max(50, 'Key name must be 50 characters or fewer'),
});

export type CreateKeyInput = z.infer<typeof createKeySchema>;
