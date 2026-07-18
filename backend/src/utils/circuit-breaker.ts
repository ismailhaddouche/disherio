import { ErrorCode, isErrorCode } from '@disherio/shared';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxCalls: number;
  shouldCountFailure?: (error: unknown) => boolean;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  lastFailureTime?: number;
  halfOpenCalls: number;
}

const INFRASTRUCTURE_ERROR_CODES = new Set<ErrorCode>([
  ErrorCode.SERVICE_UNAVAILABLE,
  ErrorCode.SERVER_CONFIGURATION_ERROR,
  ErrorCode.SERVER_ERROR,
  ErrorCode.DATABASE_ERROR,
  ErrorCode.UPDATE_FAILED,
]);

function shouldCountInfrastructureFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  if (isErrorCode(error.message)) return INFRASTRUCTURE_ERROR_CODES.has(error.message);
  const operationalError = error as Error & { isOperational?: boolean; statusCode?: number };
  if (operationalError.isOperational === true) {
    return (operationalError.statusCode ?? 500) >= 500;
  }
  return true;
}

export class CircuitBreaker<TArgs extends unknown[], TResult> {
  private state = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime?: number;
  private halfOpenCalls = 0;
  private readonly name: string;

  constructor(
    private readonly operation: (...args: TArgs) => Promise<TResult>,
    private readonly options: CircuitBreakerOptions = {
      failureThreshold: 5,
      resetTimeout: 30000,
      halfOpenMaxCalls: 3
    },
    name?: string
  ) {
    this.name = name || 'CircuitBreaker';
  }

  async execute(...args: TArgs): Promise<TResult> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - (this.lastFailureTime || 0) > this.options.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenCalls = 0;
      } else {
        throw new Error(ErrorCode.SERVICE_UNAVAILABLE);
      }
    }

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenCalls >= this.options.halfOpenMaxCalls) {
        throw new Error(ErrorCode.SERVICE_UNAVAILABLE);
      }
      this.halfOpenCalls++;
    }

    try {
      const result = await this.operation(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      const shouldCount = this.options.shouldCountFailure ?? shouldCountInfrastructureFailure;
      if (shouldCount(error)) {
        this.onFailure();
      } else if (this.state === CircuitState.HALF_OPEN) {
        this.onSuccess();
      }
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

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = undefined;
    this.halfOpenCalls = 0;
  }
}
