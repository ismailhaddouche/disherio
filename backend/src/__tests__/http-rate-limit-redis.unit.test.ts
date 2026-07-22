import type { Options } from 'express-rate-limit';

const redis = {
  eval: jest.fn(),
  del: jest.fn(),
};

jest.mock('../config/redis', () => ({
  initRedis: async () => redis,
}));

import { RedisRateLimitStore } from '../middlewares/redis-rate-limit-store';

describe('Redis HTTP rate-limit store', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses a namespaced Redis counter and returns its reset time', async () => {
    redis.eval.mockResolvedValue([3, 5_000]);
    const store = new RedisRateLimitStore('auth');
    store.init({ windowMs: 15_000 } as Options);

    const before = Date.now();
    const result = await store.increment('client');

    expect(result.totalHits).toBe(3);
    expect(result.resetTime!.getTime()).toBeGreaterThanOrEqual(before + 5_000);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      { keys: ['http-rate-limit:auth:client'], arguments: ['15000'] },
    );
  });

  it('fails closed on an invalid Redis response', async () => {
    redis.eval.mockResolvedValue(null);
    const store = new RedisRateLimitStore('api');

    await expect(store.increment('client')).rejects.toThrow('Invalid Redis HTTP rate-limit response');
  });
});
