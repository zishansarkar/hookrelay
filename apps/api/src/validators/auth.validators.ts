import { z } from 'zod';

/**
 * Email address, trimmed and lowercased *before* the format check runs.
 *
 * `z.email().trim()` would validate the raw value first, so a padded
 * `" Dev@Example.COM "` would be rejected instead of normalized.
 */
const emailField = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

/**
 * Password policy: at least 8 characters with an uppercase letter, a
 * lowercase letter and a digit.
 */
const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a digit');

export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  companyName: z
    .string()
    .trim()
    .max(100, 'Company name must be 100 characters or fewer')
    .optional(),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
