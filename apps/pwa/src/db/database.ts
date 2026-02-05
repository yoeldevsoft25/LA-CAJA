import Dexie, { Table } from 'dexie';
import { BaseEvent } from '@la-caja/domain';

/**
 * Base de datos IndexedDB usando Dexie
 * Para PWA - Offline-First
 */
export interface LocalEvent extends BaseEvent {
  id?: number; // Auto-increment para Dexie
  sync_status:
  | 'pending'
  | 'retrying'
  | 'synced'
  | 'failed'
  | 'conflict'
  | 'dead';
  sync_attempts: number;
  synced_at?: number;
  acked_at?: number;
  next_retry_at?: number;
  last_error?: string | null;
  last_error_code?: string | null;
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
  cost_per_weight_bs?: number | null;
  cost_per_weight_usd?: number | null;
  min_weight?: number | null;
  max_weight?: number | null;
  scale_plu?: string | null;
  scale_department?: number | null;
  image_url?: string | null;
  description?: string | null;
  is_recipe?: boolean;
  profit_margin?: number;
  product_type?: 'sale_item' | 'ingredient' | 'prepared';
  is_visible_public?: boolean;
  public_name?: string | null;
  public_description?: string | null;
  public_image_url?: string | null;
  public_category?: string | null;
  ingredients?: Array<{
    ingredient_product_id: string;
    qty: number;
    unit: string | null;
  }>;
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
  debt_cutoff_at?: number | null;
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

export interface LocalWhatsAppConfig {
  id: string;
  store_id: string;
  whatsapp_number: string | null;
  thank_you_message: string | null;
  enabled: boolean;
  debt_notifications_enabled: boolean;
  debt_reminders_enabled: boolean;
  updated_at: number;
  cached_at: number;
  sync_status: 'pending' | 'synced' | 'failed';
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

export interface LocalDebt {
  id: string;
  store_id: string;
  customer_id: string;
  sale_id: string | null;
  amount_bs: number;
  amount_usd: number;
  total_paid_bs: number;
  total_paid_usd: number;
  remaining_bs: number;
  remaining_usd: number;
  status: 'open' | 'partial' | 'paid';
  created_at: number;
  updated_at: number;
  cached_at: number;
  note?: string;
}

export interface LocalStock {
  id: string; // product_id:variant_id
  store_id: string;
  product_id: string;
  variant_id: string | null;
  stock: number;
  updated_at: number;
}

export interface LocalEscrow {
  id: string; // product_id:variant_id
  store_id: string;
  product_id: string;
  variant_id: string | null;
  qty_granted: number;
  expires_at: number | null;
  updated_at: number;
}

export class LaCajaDB extends Dexie {
  localEvents!: Table<LocalEvent, number>;
  products!: Table<LocalProduct, string>;
  customers!: Table<LocalCustomer, string>;
  sales!: Table<LocalSale, string>;
  conflicts!: Table<LocalConflict, string>;
  whatsappConfigs!: Table<LocalWhatsAppConfig, string>;
  debts!: Table<LocalDebt, string>;
  kv!: Table<{ key: string; value: any }, string>;
  localStock!: Table<LocalStock, string>;
  localEscrow!: Table<LocalEscrow, string>;

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
    }).upgrade(async () => {
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

    // Versión 5: Agregar tabla de configuración de WhatsApp para offline-first
    this.version(5).stores({
      localEvents: '++id, event_id, store_id, device_id, seq, type, sync_status, created_at, [sync_status+created_at], [store_id+device_id+sync_status]',
      products: 'id, store_id, name, category, barcode, sku, is_active, [store_id+is_active], [store_id+category]',
      customers: 'id, store_id, name, document_id, [store_id+document_id]',
      sales: 'id, store_id, sold_at, customer_id, [store_id+sold_at]',
      conflicts: 'id, event_id, status, created_at, [status+created_at]',
      whatsappConfigs: 'id, store_id, [store_id+sync_status]',
      kv: 'key',
    });

    // Versión 6: Agregar tabla de deudas para Offline Debts
    this.version(6).stores({
      localEvents: '++id, event_id, store_id, device_id, seq, type, sync_status, created_at, [sync_status+created_at], [store_id+device_id+sync_status]',
      products: 'id, store_id, name, category, barcode, sku, is_active, [store_id+is_active], [store_id+category]',
      customers: 'id, store_id, name, document_id, [store_id+document_id]',
      sales: 'id, store_id, sold_at, customer_id, [store_id+sold_at]',
      conflicts: 'id, event_id, status, created_at, [status+created_at]',
      whatsappConfigs: 'id, store_id, [store_id+sync_status]',
      debts: 'id, store_id, customer_id, status, [store_id+customer_id], [store_id+status]',
      kv: 'key',
    });

    // Versión 7: Outbox robusto
    // - Unicidad fuerte por event_id
    // - Estados de retry/dead
    // - Índice por next_retry_at para scheduler
    this.version(7)
      .stores({
        localEvents:
          '++id, &event_id, [store_id+device_id+seq], seq, type, sync_status, created_at, [sync_status+created_at], [sync_status+next_retry_at], [store_id+device_id+sync_status]',
        products:
          'id, store_id, name, category, barcode, sku, is_active, [store_id+is_active], [store_id+category]',
        customers: 'id, store_id, name, document_id, [store_id+document_id]',
        sales: 'id, store_id, sold_at, customer_id, [store_id+sold_at]',
        conflicts: 'id, event_id, status, created_at, [status+created_at]',
        whatsappConfigs: 'id, store_id, [store_id+sync_status]',
        debts: 'id, store_id, customer_id, status, [store_id+customer_id], [store_id+status]',
        kv: 'key',
      })
      .upgrade(async (trans) => {
        const localEventsTable = trans.table('localEvents') as Table<LocalEvent, number>;
        const seen = new Map<string, LocalEvent & { id: number }>();
        const duplicatesToDelete: number[] = [];

        await localEventsTable.toCollection().each((evt: LocalEvent & { id?: number }) => {
          if (!evt.id) return;
          const current = evt as LocalEvent & { id: number };
          const existing = seen.get(current.event_id);
          if (!existing) {
            seen.set(current.event_id, current);
            return;
          }

          // Conservamos el evento más reciente por created_at
          const existingCreated = Number(existing.created_at || 0);
          const currentCreated = Number(current.created_at || 0);
          if (currentCreated >= existingCreated) {
            duplicatesToDelete.push(existing.id);
            seen.set(current.event_id, current);
          } else {
            duplicatesToDelete.push(current.id);
          }
        });

        if (duplicatesToDelete.length > 0) {
          await localEventsTable.bulkDelete(duplicatesToDelete);
        }

        const now = Date.now();
        await localEventsTable.toCollection().modify((evt: LocalEvent) => {
          if (!evt.sync_status) evt.sync_status = 'pending';
          if (!evt.sync_attempts) evt.sync_attempts = 0;
          if (evt.next_retry_at == null) evt.next_retry_at = now;
          if (evt.last_error_code === undefined) evt.last_error_code = null;
          if (evt.last_error === undefined) evt.last_error = null;
        });
      });

    // Versión 8: Tablas de stock local para validación offline
    this.version(8).stores({
      localEvents:
        '++id, &event_id, [store_id+device_id+seq], seq, type, sync_status, created_at, [sync_status+created_at], [sync_status+next_retry_at], [store_id+device_id+sync_status]',
      products:
        'id, store_id, name, category, barcode, sku, is_active, [store_id+is_active], [store_id+category]',
      customers: 'id, store_id, name, document_id, [store_id+document_id]',
      sales: 'id, store_id, sold_at, customer_id, [store_id+sold_at]',
      conflicts: 'id, event_id, status, created_at, [status+created_at]',
      whatsappConfigs: 'id, store_id, [store_id+sync_status]',
      debts: 'id, store_id, customer_id, status, [store_id+customer_id], [store_id+status]',
      kv: 'key',
      localStock: 'id, store_id, product_id, variant_id',
      localEscrow: 'id, store_id, product_id, variant_id',
    });
  }

  /**
   * Query optimizada para obtener eventos pendientes de sincronización
   * Usa el índice compuesto [sync_status+created_at] para mejor performance
   */
  async getPendingEvents(limit: number = 50): Promise<LocalEvent[]> {
    const now = Date.now();

    const pending = await this.localEvents
      .where('[sync_status+created_at]')
      .between(['pending', Dexie.minKey], ['pending', Dexie.maxKey])
      .limit(limit)
      .toArray();

    if (pending.length >= limit) {
      return pending.sort((a, b) => Number(a.created_at) - Number(b.created_at));
    }

    const retrying = await this.localEvents
      .where('[sync_status+next_retry_at]')
      .between(['retrying', Dexie.minKey], ['retrying', now])
      .limit(limit - pending.length)
      .toArray();

    return [...pending, ...retrying]
      .sort((a, b) => Number(a.created_at) - Number(b.created_at))
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
      .where('[sync_status+created_at]')
      .between([status, Dexie.minKey], [status, Dexie.maxKey])
      .limit(limit)
      .toArray();
    return events.sort((a, b) => Number(a.created_at) - Number(b.created_at));
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
        next_retry_at: Date.now(),
        last_error: null,
        last_error_code: null,
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
    is_visible_public?: boolean;
    product_type?: 'sale_item' | 'ingredient' | 'prepared';
    limit?: number;
  }): Promise<LocalProduct[]> {
    let query = this.products.where('store_id').equals(storeId);

    if (options?.is_active !== undefined) {
      query = query.filter(p => p.is_active === options.is_active);
    }

    if (options?.is_visible_public !== undefined) {
      query = query.filter(p => p.is_visible_public === options.is_visible_public);
    }

    if (options?.product_type) {
      query = query.filter(p => p.product_type === options.product_type);
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
