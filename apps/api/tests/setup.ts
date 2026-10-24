import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-jwt-secret';
process.env.HMAC_DEFAULT_SECRET ??= 'test-hmac-secret-with-more-than-32-characters';
process.env.STRIPE_SECRET_KEY ??= 'sk_test_hookrelay_test_key';
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_hookrelay_test_secret';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.FRONTEND_URL ??= 'http://localhost:5173';

// Queue modules are mocked by the suites that import them, so tests do not
// open Redis connections or require an external Redis service.
let mongoServer: MongoMemoryServer | undefined;

beforeAll(async () => {
  if (process.env.CI === 'true' && process.env.DATABASE_URL) {
    await mongoose.connect(process.env.DATABASE_URL);
  } else {
    mongoServer = await MongoMemoryServer.create();
    process.env.DATABASE_URL = mongoServer.getUri('hookrelay-test');
    await mongoose.connect(process.env.DATABASE_URL);
  }
});

afterEach(async () => {
  if (mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});
