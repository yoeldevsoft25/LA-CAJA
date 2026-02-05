import { api } from '@/lib/api'
import { syncService } from './sync.service'
import { BaseEvent, StockDeltaAppliedPayload } from '@la-caja/domain'
import { createLogger } from '@/lib/logger'

const logger = createLogger('InventoryService')

function randomUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function getDeviceId(): string {
  let deviceId = localStorage.getItem('device_id')
  if (!deviceId) {
    deviceId = randomUUID()
    localStorage.setItem('device_id', deviceId)
  }
  return deviceId
}

export interface StockStatus {
  product_id: string
  product_name: string
  current_stock: number
  low_stock_threshold: number
  is_low_stock: boolean
  // Campos para productos por peso
  is_weight_product?: boolean
  weight_unit?: 'kg' | 'g' | 'lb' | 'oz' | null
  cost_per_weight_bs?: number | string | null
  cost_per_weight_usd?: number | string | null
}

export interface StockStatusResponse {
  items: StockStatus[]
  total: number
}

export interface StockStatusSearchParams {
  product_id?: string
  warehouse_id?: string
  search?: string
  category?: string
  is_active?: boolean
  is_visible_public?: boolean
  product_type?: 'sale_item' | 'ingredient' | 'prepared'
  low_stock_only?: boolean
  limit?: number
  offset?: number
}

export interface InventoryMovement {
  id: string
  store_id: string
  product_id: string
  product_name?: string | null
  movement_type: 'received' | 'adjust' | 'sold' | 'sale'
  qty_delta: number
  unit_cost_bs: number | string
  unit_cost_usd: number | string
  note: string | null
  ref: { supplier?: string; invoice?: string } | null
  happened_at: string
}

export interface StockReceivedRequest {
  product_id: string
  qty: number
  unit_cost_bs: number
  unit_cost_usd: number
  note?: string
  warehouse_id?: string | null
  ref?: {
    supplier?: string
    invoice?: string
  }
  request_id?: string
}

export interface StockAdjustedRequest {
  product_id: string
  qty_delta: number
  reason: string
  note?: string
  warehouse_id?: string | null
  request_id?: string
}

export interface ProductStock {
  product_id: string
  current_stock: number
}

export interface MovementsResponse {
  movements: InventoryMovement[]
  total: number
}

export interface MovementsParams {
  product_id?: string
  warehouse_id?: string
  limit?: number
  offset?: number
  include_pending?: boolean
  start_date?: string
  end_date?: string
}

export interface EscrowStatus {
  id: string;
  store_id: string;
  product_id: string;
  variant_id: string | null;
  device_id: string;
  qty_granted: number;
  expires_at: string | null;
  last_updated_at: string;
}

