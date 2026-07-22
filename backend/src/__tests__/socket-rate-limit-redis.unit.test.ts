const redisEval = jest.fn();

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn(() => ({ eval: redisEval })),
  initRedis: jest.fn(),
}));

import { checkRateLimit } from '../sockets/middleware/rate-limiter';

describe('Redis socket rate limiting', () => {
  beforeEach(() => jest.clearAllMocks());

  it('increments the counter and assigns its expiry atomically', async () => {
    redisEval.mockResolvedValue(1);

    await expect(checkRateLimit('staff:1', 'tas:add_item', 2, 60_000))
      .resolves.toEqual({ allowed: true, remaining: 1 });
    expect(redisEval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('PEXPIRE'"),
      {
        keys: ['ratelimit:staff:1:tas:add_item'],
        arguments: ['60000'],
      }
    );
  });

  it('denies requests after the atomic counter exceeds the limit', async () => {
    redisEval.mockResolvedValue(3);

    await expect(checkRateLimit('staff:1', 'tas:add_item', 2, 60_000))
      .resolves.toEqual({ allowed: false, remaining: 0 });
  });
});
