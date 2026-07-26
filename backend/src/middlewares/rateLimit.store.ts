/**
 * Shared Redis store for express-rate-limit.
 *
 * Counts hits in the Redis instance shared by every node, so limits are
 * enforced cluster-wide instead of per process (the default MemoryStore
 * would multiply the effective limit by the number of nodes). Redis is a
 * required dependency (see /health/ready), so the store is fail-closed like
 * refresh-token.service: when Redis is unavailable `increment` rejects and
 * express-rate-limit forwards the error to the error handler instead of
 * letting the request through uncounted.
 */

import type { IncrementResponse, Options, Store } from 'express-rate-limit';
import { logger } from '../config/logger';
import { getRedisClient, initRedis, type DisherRedisClient } from '../config/redis';

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

// INCR and PEXPIRE are issued in one script: as separate commands a crash
// between them would leave a counter without TTL that never resets.
const INCREMENT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`;

const DECREMENT_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current > 0 then
  redis.call('DECR', KEYS[1])
end
`;

let redis: DisherRedisClient | null = null;

/**
 * Lazily resolve the main Redis client, mirroring refresh-token.service.
 * Throws when Redis is unavailable: rate limiting must fail closed.
 */
async function getRedis(): Promise<DisherRedisClient> {
  if (redis?.isReady) return redis;
  try {
    redis = getRedisClient();
    if (redis?.isReady) return redis;
  } catch {
    // client not initialized yet — fall through to initRedis
  }
  redis = await initRedis();
  return redis;
}

/**
 * Create a Redis-backed store for a single limiter. express-rate-limit
 * rejects store instances shared between limiters, and each limiter needs
 * its own key prefix so independent limiters keep independent buckets even
 * when their keyGenerator produces the same key for a request (e.g. the
 * global API limiter and the auth limiter both seeing a login request).
 */
export function createRedisRateLimitStore(name: string): Store {
  const prefix = `rl:${name}:`;
  let windowMs = DEFAULT_WINDOW_MS;

  return {
    prefix,

    init: (options: Options) => {
      windowMs = options.windowMs;
    },

    async increment(key: string): Promise<IncrementResponse> {
      const client = await getRedis();
      try {
        const [totalHits, ttlMs] = (await client.eval(INCREMENT_SCRIPT, {
          keys: [prefix + key],
          arguments: [String(windowMs)],
        })) as [number, number];
        return {
          totalHits: Number(totalHits),
          resetTime: ttlMs > 0 ? new Date(Date.now() + ttlMs) : undefined,
        };
      } catch (err) {
        logger.warn({ err, limiter: name }, 'Redis rate-limit increment failed; failing closed');
        throw err;
      }
    },

    // decrement/resetKey must not reject: express-rate-limit invokes
    // decrement from response lifecycle handlers where a rejection would
    // surface as an unhandled promise rejection. A stray hit expires with
    // its window, so logging is enough.
    async decrement(key: string): Promise<void> {
      try {
        const client = await getRedis();
        await client.eval(DECREMENT_SCRIPT, { keys: [prefix + key], arguments: [] });
      } catch (err) {
        logger.warn({ err, limiter: name }, 'Redis rate-limit decrement failed; hit left to expire');
      }
    },

    async resetKey(key: string): Promise<void> {
      try {
        const client = await getRedis();
        await client.del(prefix + key);
      } catch (err) {
        logger.warn({ err, limiter: name }, 'Redis rate-limit resetKey failed');
      }
    },
  };
}
