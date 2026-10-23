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

async function main(): Promise<void> {
  const config = loadConfig();

  console.info(`[db:check] connecting to ${config.databaseUrl.replace(/\/\/[^@]*@/, '//***@')}`);
  await connectDatabase();

  const developer = await Developer.create({
    email: `db-check-${Date.now()}@example.com`,
    passwordHash: await hashPassword('db-check-password'),
    companyName: 'HookRelay DB Check',
  });
  console.info(`[db:check] developer created  : ${developer.id} (${developer.email})`);
  console.info(`[db:check] password hashed    : ${developer.passwordHash.startsWith('$2')}`);

  const { rawKey, hashedKey } = ApiKey.generateKey();
  const apiKey = await ApiKey.create({
    developerId: developer.id,
    key: hashedKey,
    lastFour: rawKey.slice(-4),
    name: 'db-check',
  });
  console.info(`[db:check] api key created    : ${apiKey.id} (raw ${rawKey})`);

  const found = await ApiKey.findByRawKey(rawKey);
  console.info(`[db:check] raw key lookup     : ${found ? 'found' : 'NOT FOUND'}`);

  const collections = await Developer.db.collection('developers').find({}).toArray();
  console.info(`[db:check] developers in db    : ${collections.length}`);

  await ApiKey.deleteOne({ _id: apiKey._id });
  await Developer.deleteOne({ _id: developer._id });
  console.info('[db:check] cleanup done');

  await disconnectDatabase();
  console.info('[db:check] OK — database connection and models work');
}

main().catch((error: unknown) => {
  console.error('[db:check] FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
