/**
 * Verifies the MongoDB connection and the Mongoose models against a real
 * database. Run it with `npm run db:check`.
 *
 * It creates a throwaway developer and API key, prints what it stored and
 * removes the documents again.
 */
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { loadConfig } from '../config/environment.js';
import { ApiKey, Developer, hashPassword } from '../models/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('db-check');

async function main(): Promise<void> {
  const config = loadConfig();

  logger.info(
    { databaseUrl: config.databaseUrl.replace(/\/\/[^@]*@/, '//***@') },
    'Connecting to MongoDB',
  );
  await connectDatabase();

  const developer = await Developer.create({
    email: `db-check-${Date.now()}@example.com`,
    passwordHash: await hashPassword('db-check-password'),
    companyName: 'HookRelay DB Check',
  });
  logger.info({ developerId: developer.id, email: developer.email }, 'Test developer created');
  logger.info(
    { passwordHashed: developer.passwordHash.startsWith('$2') },
    'Password hash verified',
  );

  const { rawKey, hashedKey } = ApiKey.generateKey();
  const apiKey = await ApiKey.create({
    developerId: developer.id,
    key: hashedKey,
    lastFour: rawKey.slice(-4),
    name: 'db-check',
  });
  logger.info({ apiKeyId: apiKey.id, keyLastFour: rawKey.slice(-4) }, 'Test API key created');

  const found = await ApiKey.findByRawKey(rawKey);
  logger.info({ keyFound: Boolean(found) }, 'API key lookup completed');

  const collections = await Developer.db.collection('developers').find({}).toArray();
  logger.info({ developerCount: collections.length }, 'Developer collection inspected');

  await ApiKey.deleteOne({ _id: apiKey._id });
  await Developer.deleteOne({ _id: developer._id });
  logger.info('Database check cleanup completed');

  await disconnectDatabase();
  logger.info('Database connection and models verified');
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Database check failed');
  process.exitCode = 1;
});
