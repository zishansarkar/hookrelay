import jwt from 'jsonwebtoken';
import type { AuthResponse, Developer } from '@hookrelay/shared';
import { loadConfig } from '../config/environment.js';
import { HttpError } from '../errors/http-error.js';
import {
  Developer as DeveloperModel,
  hashPassword,
  verifyPassword,
  type DeveloperDocument,
} from '../models/Developer.js';
import type { LoginInput, RegisterInput } from '../validators/auth.validators.js';
import type { AuthenticatedDeveloper } from '../types/express.js';

/** How long an issued JWT stays valid. */
const TOKEN_TTL = '7d';

/** Status/message pair used for both "unknown email" and "wrong password". */
const INVALID_CREDENTIALS = 'Invalid email or password';

function getJwtSecret(): string {
  const { jwtSecret } = loadConfig();
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured — add it to your .env file');
  }
  return jwtSecret;
}

/**
 * Strips everything that must not leave the API (password hash, bookkeeping).
 */
function toPublicDeveloper(developer: DeveloperDocument): Developer {
  return {
    id: developer.id,
    email: developer.email,
    companyName: developer.companyName,
    plan: developer.plan,
    webhooksUsedThisMonth: developer.webhooksUsedThisMonth,
    createdAt: developer.createdAt,
  };
}

/**
 * Detects MongoDB's duplicate key error (unique index violation).
 */
function isDuplicateKeyError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return (error as { code?: unknown }).code === 11000;
}

/**
 * Signs a 7-day JWT for the developer.
 */
export function generateToken(developer: Pick<DeveloperDocument, 'id' | 'email' | 'plan'>): string {
  const payload: AuthenticatedDeveloper = {
    id: developer.id,
    email: developer.email,
    plan: developer.plan,
  };

  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_TTL });
}

/**
 * Creates a developer account and returns it with a fresh token.
 *
 * @throws {HttpError} 409 when the email is already registered.
 */
export async function register(data: RegisterInput): Promise<AuthResponse> {
  const email = data.email.toLowerCase();

  if (await DeveloperModel.exists({ email })) {
    throw new HttpError(409, 'An account with this email already exists', 'EMAIL_ALREADY_EXISTS');
  }

  const passwordHash = await hashPassword(data.password);

  try {
    const developer = await DeveloperModel.create({
      email,
      passwordHash,
      companyName: data.companyName ?? null,
    });

    return {
      developer: toPublicDeveloper(developer),
      token: generateToken(developer),
    };
  } catch (error) {
    // Two registrations can race past the existence check above; the unique
    // index is what actually guarantees uniqueness.
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, 'An account with this email already exists', 'EMAIL_ALREADY_EXISTS');
    }
    throw error;
  }
}

/**
 * Checks credentials and returns the developer with a fresh token.
 *
 * @throws {HttpError} 401 when the credentials are wrong.
 */
export async function login(data: LoginInput): Promise<AuthResponse> {
  const developer = await DeveloperModel.findOne({ email: data.email.toLowerCase() }).select(
    '+passwordHash',
  );

  if (!developer) {
    throw new HttpError(401, INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');
  }

  const passwordMatches = await verifyPassword(data.password, developer.passwordHash);
  if (!passwordMatches) {
    throw new HttpError(401, INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');
  }

  developer.lastLoginAt = new Date();
  await developer.save();

  return {
    developer: toPublicDeveloper(developer),
    token: generateToken(developer),
  };
}

/**
 * Loads the current developer from the database.
 *
 * @throws {HttpError} 401 when the account behind the token no longer exists.
 */
export async function getById(id: string): Promise<Developer> {
  const developer = await DeveloperModel.findOne({ id });

  if (!developer) {
    throw new HttpError(401, 'Account no longer exists', 'UNAUTHORIZED');
  }

  return toPublicDeveloper(developer);
}
