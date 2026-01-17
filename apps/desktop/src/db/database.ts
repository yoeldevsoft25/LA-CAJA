import Dexie, { Table } from 'dexie';
import { BaseEvent } from '@la-caja/domain';

/**
 * Base de datos IndexedDB usando Dexie
 * Para PWA - Offline-First
 */
export interface LocalEvent extends BaseEvent {
  id?: number; // Auto-increment para Dexie
  sync_status: 'pending' | 'synced' | 'failed';
  sync_attempts: number;
  synced_at?: number;
}

export interface LocalProduct {
  id: string;
  store_id: string;
  name: string;
  category: string | null;
  sku: string | null;
  barcode: string | null;
  price_bs: number;
  price_usd: number;
  cost_bs: number;
  cost_usd: number;
  low_stock_threshold: number;
  is_active: boolean;
  is_weight_product?: boolean;
  weight_unit?: 'kg' | 'g' | 'lb' | 'oz' | null;
  price_per_weight_bs?: number | null;
  price_per_weight_usd?: number | null;
  min_weight?: number | null;
  max_weight?: number | null;
  scale_plu?: string | null;
  scale_department?: number | null;
  updated_at: number;
  cached_at: number;
}

export class LaCajaDB extends Dexie {
  localEvents!: Table<LocalEvent, number>;
  products!: Table<LocalProduct, string>;
  kv!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('LaCajaDB');
    
    // Versión 1: Schema original (mantener para compatibilidad)
    this.version(1).stores({
      localEvents: '++id, event_id, store_id, device_id, seq, type, sync_status, created_at',
      kv: 'key',
    });
    
    // Versión 2: Índices optimizados (migración automática de Dexie)
    this.version(2).stores({
      localEvents: '++id, event_id, store_id, device_id, seq, type, sync_status, created_at, [sync_status+created_at], [store_id+device_id+sync_status]',
      kv: 'key',
    }).upgrade(async (tx) => {
      // Migración automática - Dexie maneja esto sin pérdida de datos
    });

    // Versión 3: Agregar productos en cache local
    this.version(3).stores({
      localEvents: '++id, event_id, store_id, device_id, seq, type, sync_status, created_at, [sync_status+created_at], [store_id+device_id+sync_status]',
      products: 'id, store_id, name, category, barcode, sku, is_active, [store_id+is_active], [store_id+category]',
      kv: 'key',
    }).upgrade(async () => {
      // Migración automática - Dexie maneja esto sin pérdida de datos
    });
  }
  
  /**
   * Query optimizada para obtener eventos pendientes de sincronización
   */
  async getPendingEvents(limit: number = 50): Promise<LocalEvent[]> {
    const events = await this.localEvents
      .where('sync_status')
      .equals('pending')
      .toArray();

    return events
      .sort((a, b) => (a.created_at as number) - (b.created_at as number))
      .slice(0, limit);
  }
  
  /**
   * Query optimizada para obtener eventos por dispositivo y estado
   */
  async getEventsByDeviceAndStatus(
    storeId: string,
    deviceId: string,
    status: LocalEvent['sync_status'],
    limit: number = 50
  ): Promise<LocalEvent[]> {
    const events = await this.localEvents
      .where('[store_id+device_id+sync_status]')
      .equals([storeId, deviceId, status])
      .toArray();

    return events
      .sort((a, b) => (a.created_at as number) - (b.created_at as number))
      .slice(0, limit);
  }

  /**
   * PRODUCTOS - Read Model Local
   */
  async cacheProducts(products: LocalProduct[]): Promise<void> {
    await this.products.bulkPut(products);
  }

  async cacheProduct(product: LocalProduct): Promise<void> {
    await this.products.put(product);
  }

  async getProducts(storeId: string, options?: {
    search?: string;
    category?: string;
    is_active?: boolean;
    limit?: number;
  }): Promise<LocalProduct[]> {
    let query = this.products.where('store_id').equals(storeId);

    if (options?.is_active !== undefined) {
      query = query.filter(p => p.is_active === options.is_active);
    }

    if (options?.category) {
      query = query.filter(p => p.category === options.category);
    }

    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      query = query.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        (p.sku?.toLowerCase().includes(searchLower) ?? false) ||
        (p.barcode?.toLowerCase().includes(searchLower) ?? false)
      );
    }

    let results = await query.toArray();

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async getProductById(id: string): Promise<LocalProduct | undefined> {
    return this.products.get(id);
  }
}

export const db = new LaCajaDB();

