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
  updated_at: number; // timestamp
  cached_at: number; // cuando se guardó en cache
}

export interface LocalCustomer {
  id: string;
  store_id: string;
  name: string;
  document_id: string | null;
  phone: string | null;
  note: string | null;
  updated_at: number;
  cached_at: number;
}

export interface LocalSale {
  id: string;
  store_id: string;
  sold_at: number;
  totals: any;
  payment: any;
  customer_id: string | null;
  cached_at: number;
}

export interface LocalConflict {
  id: string; // conflict_id del servidor
  event_id: string;
  reason: string;
  conflicting_with: string[];
  created_at: number;
  status: 'pending' | 'resolved';
  requires_manual_review: boolean;
  resolution?: 'keep_mine' | 'take_theirs';
  resolved_at?: number;
}

export class LaCajaDB extends Dexie {
  localEvents!: Table<LocalEvent, number>;
  products!: Table<LocalProduct, string>;
  customers!: Table<LocalCustomer, string>;
  sales!: Table<LocalSale, string>;
  conflicts!: Table<LocalConflict, string>;
  kv!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('LaCajaDB');
    
    // Versión 1: Schema original (mantener para compatibilidad)
    this.version(1).stores({
      localEvents: '++id, event_id, store_id, device_id, seq, type, sync_status, created_at',
      kv: 'key',
    });
    
    // Versión 2: Índices optimizados
    this.version(2).stores({
      localEvents: '++id, event_id, store_id, device_id, seq, type, sync_status, created_at, [sync_status+created_at], [store_id+device_id+sync_status]',
      kv: 'key',
    });
    
    // Versión 3: Agregar read models locales (productos, clientes, ventas)
    this.version(3).stores({
      localEvents: '++id, event_id, store_id, device_id, seq, type, sync_status, created_at, [sync_status+created_at], [store_id+device_id+sync_status]',
      products: 'id, store_id, name, category, barcode, sku, is_active, [store_id+is_active], [store_id+category]',
      customers: 'id, store_id, name, document_id, [store_id+document_id]',
      sales: 'id, store_id, sold_at, customer_id, [store_id+sold_at]',
      kv: 'key',
    }).upgrade(async (_tx) => {
      // Migración automática - Dexie maneja esto sin pérdida de datos
    });

    // Versión 4: Agregar tabla de conflictos para offline-first
    this.version(4).stores({
      localEvents: '++id, event_id, store_id, device_id, seq, type, sync_status, created_at, [sync_status+created_at], [store_id+device_id+sync_status]',
      products: 'id, store_id, name, category, barcode, sku, is_active, [store_id+is_active], [store_id+category]',
      customers: 'id, store_id, name, document_id, [store_id+document_id]',
      sales: 'id, store_id, sold_at, customer_id, [store_id+sold_at]',
      conflicts: 'id, event_id, status, created_at, [status+created_at]',
      kv: 'key',
    });
  }
  
  /**
   * Query optimizada para obtener eventos pendientes de sincronización
   * Usa el índice compuesto [sync_status+created_at] para mejor performance
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
   * Obtiene eventos por estado sin filtrar por store/device
   */
  async getEventsByStatus(
    status: LocalEvent['sync_status'],
    limit: number = 200
  ): Promise<LocalEvent[]> {
    const events = await this.localEvents
      .where('sync_status')
      .equals(status)
      .toArray();
    return events
      .sort((a, b) => (a.created_at as number) - (b.created_at as number))
      .slice(0, limit);
  }

  /**
   * Resetea eventos fallidos a pendiente (útil tras corregir validaciones)
   */
  async resetFailedEventsToPending(): Promise<number> {
    const failed = await this.getEventsByStatus('failed', 500);
    if (failed.length === 0) return 0;
    const updates = failed.map((evt) =>
      this.localEvents.update(evt.id!, {
        sync_status: 'pending',
        sync_attempts: 0,
        last_error: null,
      })
    );
    await Promise.all(updates);
    return failed.length;
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
      query = query.filter(p => {
        const nameMatch = p.name.toLowerCase().includes(searchLower);
        const skuMatch = p.sku?.toLowerCase().includes(searchLower) ?? false;
        const barcodeMatch = p.barcode?.toLowerCase().includes(searchLower) ?? false;
        return nameMatch || skuMatch || barcodeMatch;
      });
    }

    const products = await query.toArray();
    
    // Ordenar por nombre
    products.sort((a, b) => a.name.localeCompare(b.name));

    if (options?.limit) {
      return products.slice(0, options.limit);
    }

    return products;
  }

  async getProductById(id: string): Promise<LocalProduct | undefined> {
    return this.products.get(id);
  }

  async cacheProducts(products: LocalProduct[]): Promise<void> {
    await this.products.bulkPut(products);
  }

  async cacheProduct(product: LocalProduct): Promise<void> {
    await this.products.put(product);
  }

  /**
   * CLIENTES - Read Model Local
   */
  async getCustomers(storeId: string, search?: string): Promise<LocalCustomer[]> {
    let query = this.customers.where('store_id').equals(storeId);

    if (search) {
      const searchLower = search.toLowerCase();
      query = query.filter(c => {
        const nameMatch = c.name.toLowerCase().includes(searchLower);
        const docMatch = c.document_id?.toLowerCase().includes(searchLower) ?? false;
        const phoneMatch = c.phone?.toLowerCase().includes(searchLower) ?? false;
        return nameMatch || docMatch || phoneMatch;
      });
    }

    return query.toArray();
  }

  async getCustomerById(id: string): Promise<LocalCustomer | undefined> {
    return this.customers.get(id);
  }

  async cacheCustomers(customers: LocalCustomer[]): Promise<void> {
    await this.customers.bulkPut(customers);
  }

  async cacheCustomer(customer: LocalCustomer): Promise<void> {
    await this.customers.put(customer);
  }

  /**
   * VENTAS - Read Model Local (para historial rápido)
   */
  async getSales(storeId: string, limit?: number): Promise<LocalSale[]> {
    const sales = await this.sales
      .where('store_id')
      .equals(storeId)
      .toArray();
    
    sales.sort((a, b) => (b.sold_at as number) - (a.sold_at as number));
    
    if (limit) {
      return sales.slice(0, limit);
    }

    return sales;
  }

  async cacheSale(sale: LocalSale): Promise<void> {
    await this.sales.put(sale);
  }
}

export const db = new LaCajaDB();

