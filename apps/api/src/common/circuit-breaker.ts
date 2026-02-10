import { Logger } from '@nestjs/common';

export type CircuitBreakerStatus = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Num. failures to open the circuit (default: 5)
  successThreshold: number; // Num. successes to close the circuit (default: 3)
  timeoutMs: number; // Time in ms before trying again (HALF_OPEN) (default: 60000)
}

export class CircuitBreaker {
  private status: CircuitBreakerStatus = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private nextAttempt = 0; // Timestamp when we can try again
  private readonly logger = new Logger(CircuitBreaker.name);

  constructor(
    private readonly config: CircuitBreakerConfig = {
      failureThreshold: 5,
      successThreshold: 3,
      timeoutMs: 60000,
    },
  ) {}

  public getStatus(): CircuitBreakerStatus {
    // Check if we should transition from OPEN to HALF_OPEN based on timeout
    if (this.status === 'OPEN' && Date.now() >= this.nextAttempt) {
      this.transitionTo('HALF_OPEN');
    }
    return this.status;
  }

  /**
   * Wrapper to execute a function protected by the circuit breaker.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getStatus();

    if (currentState === 'OPEN') {
      const waitSeconds = Math.ceil((this.nextAttempt - Date.now()) / 1000);
      throw new Error(
        `CircuitBreaker is OPEN based to failures. Retrying in ${waitSeconds}s.`,
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess() {
    if (this.status === 'HALF_OPEN') {
      this.successes++;
      this.logger.log(
        `CircuitBreaker request SUCCESS (${this.successes}/${this.config.successThreshold})`,
      );
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo('CLOSED');
      }
    } else if (this.status === 'CLOSED') {
      // Reset failures on success if closed (sliding window or simple reset could be implemented here)
      // For simplicity, we reset failures if we had some accumulated but didn't trip
      if (this.failures > 0) {
        this.failures = 0;
      }
    }
  }

  private onFailure(error: any) {
    if (this.status === 'CLOSED') {
      this.failures++;
      this.logger.warn(
        `CircuitBreaker failure (${this.failures}/${this.config.failureThreshold}): ${error.message}`,
      );
      if (this.failures >= this.config.failureThreshold) {
        this.transitionTo('OPEN');
      }
    } else if (this.status === 'HALF_OPEN') {
      // If it fails in HALF_OPEN, go back to OPEN immediately
      this.logger.warn(`CircuitBreaker failed in HALF_OPEN state. Re-opening.`);
      this.transitionTo('OPEN');
    }
  }

  private transitionTo(newState: CircuitBreakerStatus) {
    const oldState = this.status;
    this.status = newState;
    this.logger.warn(
      `CircuitBreaker state changed: ${oldState} -> ${newState}`,
    );

    if (newState === 'OPEN') {
      this.nextAttempt = Date.now() + this.config.timeoutMs;
      this.successes = 0; // Reset successes
    } else if (newState === 'HALF_OPEN') {
      this.failures = 0; // Reset failures so we track anew
      this.successes = 0;
    } else if (newState === 'CLOSED') {
      this.failures = 0;
      this.successes = 0;
      this.nextAttempt = 0;
    }
  }
}
