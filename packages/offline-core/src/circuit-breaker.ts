/**
 * Circuit Breaker Client-Side
 *
 * Protege el cliente de hacer requests al servidor cuando está caído
 * Estados: CLOSED → OPEN → HALF_OPEN → CLOSED
 */

export enum CircuitState {
  CLOSED = 'CLOSED',       // Normal: requests pasan
  OPEN = 'OPEN',          // Servidor caído: rechazar requests
  HALF_OPEN = 'HALF_OPEN' // Probando: permitir 1 request
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Fallos consecutivos antes de abrir
  successThreshold: number;      // Éxitos consecutivos para cerrar desde HALF_OPEN
  timeout: number;               // ms para pasar de OPEN a HALF_OPEN
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private nextAttemptTime: number = 0;

  private readonly config: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000, // 30 segundos
  };

  constructor(config?: Partial<CircuitBreakerConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Ejecuta una función con protección del circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // OPEN: rechazar inmediatamente si no ha pasado el timeout
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error('Circuit breaker is OPEN');
      }
      // Timeout pasó, pasar a HALF_OPEN
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      console.log('[CircuitBreaker] State: OPEN → HALF_OPEN');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handler de éxito
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        console.log('[CircuitBreaker] State: HALF_OPEN → CLOSED');
      }
    }
  }

  /**
   * Handler de fallo
   */
  private onFailure(): void {
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      // En HALF_OPEN, cualquier fallo vuelve a OPEN
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.timeout;
      console.log('[CircuitBreaker] State: HALF_OPEN → OPEN');
      return;
    }

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.timeout;
      console.log(
        `[CircuitBreaker] State: CLOSED → OPEN (${this.failureCount} failures)`
      );
    }
  }

  /**
   * Obtiene el estado actual
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Verifica si se puede hacer un request
   */
  canAttempt(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      return Date.now() >= this.nextAttemptTime;
    }

    return false;
  }

  /**
   * Reset manual (para testing)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = 0;
  }
}
