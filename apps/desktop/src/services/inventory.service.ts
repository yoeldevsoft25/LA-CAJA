import { api } from '@/lib/api'

export interface StockStatus {
  product_id: string
  product_name: string
  current_stock: number
  low_stock_threshold: number
  is_low_stock: boolean
}

export interface InventoryMovement {
  id: string
  store_id: string
  product_id: string
  product_name?: string | null
  movement_type: 'received' | 'adjust' | 'sale'
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
}

export interface ProductStock {
  product_id: string
  current_stock: number
}

export interface MovementsResponse {
  movements: InventoryMovement[]
  total: number
}

export const inventoryService = {
  /**
   * Obtener estado del stock (todos los productos o uno específico)
   */
  async getStockStatus(productId?: string): Promise<StockStatus[]> {
    const params = productId ? { product_id: productId } : {}
    const response = await api.get<StockStatus[]>('/inventory/stock/status', { params })
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
  async getMovements(productId?: string, limit = 50, offset = 0): Promise<MovementsResponse> {
    const params: any = { limit, offset }
    if (productId) {
      params.product_id = productId
    }
    const response = await api.get<MovementsResponse>('/inventory/movements', { params })
    return response.data
  },
}

