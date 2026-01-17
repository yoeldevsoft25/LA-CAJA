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
  async createSerial(data: CreateProductSerialRequest): Promise<ProductSerial> {
    const response = await api.post<ProductSerial>('/product-serials', data)
    return response.data
  },

  async createSerialsBatch(data: CreateSerialsBatchRequest): Promise<ProductSerial[]> {
    const response = await api.post<ProductSerial[]>('/product-serials/batch', data)
    return response.data
  },

  async getSerialsByProduct(productId: string, status?: SerialStatus): Promise<ProductSerial[]> {
    const params = status ? `?status=${status}` : ''
    const response = await api.get<ProductSerial[]>(
      `/product-serials/product/${productId}${params}`
    )
    return response.data
  },

  async getSerialByNumber(productId: string, serialNumber: string): Promise<ProductSerial> {
    const response = await api.get<ProductSerial>(
      `/product-serials/product/${productId}/serial/${encodeURIComponent(serialNumber)}`
    )
    return response.data
  },

  async getAvailableSerials(productId: string, quantity: number = 1): Promise<ProductSerial[]> {
    const response = await api.get<ProductSerial[]>(
      `/product-serials/product/${productId}/available?quantity=${quantity}`
    )
    return response.data
  },

  async assignSerialsToSale(data: AssignSerialsRequest): Promise<ProductSerial[]> {
    const response = await api.post<ProductSerial[]>('/product-serials/assign', data)
    return response.data
  },

  async returnSerial(id: string): Promise<ProductSerial> {
    const response = await api.put<ProductSerial>(`/product-serials/${id}/return`, {})
    return response.data
  },

  async markSerialAsDamaged(id: string, note?: string): Promise<ProductSerial> {
    const response = await api.put<ProductSerial>(`/product-serials/${id}/damaged`, { note })
    return response.data
  },
}
