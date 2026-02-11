/**
 * Estrategia de Reintentos con Exponential Backoff
 * Maneja reintentos inteligentes con jitter para evitar thundering herd
 */

export interface RetryConfig {
  baseDelay: number;      // Delay base en ms (default: 1000)
  maxDelay: number;       // Delay máximo en ms (default: 60000)
  maxAttempts: number;    // Número máximo de intentos (default: 5)
  jitterPercent: number;  // Porcentaje de jitter (default: 20)
}

export class RetryStrategy {
  private config: Required<RetryConfig>;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      baseDelay: config.baseDelay ?? 1000,
      maxDelay: config.maxDelay ?? 60000,
      maxAttempts: config.maxAttempts ?? 5,
      jitterPercent: config.jitterPercent ?? 20,
    };
  }

  /**
   * Calcula el delay para el siguiente intento usando exponential backoff
   * Formula: baseDelay * 2^attemptCount (con jitter)
   */
  calculateDelay(attemptCount: number): number {
    if (attemptCount <= 0) return 0;

    // Exponential backoff: baseDelay * 2^attemptCount
    const exponentialDelay = Math.min(
      this.config.baseDelay * Math.pow(2, attemptCount - 1),
      this.config.maxDelay
    );

    // Agregar jitter aleatorio (±jitterPercent%) para evitar thundering herd
    const jitterRange = exponentialDelay * (this.config.jitterPercent / 100);
    const jitter = (Math.random() - 0.5) * 2 * jitterRange; // -jitterRange a +jitterRange
    const delay = Math.floor(exponentialDelay + jitter);

    return Math.max(0, delay);
  }

  /**
   * Determina si se debe reintentar basado en el error y número de intentos
   */
  shouldRetry(attemptCount: number, error: Error | unknown): boolean {
    // No reintentar si se excedió el máximo de intentos
    if (attemptCount >= this.config.maxAttempts) {
      return false;
    }

    // Si el error no tiene información, reintentar
    if (!(error instanceof Error)) {
      return true;
    }

    // Errores de auth transitorios (ej: failover o refresco de token en curso)
    // deben reintentarse para no enterrar ventas offline en memoria.
    if (error.name === 'TransientAuthError') {
      return true;
    }

    // No reintentar errores de validación (4xx) - son errores del cliente
    if (
      error.name === 'ValidationError' ||
      error.message.includes('400') ||
      error.message.includes('404') ||
      error.message.includes('validation')
    ) {
      return false;
    }

    // Reintentar errores de red, timeout, servidor (5xx)
    if (
      error.name === 'NetworkError' ||
      error.name === 'TimeoutError' ||
      error.message.includes('500') ||
      error.message.includes('502') ||
      error.message.includes('503') ||
      error.message.includes('504') ||
      error.message.includes('network') ||
      error.message.includes('timeout') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND')
    ) {
      return true;
    }

    // Por defecto, reintentar (errores desconocidos pueden ser temporales)
    return true;
  }

  /**
   * Espera el delay calculado antes del siguiente intento
   */
  async waitForRetry(attemptCount: number): Promise<void> {
    const delay = this.calculateDelay(attemptCount);
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
