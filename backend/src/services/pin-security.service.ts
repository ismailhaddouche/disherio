import { ErrorCode } from '@disherio/shared';

// Re-export ErrorCode for convenience
export { ErrorCode };

// Configuration constants
const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOCK_DURATION_MS = 60 * 60 * 1000; // 60 minutes (max)
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window for counting attempts

export interface FailedAttempt {
  count: number;
  firstAttempt: Date;
  lockedUntil?: Date;
  lastAttempt: Date;
}

// In-memory storage for failed attempts (per process)
// For production with multiple instances, consider using Redis
const failedAttempts = new Map<string, FailedAttempt>();

/**
 * Creates a unique identifier for rate limiting
 * Combines username and/or IP for comprehensive tracking
 */
export function createIdentifier(username: string, ipAddress?: string): string {
  // Primary key is username, with IP as secondary for additional tracking
  if (ipAddress) {
    return `${username}:${ipAddress}`;
  }
  return username;
}

/**
 * Records a failed PIN attempt for the given identifier
 * Implements exponential backoff for lock duration
 */
export function recordFailedAttempt(identifier: string): FailedAttempt {
  const now = new Date();
  const existing = failedAttempts.get(identifier);

  if (!existing) {
    const attempt: FailedAttempt = {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    };
    failedAttempts.set(identifier, attempt);
    return attempt;
  }

  // Reset counter if outside the attempt window (1 hour)
  if (now.getTime() - existing.firstAttempt.getTime() > ATTEMPT_WINDOW_MS) {
    const attempt: FailedAttempt = {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    };
    failedAttempts.set(identifier, attempt);
    return attempt;
  }

  existing.count += 1;
  existing.lastAttempt = now;

  // Apply lock if threshold reached
  if (existing.count >= MAX_FAILED_ATTEMPTS) {
    // Calculate lock duration with exponential backoff
    // Each additional group of 5 attempts doubles the lock time
    const excessAttempts = existing.count - MAX_FAILED_ATTEMPTS;
    const multiplier = Math.min(
      Math.pow(2, Math.floor(excessAttempts / MAX_FAILED_ATTEMPTS)),
      MAX_LOCK_DURATION_MS / BASE_LOCK_DURATION_MS
    );
    
    const lockDuration = BASE_LOCK_DURATION_MS * multiplier;
    existing.lockedUntil = new Date(now.getTime() + lockDuration);
  }

  failedAttempts.set(identifier, existing);
  return existing;
}

/**
 * Checks if the identifier is currently locked
 */
export function isLocked(identifier: string): boolean {
  const attempt = failedAttempts.get(identifier);
  
  if (!attempt || !attempt.lockedUntil) {
    return false;
  }

  const now = new Date();
  
  // Check if lock has expired
  if (now.getTime() >= attempt.lockedUntil.getTime()) {
    // Lock expired, clear it but keep the attempt count
    attempt.lockedUntil = undefined;
    failedAttempts.set(identifier, attempt);
    return false;
  }

  return true;
}

/**
 * Gets the remaining lock time in seconds
 * Returns 0 if not locked
 */
export function getRemainingLockTime(identifier: string): number {
  const attempt = failedAttempts.get(identifier);
  
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
export function clearAttempts(identifier: string): void {
  failedAttempts.delete(identifier);
}

/**
 * Gets the current attempt count for the identifier
 */
export function getAttemptCount(identifier: string): number {
  const attempt = failedAttempts.get(identifier);
  
  if (!attempt) {
    return 0;
  }

  // Check if window has expired
  const now = new Date();
  if (now.getTime() - attempt.firstAttempt.getTime() > ATTEMPT_WINDOW_MS) {
    return 0;
  }

  return attempt.count;
}

/**
 * Gets the remaining attempts before lock
 */
export function getRemainingAttempts(identifier: string): number {
  const count = getAttemptCount(identifier);
  return Math.max(0, MAX_FAILED_ATTEMPTS - count);
}

/**
 * Validates if login is allowed and returns appropriate error if not
 * This is a helper function for common validation pattern
 */
export function validatePinAttempt(
  identifier: string
): { allowed: true } | { allowed: false; error: string; retryAfter: number } {
  if (isLocked(identifier)) {
    const remainingTime = getRemainingLockTime(identifier);
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
 * Removes entries older than the attempt window
 */
export function cleanupOldAttempts(): number {
  const now = new Date();
  let removed = 0;

  failedAttempts.forEach((attempt, identifier) => {
    if (now.getTime() - attempt.lastAttempt.getTime() > ATTEMPT_WINDOW_MS) {
      failedAttempts.delete(identifier);
      removed++;
    }
  });

  return removed;
}

// Start periodic cleanup every 10 minutes
if (typeof global !== 'undefined' && !process.env.DISABLE_PIN_CLEANUP) {
  setInterval(cleanupOldAttempts, 10 * 60 * 1000);
}
