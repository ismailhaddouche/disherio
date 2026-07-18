import { ErrorCode } from '@disherio/shared';
import { CircuitBreaker, CircuitState } from '../utils/circuit-breaker';

describe('CircuitBreaker', () => {
  it('does not count domain errors as infrastructure failures', async () => {
    const breaker = new CircuitBreaker(
      async () => { throw new Error(ErrorCode.TOTEM_NOT_FOUND); },
      { failureThreshold: 2, resetTimeout: 30_000, halfOpenMaxCalls: 1 }
    );

    await expect(breaker.execute()).rejects.toThrow(ErrorCode.TOTEM_NOT_FOUND);
    await expect(breaker.execute()).rejects.toThrow(ErrorCode.TOTEM_NOT_FOUND);

    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getMetrics().failures).toBe(0);
  });

  it('opens for repeated infrastructure failures and returns a 503 error code', async () => {
    const breaker = new CircuitBreaker(
      async () => { throw new Error('ECONNRESET'); },
      { failureThreshold: 2, resetTimeout: 30_000, halfOpenMaxCalls: 1 }
    );

    await expect(breaker.execute()).rejects.toThrow('ECONNRESET');
    await expect(breaker.execute()).rejects.toThrow('ECONNRESET');
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    await expect(breaker.execute()).rejects.toThrow(ErrorCode.SERVICE_UNAVAILABLE);
  });

  it('counts explicit database errors as infrastructure failures', async () => {
    const breaker = new CircuitBreaker(
      async () => { throw new Error(ErrorCode.DATABASE_ERROR); },
      { failureThreshold: 1, resetTimeout: 30_000, halfOpenMaxCalls: 1 }
    );

    await expect(breaker.execute()).rejects.toThrow(ErrorCode.DATABASE_ERROR);
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('closes a half-open circuit when a domain response proves the dependency is reachable', async () => {
    // The OPEN -> HALF_OPEN transition requires the clock to strictly pass
    // resetTimeout (Date.now() - lastFailureTime > resetTimeout). Fake timers
    // make that advance deterministic; a real 1 ms sleep races with the
    // millisecond resolution of Date.now() and flakes.
    jest.useFakeTimers();
    try {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error(ErrorCode.TOTEM_NOT_FOUND));
      const breaker = new CircuitBreaker(operation, {
        failureThreshold: 1,
        resetTimeout: 0,
        halfOpenMaxCalls: 1,
      });

      await expect(breaker.execute()).rejects.toThrow('ECONNRESET');
      jest.advanceTimersByTime(1);
      await expect(breaker.execute()).rejects.toThrow(ErrorCode.TOTEM_NOT_FOUND);

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getMetrics().failures).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
