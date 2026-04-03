export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number;    // Número de fallos antes de abrir
  resetTimeout: number;        // Tiempo antes de intentar half-open (ms)
  halfOpenMaxCalls: number;    // Máximo calls en half-open
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  lastFailureTime?: number;
  halfOpenCalls: number;
}

export class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime?: number;
  private halfOpenCalls = 0;
  private readonly name: string;

  constructor(
    private readonly operation: (...args: any[]) => Promise<any>,
    private readonly options: CircuitBreakerOptions = {
      failureThreshold: 5,
      resetTimeout: 30000,
      halfOpenMaxCalls: 3
    },
    name?: string
  ) {
    this.name = name || 'CircuitBreaker';
  }

  async execute<T>(...args: any[]): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - (this.lastFailureTime || 0) > this.options.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenCalls = 0;
      } else {
        throw new Error('CIRCUIT_BREAKER_OPEN');
      }
    }

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenCalls >= this.options.halfOpenMaxCalls) {
        throw new Error('CIRCUIT_BREAKER_HALF_OPEN_LIMIT');
      }
      this.halfOpenCalls++;
    }

    try {
      const result = await this.operation(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.halfOpenCalls = 0;
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      halfOpenCalls: this.halfOpenCalls,
    };
  }

  getName(): string {
    return this.name;
  }

  /**
   * Force the circuit breaker to CLOSED state
   * Useful for manual recovery after issues are resolved
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = undefined;
    this.halfOpenCalls = 0;
  }
}
