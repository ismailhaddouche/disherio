import { ErrorCode } from '@disherio/shared';
import { logger } from '../config/logger';
import { getRedisClient, initRedis, type DisherRedisClient } from '../config/redis';

// Re-export ErrorCode for convenience
export { ErrorCode };

// Configuration constants
const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOCK_DURATION_MS = 60 * 60 * 1000; // 60 minutes (max)
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window for counting attempts
const REDIS_KEY_PREFIX = 'pin_attempt:';

export interface FailedAttempt {
  count: number;
  firstAttempt: Date;
  lockedUntil?: Date;
  lastAttempt: Date;
}

// In-memory fallback only used when Redis is unavailable (development/tests)
const inMemoryFallback = new Map<string, FailedAttempt>();

let redis: DisherRedisClient | null = null;

async function getRedis(): Promise<DisherRedisClient | null> {
  if (redis?.isReady) return redis;

  try {
    redis = getRedisClient();
    if (redis?.isReady) return redis;
    // If not ready, try initializing
    redis = await initRedis();
    return redis;
  } catch (err) {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      logger.error({ err }, 'Redis unavailable for PIN security in production; rejecting login');
      throw new Error(ErrorCode.SERVER_CONFIGURATION_ERROR);
    }
    logger.warn({ err }, 'Redis unavailable for PIN security; using in-memory fallback (development only)');
    return null;
  }
}

function getKey(identifier: string): string {
  return `${REDIS_KEY_PREFIX}${identifier}`;
}

function calculateBackoffLockDuration(attemptCount: number): number {
  const excessAttempts = Math.max(0, attemptCount - MAX_FAILED_ATTEMPTS);
  const multiplier = Math.min(
    Math.pow(2, Math.floor(excessAttempts / MAX_FAILED_ATTEMPTS)),
    MAX_LOCK_DURATION_MS / BASE_LOCK_DURATION_MS
  );
  return BASE_LOCK_DURATION_MS * multiplier;
}

interface StoredAttempt {
  count: number;
  firstAttempt: string;
  lastAttempt: string;
  lockedUntil?: string;
}

function serialize(attempt: FailedAttempt): StoredAttempt {
  return {
    count: attempt.count,
    firstAttempt: attempt.firstAttempt.toISOString(),
    lastAttempt: attempt.lastAttempt.toISOString(),
    lockedUntil: attempt.lockedUntil?.toISOString(),
  };
}

function deserialize(stored: StoredAttempt): FailedAttempt {
  return {
    count: stored.count,
    firstAttempt: new Date(stored.firstAttempt),
    lastAttempt: new Date(stored.lastAttempt),
    lockedUntil: stored.lockedUntil ? new Date(stored.lockedUntil) : undefined,
  };
}

async function load(identifier: string): Promise<FailedAttempt | undefined> {
  const redisClient = await getRedis();
  if (redisClient) {
    try {
      const raw = await redisClient.get(getKey(identifier));
      if (raw) {
        return deserialize(JSON.parse(raw) as StoredAttempt);
      }
    } catch (err) {
      logger.warn({ err, identifier }, 'Failed to load PIN attempt from Redis; using fallback');
    }
  }
  return inMemoryFallback.get(identifier);
}

async function save(identifier: string, attempt: FailedAttempt): Promise<void> {
  const redisClient = await getRedis();
  if (redisClient) {
    try {
      // TTL = attempt window so old entries self-expire
      await redisClient.setEx(
        getKey(identifier),
        Math.ceil(ATTEMPT_WINDOW_MS / 1000),
        JSON.stringify(serialize(attempt))
      );
      return;
    } catch (err) {
      logger.warn({ err, identifier }, 'Failed to save PIN attempt to Redis; using fallback');
    }
  }
  inMemoryFallback.set(identifier, attempt);
}

async function remove(identifier: string): Promise<void> {
  const redisClient = await getRedis();
  if (redisClient) {
    try {
      await redisClient.del(getKey(identifier));
    } catch (err) {
      logger.warn({ err, identifier }, 'Failed to delete PIN attempt from Redis');
    }
  }
  inMemoryFallback.delete(identifier);
}

/**
 * Creates a unique identifier for rate limiting
 * Combines username and/or IP for comprehensive tracking
 */
export function createIdentifier(username: string, ipAddress?: string): string {
  if (ipAddress) {
    return `${username}:${ipAddress}`;
  }
  return username;
}

