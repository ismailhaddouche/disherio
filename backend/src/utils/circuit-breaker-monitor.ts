import { CircuitBreaker, CircuitBreakerMetrics } from './circuit-breaker';

/**
 * Monitor global para circuit breakers.
 * Permite registrar, monitorear y gestionar el estado de todos los circuit breakers.
 */
class CircuitBreakerMonitor {
  private breakers: Map<string, CircuitBreaker> = new Map();

  register(breaker: CircuitBreaker): void {
    this.breakers.set(breaker.getName(), breaker);
  }

  unregister(name: string): boolean {
    return this.breakers.delete(name);
  }

  getMetrics(name: string): CircuitBreakerMetrics | undefined {
    const breaker = this.breakers.get(name);
    return breaker?.getMetrics();
  }

  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    for (const [name, breaker] of Array.from(this.breakers.entries())) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }

  resetBreaker(name: string): boolean {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
      return true;
    }
    return false;
  }

  resetAll(): void {
    this.breakers.forEach((breaker) => breaker.reset());
  }

  getBreakerNames(): string[] {
    return Array.from(this.breakers.keys());
  }

  /**
   * Verifica si hay circuit breakers en estado OPEN
   * Útil para health checks
   */
  hasOpenCircuits(): boolean {
    for (const breaker of Array.from(this.breakers.values())) {
      if (breaker.getState() === 'OPEN') {
        return true;
      }
    }
    return false;
  }

  /**
   * Obtiene todos los circuit breakers que están en estado OPEN
   */
  getOpenCircuits(): string[] {
    const openCircuits: string[] = [];
    for (const [name, breaker] of Array.from(this.breakers.entries())) {
      if (breaker.getState() === 'OPEN') {
        openCircuits.push(name);
      }
    }
    return openCircuits;
  }
}

export const circuitBreakerMonitor = new CircuitBreakerMonitor();
