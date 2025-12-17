import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Servicio de caché para predicciones y recomendaciones ML
 * Reduce latencia y carga en la base de datos
 */
@Injectable()
export class MLCacheService {
  private readonly logger = new Logger(MLCacheService.name);
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 1000 * 60 * 30; // 30 minutos por defecto

  /**
   * Obtiene un valor del caché si existe y no ha expirado
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Cache expirado, eliminar
      this.cache.delete(key);
      this.logger.debug(`Cache expirado para key: ${key}`);
      return null;
    }

    this.logger.debug(`Cache hit para key: ${key}`);
    return entry.data as T;
  }

  /**
   * Almacena un valor en el caché
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL,
    };

    this.cache.set(key, entry);
    this.logger.debug(`Cache set para key: ${key}, TTL: ${entry.ttl}ms`);
  }

  /**
   * Elimina un valor del caché
   */
  delete(key: string): void {
    this.cache.delete(key);
    this.logger.debug(`Cache delete para key: ${key}`);
  }

  /**
   * Limpia el caché expirado
   */
  cleanExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Limpieza de cache: ${cleaned} entradas eliminadas`);
    }
  }

  /**
   * Limpia todo el caché
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.debug(`Cache limpiado: ${size} entradas eliminadas`);
  }

  /**
   * Genera una clave de caché para predicciones
   */
  generatePredictionKey(
    storeId: string,
    productId: string,
    daysAhead: number,
  ): string {
    return `prediction:${storeId}:${productId}:${daysAhead}`;
  }

  /**
   * Genera una clave de caché para recomendaciones
   */
  generateRecommendationKey(
    storeId: string,
    sourceProductId: string | null,
    type: string,
    limit: number,
  ): string {
    return `recommendation:${storeId}:${sourceProductId || 'general'}:${type}:${limit}`;
  }

  /**
   * Genera una clave de caché para anomalías
   */
  generateAnomalyKey(storeId: string, filters: Record<string, any>): string {
    const filterStr = JSON.stringify(filters);
    return `anomaly:${storeId}:${Buffer.from(filterStr).toString('base64')}`;
  }

  /**
   * Obtiene estadísticas del caché
   */
  getStats(): {
    size: number;
    keys: string[];
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
