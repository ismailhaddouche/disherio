jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn(() => { throw new Error('not initialized'); }),
  initRedis: jest.fn(async () => { throw new Error('unavailable'); }),
}));

import { logger } from '../config/logger';
import { checkRateLimit } from '../sockets/middleware/rate-limiter';

const warnMock = logger.warn as jest.Mock;

describe('Socket rate limiter without Redis', () => {
  beforeEach(() => {
    warnMock.mockClear();
  });

  it('still enforces limits via in-memory counters and logs the degraded mode', async () => {
    const identity = 'staff:fallback-enforce';
    // kds:join is a JOIN_LEAVE event: 10 requests per minute
    for (let i = 0; i < 10; i++) {
      expect((await checkRateLimit(identity, 'kds:join')).allowed).toBe(true);
    }

    expect((await checkRateLimit(identity, 'kds:join')).allowed).toBe(false);
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'kds:join' }),
      expect.stringContaining('in-memory')
    );
  });

  it('throttles the degraded-mode warning instead of logging once per event', async () => {
    await checkRateLimit('staff:fallback-throttle', 'kds:join');
    await checkRateLimit('staff:fallback-throttle', 'kds:join');
    await checkRateLimit('staff:fallback-throttle', 'kds:join');

    // The first check above may emit at most one warning within the
    // throttle window shared with the previous test.
    expect(warnMock.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
