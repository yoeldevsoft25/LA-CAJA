import { api } from '@/lib/api'

export type LotMovementType = 'received' | 'sold' | 'expired' | 'damaged' | 'adjusted'

export interface ProductLot {
  id: string
  product_id: string
  lot_number: string
  initial_quantity: number
  remaining_quantity: number
  unit_cost_bs: number | string
  unit_cost_usd: number | string
  expiration_date: string | null
  received_at: string
  supplier: string | null
  note: string | null
  created_at: string
  updated_at: string
  product?: {
    id: string
    name: string
  }
}

export interface CreateProductLotRequest {
  product_id: string
  lot_number: string
  initial_quantity: number
  unit_cost_bs: number
  unit_cost_usd: number
  expiration_date?: string | null
  received_at: string
  supplier?: string | null
  note?: string | null
}

export interface LotMovement {
  id: string
  lot_id: string
  movement_type: LotMovementType
  qty_delta: number
  happened_at: string
  sale_id: string | null
  note: string | null
  created_at: string
}

export interface CreateLotMovementRequest {
  lot_id: string
  movement_type: LotMovementType
  qty_delta: number
  happened_at: string
  sale_id?: string | null
  note?: string | null
}

export const productLotsService = {
  /**
   * Crea un nuevo lote de producto
   */
  async createLot(data: CreateProductLotRequest): Promise<ProductLot> {
    const response = await api.post<ProductLot>('/product-lots', data)
    return response.data
  },

  /**
   * Obtiene todos los lotes de un producto
   */
  async getLotsByProduct(productId: string): Promise<ProductLot[]> {
    const response = await api.get<ProductLot[]>(`/product-lots/product/${productId}`)
    return response.data
  },

  /**
   * Obtiene un lote por su ID
   */
  async getLotById(id: string): Promise<ProductLot> {
    const response = await api.get<ProductLot>(`/product-lots/${id}`)
    return response.data
  },

  /**
   * Obtiene lotes próximos a vencer
   */
  async getLotsExpiringSoon(days: number = 30): Promise<ProductLot[]> {
    const response = await api.get<ProductLot[]>(`/product-lots/expiring/soon?days=${days}`)
    return response.data
  },

  /**
   * Obtiene lotes vencidos
   */
  async getExpiredLots(): Promise<ProductLot[]> {
    const response = await api.get<ProductLot[]>('/product-lots/expired')
    return response.data
  },

  /**
   * Crea un movimiento de lote
   */
  async createLotMovement(data: CreateLotMovementRequest): Promise<LotMovement> {
    const response = await api.post<LotMovement>('/product-lots/movements', data)
    return response.data
  },

  /**
   * Obtiene los movimientos de un lote
   */
  async getLotMovements(lotId: string): Promise<LotMovement[]> {
    const response = await api.get<LotMovement[]>(`/product-lots/${lotId}/movements`)
    return response.data
  },
}

