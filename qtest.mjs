import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { getRetryDelayMs } from './apps/api/src/queues/webhook.queue.ts';
import { QUEUE_NAMES, RETRY_SCHEDULE_MS } from './packages/shared/src/constants/index.ts';

console.log('RETRY_SCHEDULE_MS:', RETRY_SCHEDULE_MS);
console.log('getRetryDelayMs(0)=', getRetryDelayMs(0));
console.log('getRetryDelayMs(1)=', getRetryDelayMs(1));
console.log('getRetryDelayMs(2)=', getRetryDelayMs(2));
console.log('getRetryDelayMs(3)=', getRetryDelayMs(3));
console.log('getRetryDelayMs(5)=', getRetryDelayMs(5));

const redis = new Redis('redis://localhost:6379', { maxRetriesPerRequest: null });
const q = new Queue(QUEUE_NAMES.delivery, { connection: redis });
const dlq = new Queue(QUEUE_NAMES.deadLetter, { connection: redis });
console.log('queues ok');
const j = await q.add('deliver', { eventId: 'x', targetUrl: 'http://x', httpMethod: 'POST', headers: {}, payload: {}, signingSecret: '', attemptNumber: 0, maxRetries: 3, developerId: 'y' }, { jobId: 'x-attempt-0' });
console.log('job id:', j.id);
const exists = await q.getJob('x-attempt-0');
console.log('exists:', exists?.id);
await q.remove('x-attempt-0');
await q.close();
await dlq.close();
redis.disconnect();
