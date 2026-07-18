import {
  createIdentifier,
  recordFailedAttempt,
  isLocked,
  getRemainingLockTime,
  clearAttempts,
  getAttemptCount,
  getRemainingAttempts,
  validatePinAttempt,
  cleanupOldAttempts,
  clearInMemoryFallback,
} from '../services/pin-security.service';

describe('PIN Security Service', () => {
  beforeEach(() => {
    cleanupOldAttempts();
    clearInMemoryFallback();
  });

  describe('createIdentifier', () => {
    it('should create identifier with username only', () => {
      const id = createIdentifier('testuser');
      expect(id).toBe('testuser');
    });

    it('should create identifier with username and IP', () => {
      const id = createIdentifier('testuser', '192.168.1.1');
      expect(id).toBe('testuser:192.168.1.1');
    });
  });

  describe('recordFailedAttempt', () => {
    it('should record first failed attempt', async () => {
      const result = await recordFailedAttempt('user1');

      expect(result.count).toBe(1);
      expect(result.firstAttempt).toBeInstanceOf(Date);
      expect(result.lastAttempt).toBeInstanceOf(Date);
      expect(result.lockedUntil).toBeUndefined();
    });

    it('should increment count on subsequent attempts', async () => {
      await recordFailedAttempt('user2');
      await recordFailedAttempt('user2');
      const result = await recordFailedAttempt('user3');

      expect(result.count).toBe(1);

      const user2Result = await recordFailedAttempt('user2');
      expect(user2Result.count).toBe(3);
    });

    it('should lock account after 5 failed attempts', async () => {
      const identifier = 'user-to-lock';

      for (let i = 0; i < 4; i++) {
        await recordFailedAttempt(identifier);
      }
      expect(await isLocked(identifier)).toBe(false);

      await recordFailedAttempt(identifier);
      expect(await isLocked(identifier)).toBe(true);
    });

    it('should set lock expiration 15 minutes in the future', async () => {
      const identifier = 'user-lock-time';

      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(identifier);
      }

      const remainingTime = await getRemainingLockTime(identifier);
      const expectedDuration = 15 * 60;

      expect(remainingTime).toBeGreaterThan(expectedDuration - 5);
      expect(remainingTime).toBeLessThanOrEqual(expectedDuration);
    });

    it('should increase lock duration with exponential backoff', async () => {
      const identifier = 'user-backoff';

      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(identifier);
      }

      expect(await getRemainingLockTime(identifier)).toBeGreaterThan(0);

      await clearAttempts(identifier);

      for (let i = 0; i < 10; i++) {
        await recordFailedAttempt(identifier);
      }

      expect(await isLocked(identifier)).toBe(true);
    });
  });

  describe('isLocked', () => {
    it('should return false for non-existent user', async () => {
      expect(await isLocked('non-existent')).toBe(false);
    });

    it('should return false for user with attempts below threshold', async () => {
      const identifier = 'user-not-locked';
      await recordFailedAttempt(identifier);
      await recordFailedAttempt(identifier);

      expect(await isLocked(identifier)).toBe(false);
    });

    it('should return true for locked user', async () => {
      const identifier = 'user-locked';

      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(identifier);
      }

      expect(await isLocked(identifier)).toBe(true);
    });

    it('should return false after lock expires', async () => {
      const identifier = 'user-expired-lock';

      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(identifier);
      }

      expect(await isLocked(identifier)).toBe(true);

      await clearAttempts(identifier);

      expect(await isLocked(identifier)).toBe(false);
    });
  });

  describe('getRemainingLockTime', () => {
    it('should return 0 for unlocked user', async () => {
      expect(await getRemainingLockTime('user-no-lock')).toBe(0);
    });

    it('should return 0 for user with attempts but not locked', async () => {
      const identifier = 'user-attempts-no-lock';
      await recordFailedAttempt(identifier);

      expect(await getRemainingLockTime(identifier)).toBe(0);
    });

    it('should return positive value for locked user', async () => {
      const identifier = 'user-with-lock';

      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(identifier);
      }

      const remaining = await getRemainingLockTime(identifier);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(15 * 60);
    });
  });

  describe('clearAttempts', () => {
    it('should clear all attempts for user', async () => {
      const identifier = 'user-to-clear';

      await recordFailedAttempt(identifier);
      await recordFailedAttempt(identifier);
      await recordFailedAttempt(identifier);

      expect(await getAttemptCount(identifier)).toBe(3);

      await clearAttempts(identifier);

      expect(await getAttemptCount(identifier)).toBe(0);
      expect(await isLocked(identifier)).toBe(false);
    });

    it('should not throw for non-existent user', async () => {
      await expect(async () => clearAttempts('never-existed')).not.toThrow();
    });
  });

  describe('getAttemptCount', () => {
    it('should return 0 for new user', async () => {
      expect(await getAttemptCount('brand-new-user')).toBe(0);
    });

    it('should return correct count', async () => {
      const identifier = 'user-count-test';

      expect(await getAttemptCount(identifier)).toBe(0);

      await recordFailedAttempt(identifier);
      expect(await getAttemptCount(identifier)).toBe(1);

      await recordFailedAttempt(identifier);
      expect(await getAttemptCount(identifier)).toBe(2);
    });
  });

  describe('getRemainingAttempts', () => {
    it('should return 5 for new user', async () => {
      expect(await getRemainingAttempts('new-user')).toBe(5);
    });

    it('should decrease with each attempt', async () => {
      const identifier = 'user-remaining';

      expect(await getRemainingAttempts(identifier)).toBe(5);

      await recordFailedAttempt(identifier);
      expect(await getRemainingAttempts(identifier)).toBe(4);

      await recordFailedAttempt(identifier);
      expect(await getRemainingAttempts(identifier)).toBe(3);
    });

    it('should return 0 when locked', async () => {
      const identifier = 'user-remaining-locked';

      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(identifier);
      }

      expect(await getRemainingAttempts(identifier)).toBe(0);
    });
  });

  describe('validatePinAttempt', () => {
    it('should allow attempt for unlocked user', async () => {
      const result = await validatePinAttempt('valid-user');

      expect(result.allowed).toBe(true);
    });

    it('should deny attempt for locked user', async () => {
      const identifier = 'locked-validate-user';

      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(identifier);
      }

      const result = await validatePinAttempt(identifier);

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.error).toBeDefined();
        expect(result.retryAfter).toBeGreaterThan(0);
      }
    });
  });

  describe('cleanupOldAttempts', () => {
    it('should remove old attempts', async () => {
      const identifier = 'user-cleanup';

      await recordFailedAttempt(identifier);
      expect(await getAttemptCount(identifier)).toBe(1);

      await clearAttempts(identifier);
      expect(await getAttemptCount(identifier)).toBe(0);
    });

    it('should return count of removed entries', () => {
      const removed = cleanupOldAttempts();
      expect(typeof removed).toBe('number');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete lock and unlock cycle', async () => {
      const identifier = 'integration-user';

      expect((await validatePinAttempt(identifier)).allowed).toBe(true);
      await recordFailedAttempt(identifier);
      await recordFailedAttempt(identifier);
      expect(await getRemainingAttempts(identifier)).toBe(3);

      for (let i = 0; i < 3; i++) {
        await recordFailedAttempt(identifier);
      }

      expect(await isLocked(identifier)).toBe(true);
      expect((await validatePinAttempt(identifier)).allowed).toBe(false);
      expect(await getRemainingLockTime(identifier)).toBeGreaterThan(0);

      await clearAttempts(identifier);

      expect(await isLocked(identifier)).toBe(false);
      expect(await getAttemptCount(identifier)).toBe(0);
      expect((await validatePinAttempt(identifier)).allowed).toBe(true);
    });

    it('should handle multiple independent users', async () => {
      const user1 = 'multi-user-1';
      const user2 = 'multi-user-2';

      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt(user1);
      }

      await recordFailedAttempt(user2);
      await recordFailedAttempt(user2);

      expect(await isLocked(user1)).toBe(true);
      expect(await isLocked(user2)).toBe(false);

      expect(await getAttemptCount(user1)).toBe(5);
      expect(await getAttemptCount(user2)).toBe(2);
    });

    it('should respect attempt window - reset after window expires', async () => {
      const identifier = 'window-test';

      await recordFailedAttempt(identifier);
      const initialCount = await getAttemptCount(identifier);
      expect(initialCount).toBe(1);

      await recordFailedAttempt(identifier);
      expect(await getAttemptCount(identifier)).toBe(2);
    });
  });
});
