import { api } from '@/lib/api'

export interface Warehouse {
  id: string
  store_id: string
  name: string
  code: string
  description: string | null
  address: string | null
  is_default: boolean
  is_active: boolean
  note: string | null
  created_at: string
  updated_at: string
}

export interface WarehouseStock {
  id: string
  warehouse_id: string
  product_id: string
  variant_id: string | null
  stock: number
  reserved: number
  updated_at: string
  product?: {
    id: string
    name: string
    sku: string | null
    barcode: string | null
  }
  variant?: {
    id: string
    variant_type: string
    variant_value: string
  } | null
}

export interface CreateWarehouseDto {
  name: string
  code: string
  description?: string
  address?: string
  is_default?: boolean
  note?: string
}

export interface UpdateWarehouseDto {
  name?: string
  code?: string
  description?: string
  address?: string
  is_default?: boolean
  is_active?: boolean
  note?: string
}

export const warehousesService = {
  async create(data: CreateWarehouseDto): Promise<Warehouse> {
    const response = await api.post<Warehouse>('/warehouses', data)
    return response.data
  },

  async getAll(includeInactive = false): Promise<Warehouse[]> {
    const response = await api.get<Warehouse[]>('/warehouses', {
      params: includeInactive ? { include_inactive: 'true' } : {},
    })
    return response.data
  },

  async getDefault(): Promise<Warehouse | null> {
    try {
      const response = await api.get<Warehouse>('/warehouses/default')
      return response.data
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        return null
      }
      throw error
    }
  },

  async getById(id: string): Promise<Warehouse> {
    const response = await api.get<Warehouse>(`/warehouses/${id}`)
    return response.data
  },

  async getStock(warehouseId: string, productId?: string): Promise<WarehouseStock[]> {
    const params = productId ? { product_id: productId } : {}
    const response = await api.get<WarehouseStock[]>(`/warehouses/${warehouseId}/stock`, {
      params,
    })
    return response.data
  },

  async update(id: string, data: UpdateWarehouseDto): Promise<Warehouse> {
    const response = await api.patch<Warehouse>(`/warehouses/${id}`, data)
    return response.data
  },

  async deactivate(id: string): Promise<Warehouse> {
    const response = await api.patch<Warehouse>(`/warehouses/${id}`, { is_active: false })
    return response.data
  },

  async activate(id: string): Promise<Warehouse> {
    const response = await api.patch<Warehouse>(`/warehouses/${id}`, { is_active: true })
    return response.data
  },
}
