import { api } from '@/lib/api'

export type SerialStatus = 'available' | 'sold' | 'returned' | 'damaged'

export interface ProductSerial {
  id: string
  product_id: string
  serial_number: string
  status: SerialStatus
  sale_id: string | null
  sale_item_id: string | null
  received_at: string
  sold_at: string | null
  note: string | null
  created_at: string
  updated_at: string
  product?: {
    id: string
    name: string
  }
}

export interface CreateProductSerialRequest {
  product_id: string
  serial_number: string
  received_at: string
  note?: string | null
}

export interface CreateSerialsBatchRequest {
  product_id: string
  serial_numbers: string[]
  received_at: string
}

export interface AssignSerialsRequest {
  sale_id: string
  sale_item_id: string
  serial_numbers: string[]
}

export const productSerialsService = {
  /**
   * Crea un nuevo serial de producto
   */
  async createSerial(data: CreateProductSerialRequest): Promise<ProductSerial> {
    const response = await api.post<ProductSerial>('/product-serials', data)
    return response.data
  },

  /**
   * Crea múltiples seriales en lote
   */
  async createSerialsBatch(data: CreateSerialsBatchRequest): Promise<ProductSerial[]> {
    const response = await api.post<ProductSerial[]>('/product-serials/batch', data)
    return response.data
  },

  /**
   * Obtiene todos los seriales de un producto
   */
  async getSerialsByProduct(
    productId: string,
    status?: SerialStatus
  ): Promise<ProductSerial[]> {
    const params = status ? `?status=${status}` : ''
    const response = await api.get<ProductSerial[]>(
      `/product-serials/product/${productId}${params}`
    )
    return response.data
  },

  /**
   * Obtiene un serial por su número
   */
  async getSerialByNumber(
    productId: string,
    serialNumber: string
  ): Promise<ProductSerial> {
    const response = await api.get<ProductSerial>(
      `/product-serials/product/${productId}/serial/${encodeURIComponent(serialNumber)}`
    )
    return response.data
  },

  /**
   * Obtiene seriales disponibles de un producto
   */
  async getAvailableSerials(
    productId: string,
    quantity: number = 1
  ): Promise<ProductSerial[]> {
    const response = await api.get<ProductSerial[]>(
      `/product-serials/product/${productId}/available?quantity=${quantity}`
    )
    return response.data
  },

  /**
   * Asigna seriales a una venta
   */
  async assignSerialsToSale(data: AssignSerialsRequest): Promise<ProductSerial[]> {
    const response = await api.post<ProductSerial[]>('/product-serials/assign', data)
    return response.data
  },

  /**
   * Marca un serial como devuelto
   */
  async returnSerial(id: string): Promise<ProductSerial> {
    const response = await api.put<ProductSerial>(`/product-serials/${id}/return`, {})
    return response.data
  },

  /**
   * Marca un serial como dañado
   */
  async markSerialAsDamaged(id: string, note?: string): Promise<ProductSerial> {
    const response = await api.put<ProductSerial>(`/product-serials/${id}/damaged`, { note })
    return response.data
  },

  /**
   * Obtiene los seriales de una venta
   */
  async getSerialsBySale(saleId: string): Promise<ProductSerial[]> {
    const response = await api.get<ProductSerial[]>(`/product-serials/sale/${saleId}`)
    return response.data
  },

  /**
   * Obtiene los seriales de un item de venta
   */
  async getSerialsBySaleItem(saleItemId: string): Promise<ProductSerial[]> {
    const response = await api.get<ProductSerial[]>(
      `/product-serials/sale-item/${saleItemId}`
    )
    return response.data
  },
}

