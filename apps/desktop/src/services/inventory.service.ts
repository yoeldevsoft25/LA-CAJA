import { api } from '@/lib/api'

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
}

export interface StockAdjustedRequest {
  product_id: string
  qty_delta: number
  reason: 'loss' | 'damage' | 'count' | 'other'
  note?: string
  warehouse_id?: string | null
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
    const response = await api.post<InventoryMovement>('/inventory/stock/received', data)
    return response.data
  },

  /**
   * Ajustar stock (corrección manual)
   */
  async stockAdjusted(data: StockAdjustedRequest): Promise<InventoryMovement> {
    const response = await api.post<InventoryMovement>('/inventory/stock/adjust', data)
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
}