/**
 * Records a failed PIN attempt for the given identifier
 * Implements exponential backoff for lock duration
 */
export async function recordFailedAttempt(identifier: string): Promise<FailedAttempt> {
  const now = new Date();
  const existing = await load(identifier);

  if (!existing) {
    const attempt: FailedAttempt = {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    };
    await save(identifier, attempt);
    return attempt;
  }

  // Reset counter if outside the attempt window (1 hour)
  if (now.getTime() - existing.firstAttempt.getTime() > ATTEMPT_WINDOW_MS) {
    const attempt: FailedAttempt = {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    };
    await save(identifier, attempt);
    return attempt;
  }

  existing.count += 1;
  existing.lastAttempt = now;

  // Apply lock if threshold reached
  if (existing.count >= MAX_FAILED_ATTEMPTS) {
    const lockDuration = calculateBackoffLockDuration(existing.count);
    existing.lockedUntil = new Date(now.getTime() + lockDuration);
  }

  await save(identifier, existing);
  return existing;
}

/**
 * Checks if the identifier is currently locked
 */
export async function isLocked(identifier: string): Promise<boolean> {
  const attempt = await load(identifier);

  if (!attempt || !attempt.lockedUntil) {
    return false;
  }

  const now = new Date();

  // Check if lock has expired
  if (now.getTime() >= attempt.lockedUntil.getTime()) {
    attempt.lockedUntil = undefined;
    await save(identifier, attempt);
    return false;
  }

  return true;
}

/**
 * Gets the remaining lock time in seconds
 * Returns 0 if not locked
 */
export async function getRemainingLockTime(identifier: string): Promise<number> {
  const attempt = await load(identifier);

  if (!attempt || !attempt.lockedUntil) {
    return 0;
  }

  const now = new Date();
  const remaining = attempt.lockedUntil.getTime() - now.getTime();

  return Math.max(0, Math.ceil(remaining / 1000));
}

/**
 * Clears all failed attempts for the identifier
 * Call this after a successful login
 */
export async function clearAttempts(identifier: string): Promise<void> {
  await remove(identifier);
}

/**
 * Gets the current attempt count for the identifier
 */
export async function getAttemptCount(identifier: string): Promise<number> {
  const attempt = await load(identifier);

  if (!attempt) {
    return 0;
  }

  const now = new Date();
  if (now.getTime() - attempt.firstAttempt.getTime() > ATTEMPT_WINDOW_MS) {
    return 0;
  }

  return attempt.count;
}

/**
 * Gets the remaining attempts before lock
 */
export async function getRemainingAttempts(identifier: string): Promise<number> {
  const count = await getAttemptCount(identifier);
  return Math.max(0, MAX_FAILED_ATTEMPTS - count);
}

/**
 * Validates if login is allowed and returns appropriate error if not
 * This is a helper function for common validation pattern
 */
export async function validatePinAttempt(
  identifier: string
): Promise<{ allowed: true } | { allowed: false; error: string; retryAfter: number }> {
  if (await isLocked(identifier)) {
    const remainingTime = await getRemainingLockTime(identifier);
    return {
      allowed: false,
      error: ErrorCode.AUTH_RATE_LIMIT_EXCEEDED,
      retryAfter: remainingTime,
    };
  }

  return { allowed: true };
}

/**
 * Cleanup function to remove old entries (should be called periodically)
 * Removes entries older than the attempt window. Redis TTL handles this automatically,
 * but this can be used to clean the in-memory fallback.
 */
export function cleanupOldAttempts(): number {
  const now = new Date();
  let removed = 0;

  inMemoryFallback.forEach((attempt, identifier) => {
    if (now.getTime() - attempt.lastAttempt.getTime() > ATTEMPT_WINDOW_MS) {
      inMemoryFallback.delete(identifier);
      removed++;
    }
  });

  return removed;
}

export function resetRedisAvailability(): void {
  redis = null;
}

/**
 * Clear in-memory fallback store (tests/debugging).
 */
export function clearInMemoryFallback(): void {
  inMemoryFallback.clear();
}

// Start periodic cleanup every 10 minutes for the in-memory fallback only
if (typeof global !== 'undefined' && !process.env.DISABLE_PIN_CLEANUP) {
  const cleanupInterval = setInterval(cleanupOldAttempts, 10 * 60 * 1000);
  cleanupInterval.unref();
}