export const inventoryService = {
  /**
   * Obtener estado del stock (todos los productos o uno específico)
   */
  async getStockStatus(params: StockStatusSearchParams = {}): Promise<StockStatus[]> {
    const response = await api.get<StockStatus[] | StockStatusResponse>(
      '/inventory/stock/status',
      { params }
    )
    return Array.isArray(response.data) ? response.data : response.data.items
  },

  /**
   * Obtener estado del stock con paginación/filtros
   */
  async getStockStatusPaged(
    params: StockStatusSearchParams
  ): Promise<StockStatusResponse> {
    const response = await api.get<StockStatusResponse>('/inventory/stock/status', { params })
    return response.data
  },

  /**
   * Obtener productos con stock bajo
   */
  async getLowStock(): Promise<StockStatus[]> {
    const response = await api.get<StockStatus[]>('/inventory/stock/low')
    return response.data
  },

  /**
   * Obtener stock actual de un producto específico
   */
  async getProductStock(productId: string): Promise<ProductStock> {
    const response = await api.get<ProductStock>(`/inventory/stock/${productId}`)
    return response.data
  },

  /**
   * Recibir stock (entrada de mercancía)
   */
  async stockReceived(data: StockReceivedRequest): Promise<InventoryMovement> {
    const requestId = data.request_id || randomUUID()
    const isOnline = navigator.onLine

    if (!isOnline) {
      logger.info('Modo OFFLINE - Encolando recepción de stock')
      const movementId = randomUUID()
      const now = Date.now()

      const payload: StockDeltaAppliedPayload = {
        movement_id: movementId,
        product_id: data.product_id,
        warehouse_id: data.warehouse_id || '',
        qty_delta: data.qty,
        reason: 'received',
        request_id: requestId,
        ref: {
          ...data.ref,
          unit_cost_bs: data.unit_cost_bs,
          unit_cost_usd: data.unit_cost_usd,
          note: data.note,
        },
      }

      const event: BaseEvent = {
        event_id: randomUUID(),
        store_id: localStorage.getItem('store_id') || '',
        device_id: getDeviceId(),
        seq: 0, // syncService asocia secuencia
        type: 'StockDeltaApplied',
        version: 1,
        created_at: now,
        actor: {
          user_id: localStorage.getItem('user_id') || 'system',
          role: (localStorage.getItem('user_role') as any) || 'cashier',
        },
        payload,
      }

      await syncService.enqueueEvent(event)

      return {
        id: movementId,
        store_id: event.store_id,
        product_id: data.product_id,
        movement_type: 'received',
        qty_delta: data.qty,
        unit_cost_bs: data.unit_cost_bs,
        unit_cost_usd: data.unit_cost_usd,
        note: data.note || null,
        ref: data.ref || null,
        happened_at: new Date(now).toISOString(),
      }
    }

    const response = await api.post<InventoryMovement>('/inventory/stock/received', {
      ...data,
      request_id: requestId,
    })
    return response.data
  },

  /**
   * Ajustar stock (corrección manual)
   */
  async stockAdjusted(data: StockAdjustedRequest): Promise<InventoryMovement> {
    const requestId = data.request_id || randomUUID()
    const isOnline = navigator.onLine

    if (!isOnline) {
      logger.info('Modo OFFLINE - Encolando ajuste de stock')
      const movementId = randomUUID()
      const now = Date.now()

      const payload: StockDeltaAppliedPayload = {
        movement_id: movementId,
        product_id: data.product_id,
        warehouse_id: data.warehouse_id || '',
        qty_delta: data.qty_delta,
        reason: `adjust:${data.reason}`,
        request_id: requestId,
        ref: {
          note: data.note,
          original_reason: data.reason,
        },
      }

      const event: BaseEvent = {
        event_id: randomUUID(),
        store_id: localStorage.getItem('store_id') || '',
        device_id: getDeviceId(),
        seq: 0,
        type: 'StockDeltaApplied',
        version: 1,
        created_at: now,
        actor: {
          user_id: localStorage.getItem('user_id') || 'system',
          role: (localStorage.getItem('user_role') as any) || 'cashier',
        },
        payload,
      }

      await syncService.enqueueEvent(event)

      return {
        id: movementId,
        store_id: event.store_id,
        product_id: data.product_id,
        movement_type: 'adjust',
        qty_delta: data.qty_delta,
        unit_cost_bs: 0,
        unit_cost_usd: 0,
        note: data.note || null,
        ref: null,
        happened_at: new Date(now).toISOString(),
      }
    }

    const response = await api.post<InventoryMovement>('/inventory/stock/adjust', {
      ...data,
      request_id: requestId,
    })
    return response.data
  },

  /**
   * Obtener movimientos de inventario
   */
  async getMovements(params: MovementsParams = {}): Promise<MovementsResponse> {
    const {
      product_id,
      warehouse_id,
      limit = 50,
      offset = 0,
      include_pending,
      start_date,
      end_date,
    } = params
    const queryParams: Record<string, any> = { limit, offset }
    if (product_id) {
      queryParams.product_id = product_id
    }
    if (warehouse_id) {
      queryParams.warehouse_id = warehouse_id
    }
    if (include_pending !== undefined) {
      queryParams.include_pending = include_pending
    }
    if (start_date) {
      queryParams.start_date = start_date
    }
    if (end_date) {
      queryParams.end_date = end_date
    }
    const response = await api.get<MovementsResponse>('/inventory/movements', {
      params: queryParams,
    })
    return response.data
  },

  /**
   * Vaciar el stock de un producto específico (poner a 0)
   * Solo owners pueden ejecutar esta acción
   */
  async resetProductStock(productId: string, note?: string): Promise<{ ok: boolean; message: string }> {
    const response = await api.post<{ ok: boolean; message: string }>(
      `/inventory/stock/reset/${productId}`,
      { note }
    )
    return response.data
  },

  /**
   * Reconciliar warehouse_stock desde movimientos (received/adjust/sold).
   * Corrige el stock cuando recepciones se guardaron pero no se actualizó la bodega. Solo owners.
   */
  async reconcileStock(): Promise<{ ok: boolean; message: string }> {
    const response = await api.post<{ ok: boolean; message: string }>(
      '/inventory/stock/reconcile'
    )
    return response.data
  },

  /**
   * Vaciar TODO el inventario de la tienda
   * Solo owners pueden ejecutar esta acción - PELIGROSO
   */
  async resetAllStock(note?: string): Promise<{ ok: boolean; message: string; reset_count: number }> {
    const response = await api.post<{ ok: boolean; message: string; reset_count: number }>(
      '/inventory/stock/reset-all',
      { note, confirm: true }
    )
    return response.data
  },
  /**
   * Reconciliar inventario físico (Live Inventory)
   */
  async reconcilePhysicalStock(items: { product_id: string; quantity: number; counted_at: string }[]) {
    const response = await api.post('/inventory/stock/reconcile-physical', { items })
    return response.data
  },

  /**
   * Obtener status de escrows para la tienda
   */
  async getEscrowStatus(storeId: string): Promise<EscrowStatus[]> {
    const response = await api.get<EscrowStatus[]>(`/inventory/escrow/status/${storeId}`)
    return response.data
  },

  /**
   * Cachear stock en IndexedDB
   */
  async cacheStock(status: StockStatus[]): Promise<void> {
    const { db } = await import('@/db/database');
    const storeId = localStorage.getItem('store_id') || '';
    const now = Date.now();

    const localStocks = status.map(s => ({
      id: `${s.product_id}:null`, // TODO: Soporte para variantes si se agrega a StockStatus
      store_id: storeId,
      product_id: s.product_id,
      variant_id: null,
      stock: s.current_stock,
      updated_at: now
    }));

    await db.localStock.bulkPut(localStocks);
  },

  /**
   * Cachear escrows en IndexedDB
   */
  async cacheEscrows(escrows: EscrowStatus[]): Promise<void> {
    const { db } = await import('@/db/database');
    const now = Date.now();

    const localEscrows = escrows.map(e => ({
      id: `${e.product_id}:${e.variant_id || 'null'}`,
      store_id: e.store_id,
      product_id: e.product_id,
      variant_id: e.variant_id,
      qty_granted: Number(e.qty_granted),
      expires_at: e.expires_at ? new Date(e.expires_at).getTime() : null,
      updated_at: now
    }));

    await db.localEscrow.bulkPut(localEscrows);
  }
}
