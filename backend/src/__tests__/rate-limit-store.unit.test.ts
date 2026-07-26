const counters = new Map<string, { count: number; expiresAt: number }>();

const redis = {
  isReady: true,
  eval: jest.fn(),
  del: jest.fn(),
};

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn(() => redis),
  initRedis: jest.fn(async () => redis),
}));

import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';
import { getRedisClient, initRedis } from '../config/redis';
import { createRedisRateLimitStore } from '../middlewares/rateLimit.store';

const getRedisClientMock = getRedisClient as jest.Mock;
const initRedisMock = initRedis as jest.Mock;

// Simulates the two Lua scripts issued by the store against the shared client.
function fakeEval(script: string, options: { keys: string[]; arguments: string[] }) {
  const key = options.keys[0];
  if (script.includes('INCR')) {
    const windowMs = Number(options.arguments[0]);
    const now = Date.now();
    let entry = counters.get(key);
    if (!entry || entry.expiresAt <= now) {
      entry = { count: 0, expiresAt: now + windowMs };
      counters.set(key, entry);
    }
    entry.count += 1;
    return Promise.resolve([entry.count, entry.expiresAt - now]);
  }
  if (script.includes('DECR')) {
    const entry = counters.get(key);
    if (entry && entry.count > 0) entry.count -= 1;
    return Promise.resolve(null);
  }
  return Promise.resolve(null);
}

function buildApp() {
  const app = express();
  app.use(rateLimit({
    windowMs: 60_000,
    max: 2,
    standardHeaders: false,
    legacyHeaders: false,
    store: createRedisRateLimitStore('test'),
  }));
  app.get('/', (_req, res) => res.status(200).send('ok'));
  // Mirror production behaviour: a store error becomes a 500 (fail-closed).
  app.use(((_err: unknown, _req: unknown, res: express.Response, _next: unknown) => {
    res.status(500).send('error');
  }) as express.ErrorRequestHandler);
  return app;
}

describe('Redis rate-limit store', () => {
  beforeEach(() => {
    counters.clear();
    jest.clearAllMocks();
    redis.isReady = true;
    getRedisClientMock.mockImplementation(() => redis);
    initRedisMock.mockImplementation(async () => redis);
    redis.eval.mockImplementation(fakeEval);
    redis.del.mockImplementation(async (key: string) => (counters.delete(key) ? 1 : 0));
  });

  it('increments the shared counter and reports a reset time', async () => {
    const store = createRedisRateLimitStore('unit');

    const first = await store.increment('key-1');
    const second = await store.increment('key-1');

    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(second.resetTime).toBeInstanceOf(Date);
    expect(second.resetTime!.getTime()).toBeGreaterThan(Date.now());
    expect(counters.has('rl:unit:key-1')).toBe(true);
  });

  it('limits requests across instances backed by the same Redis', async () => {
    // Two independent limiter instances (two "nodes") share the counter
    // because both stores talk to the same Redis keys.
    const firstNode = buildApp();
    const secondNode = buildApp();

    await request(firstNode).get('/').expect(200);
    await request(secondNode).get('/').expect(200);
    await request(firstNode).get('/').expect(429);
    await request(secondNode).get('/').expect(429);
  });

  it('keeps independent buckets per limiter prefix', async () => {
    const storeA = createRedisRateLimitStore('a');
    const storeB = createRedisRateLimitStore('b');

    await storeA.increment('same-key');
    await storeA.increment('same-key');
    const bFirst = await storeB.increment('same-key');

    expect(bFirst.totalHits).toBe(1);
  });

  it('fails closed with a 500 when Redis is unavailable', async () => {
    redis.isReady = false;
    getRedisClientMock.mockImplementation(() => {
      throw new Error('Redis not initialized. Call initRedis() first.');
    });
    initRedisMock.mockRejectedValue(new Error('redis down'));

    await request(buildApp()).get('/').expect(500);
  });

  it('does not propagate decrement failures (express-rate-limit calls it from response handlers)', async () => {
    redis.eval.mockRejectedValueOnce(new Error('boom'));
    const store = createRedisRateLimitStore('decr');

    await expect(store.decrement('key-1')).resolves.toBeUndefined();
  });
});
