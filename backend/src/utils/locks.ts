import { randomUUID } from 'crypto';
import { initRedis, type DisherRedisClient } from '../config/redis';
import { logger } from '../config/logger';
import { createError } from './async-handler';
import { ErrorCode } from '@disherio/shared';

/**
 * Distributed mutex helpers backed by Redis (SET NX PX + compare-and-del).
 *
 * Used to serialize check-then-act critical sections that MongoDB
 * transactions alone cannot protect: two concurrent transactions can both
 * read the same pre-state (e.g. "2 admins remain") before either commits, so
 * mutual exclusion must come from outside the snapshot.
 */

const LOCK_TTL_MS = 10_000;
const LOCK_WAIT_MS = 5_000;
const LOCK_RETRY_DELAY_MS = 50;
const LOCK_RENEW_INTERVAL_MS = Math.floor(LOCK_TTL_MS / 3);

let client: DisherRedisClient | null = null;

/**
 * Lazily resolve the main Redis client, initializing it on first use
 * (initRedis returns the existing client when it is already connected).
 * Mirrors refresh-token.service: these locks guard integrity invariants, so
 * Redis being unavailable must fail closed rather than skip the lock.
 */
async function getRedis(): Promise<DisherRedisClient> {
  if (client?.isReady) return client;
  client = await initRedis();
  return client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Release the lock only if we still own it (the TTL may have expired). */
const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`;

const RENEW_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
else
  return 0
end
`;

/**
 * Run `fn` while holding the distributed lock `key`. Waiters retry until
 * LOCK_WAIT_MS elapses, then fail with 409 so the caller can retry the
 * request. The lock auto-expires after LOCK_TTL_MS to survive holder crashes.
 */
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const redis = await getRedis();
  const token = randomUUID();
  const deadline = Date.now() + LOCK_WAIT_MS;
  const lockKey = `lock:${key}`;

  let acquired = false;
  while (Date.now() <= deadline) {
    const result = await redis.set(lockKey, token, { NX: true, PX: LOCK_TTL_MS });
    if (result === 'OK') {
      acquired = true;
      break;
    }
    await sleep(LOCK_RETRY_DELAY_MS);
  }

  if (!acquired) {
    throw createError.conflict(ErrorCode.OPERATION_IN_PROGRESS);
  }

  let renewalInFlight: Promise<void> | null = null;
  let stopped = false;
  const renew = (): void => {
    if (stopped || renewalInFlight) return;
    renewalInFlight = redis.eval(RENEW_SCRIPT, {
      keys: [lockKey],
      arguments: [token, String(LOCK_TTL_MS)],
    }).then((renewed) => {
      if (Number(renewed) !== 1) {
        stopped = true;
        logger.error({ key }, 'Distributed lock ownership was lost during renewal');
      }
    }).catch((error) => {
      logger.warn({ error, key }, 'Failed to renew distributed lock lease');
    }).finally(() => {
      renewalInFlight = null;
    });
  };
  const renewalTimer = setInterval(renew, LOCK_RENEW_INTERVAL_MS);
  renewalTimer.unref();

  try {
    return await fn();
  } finally {
    stopped = true;
    clearInterval(renewalTimer);
    await renewalInFlight;
    try {
      await redis.eval(RELEASE_SCRIPT, { keys: [lockKey], arguments: [token] });
    } catch (error) {
      // The TTL guarantees eventual release; losing the explicit release is
      // only a latency cost for the next waiter.
      logger.warn({ error, key }, 'Failed to release lock explicitly; waiting for TTL');
    }
  }
}
