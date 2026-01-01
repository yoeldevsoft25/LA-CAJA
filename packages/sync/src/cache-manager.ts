/**
 * Cache Manager L1/L2/L3
 *
 * L1: Memory (hot data, 5 min TTL)
 * L2: IndexedDB (warm data, 30 días TTL)
 * L3: Service Worker (static assets, permanente)
 */

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number; // ms
}

export enum CacheLevel {
  L1 = 'L1', // Memory
  L2 = 'L2', // IndexedDB
  L3 = 'L3'  // Service Worker
}

export class CacheManager {
  // L1: Memory cache (Map)
  private l1Cache: Map<string, CacheEntry<any>> = new Map();
  private readonly L1_TTL = 5 * 60 * 1000; // 5 minutos
  private readonly L1_MAX_SIZE = 1000; // Máximo 1000 entradas

  // L2: IndexedDB (se accede vía IndexedDB API)
  private readonly L2_TTL = 30 * 24 * 60 * 60 * 1000; // 30 días
  private dbName: string = 'cache_l2';
  private db: IDBDatabase | null = null;

  constructor(dbName?: string) {
    if (dbName) {
      this.dbName = dbName;
    }
    this.initIndexedDB();
    this.startEvictionTimer();
  }

  /**
   * Inicializa IndexedDB para L2
   */
  private async initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.error('[CacheManager] Error opening IndexedDB', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Obtiene un valor del cache (L1 → L2 → miss)
   */
  async get<T>(key: string): Promise<T | null> {
    // 1. Buscar en L1
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && this.isValid(l1Entry)) {
      console.log(`[Cache] L1 hit: ${key}`);
      return l1Entry.value as T;
    }

    // 2. Buscar en L2
    const l2Entry = await this.getFromL2<T>(key);
    if (l2Entry && this.isValid(l2Entry)) {
      console.log(`[Cache] L2 hit: ${key}`);
      // Promover a L1
      this.l1Cache.set(key, {
        value: l2Entry.value,
        timestamp: Date.now(),
        ttl: this.L1_TTL,
      });
      return l2Entry.value;
    }

    console.log(`[Cache] Miss: ${key}`);
    return null;
  }

  /**
   * Guarda un valor en el cache (L1 + L2)
   */
  async set<T>(key: string, value: T, level: CacheLevel = CacheLevel.L2): Promise<void> {
    // Guardar en L1
    this.l1Cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: this.L1_TTL,
    });

    // Evicción LRU si L1 está lleno
    if (this.l1Cache.size > this.L1_MAX_SIZE) {
      const firstKey = this.l1Cache.keys().next().value;
      if (firstKey !== undefined) {
        this.l1Cache.delete(firstKey);
      }
    }

    // Guardar en L2 si es necesario
    if (level === CacheLevel.L2) {
      await this.setInL2(key, value);
    }
  }

  /**
   * Invalida un valor del cache
   */
  async invalidate(key: string): Promise<void> {
    this.l1Cache.delete(key);
    await this.deleteFromL2(key);
  }

  /**
   * Invalida todas las entradas que matcheen un patrón
   */
  async invalidatePattern(pattern: RegExp): Promise<void> {
    // L1
    for (const key of this.l1Cache.keys()) {
      if (pattern.test(key)) {
        this.l1Cache.delete(key);
      }
    }

    // L2
    await this.deletePatternFromL2(pattern);
  }

  /**
   * Limpia todo el cache
   */
  async clear(): Promise<void> {
    this.l1Cache.clear();
    await this.clearL2();
  }

  /**
   * Obtiene estadísticas del cache
   */
  getStats() {
    return {
      l1Size: this.l1Cache.size,
      l1MaxSize: this.L1_MAX_SIZE,
      l1FillPercent: Math.round((this.l1Cache.size / this.L1_MAX_SIZE) * 100),
    };
  }

  // ===== L2 (IndexedDB) Operations =====

  private async getFromL2<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve({
            value: result.value,
            timestamp: result.timestamp,
            ttl: this.L2_TTL,
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('[CacheManager] Error reading from L2', request.error);
        resolve(null);
      };
    });
  }

  private async setInL2<T>(key: string, value: T): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.put({
        key,
        value,
        timestamp: Date.now(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[CacheManager] Error writing to L2', request.error);
        reject(request.error);
      };
    });
  }

  private async deleteFromL2(key: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[CacheManager] Error deleting from L2', request.error);
        resolve();
      };
    });
  }

  private async deletePatternFromL2(pattern: RegExp): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.openCursor();

      request.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (pattern.test(cursor.value.key)) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        console.error('[CacheManager] Error deleting pattern from L2', request.error);
        resolve();
      };
    });
  }

  private async clearL2(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[CacheManager] Error clearing L2', request.error);
        resolve();
      };
    });
  }

  // ===== Utilidades =====

  private isValid(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Timer para evicción periódica de entradas expiradas
   */
  private startEvictionTimer(): void {
    setInterval(() => {
      // Evictar L1
      for (const [key, entry] of this.l1Cache.entries()) {
        if (!this.isValid(entry)) {
          this.l1Cache.delete(key);
        }
      }
    }, 60000); // Cada minuto
  }
}
