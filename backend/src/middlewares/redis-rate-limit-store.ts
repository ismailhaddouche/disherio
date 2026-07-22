import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import { initRedis } from '../config/redis';

const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if count == 1 or ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`;

/** Distributed express-rate-limit store. Redis errors propagate so the
 * middleware fails closed instead of silently creating per-process limits. */
export class RedisRateLimitStore implements Store {
  readonly localKeys = false;
  private windowMs = 60_000;

  constructor(private readonly keyPrefix: string) {}

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const client = await initRedis();
    const result = await client.eval(INCREMENT_SCRIPT, {
      keys: [`http-rate-limit:${this.keyPrefix}:${key}`],
      arguments: [String(this.windowMs)],
    });
    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error('Invalid Redis HTTP rate-limit response');
    }
    const totalHits = Number(result[0]);
    const ttl = Number(result[1]);
    if (!Number.isSafeInteger(totalHits) || totalHits < 1 || !Number.isFinite(ttl) || ttl < 0) {
      throw new Error('Invalid Redis HTTP rate-limit counter');
    }
    return { totalHits, resetTime: new Date(Date.now() + ttl) };
  }

  async decrement(key: string): Promise<void> {
    const redisKey = `http-rate-limit:${this.keyPrefix}:${key}`;
    const client = await initRedis();
    await client.eval(
      "local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n > 0 then redis.call('DECR',KEYS[1]) end; return 1",
      { keys: [redisKey], arguments: [] },
    );
  }

  async resetKey(key: string): Promise<void> {
    const client = await initRedis();
    await client.del(`http-rate-limit:${this.keyPrefix}:${key}`);
  }
}
