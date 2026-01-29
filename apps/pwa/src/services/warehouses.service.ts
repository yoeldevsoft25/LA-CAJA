import { api } from '@/lib/api'

/**
 * Bodega/Almacén
 */
export interface Warehouse {
  id: string
  store_id: string
  name: string
  code: string
  type: string
  description: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  manager_name: string | null
  contact_phone: string | null
  contact_email: string | null
  capacity: number
  is_default: boolean
  is_active: boolean
  status: string
  note: string | null
  created_at: string
  updated_at: string
}

/**
 * Stock por bodega
 */
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

/**
 * DTO para crear una bodega
 */
export interface CreateWarehouseDto {
  name: string
  code: string
  type?: string
  description?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  manager_name?: string
  contact_phone?: string
  contact_email?: string
  capacity?: number
  is_default?: boolean
  status?: string
  note?: string
}

/**
 * DTO para actualizar una bodega
 */
export interface UpdateWarehouseDto {
  name?: string
  code?: string
  type?: string
  description?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  manager_name?: string
  contact_phone?: string
  contact_email?: string
  capacity?: number
  is_default?: boolean
  is_active?: boolean
  status?: string
  note?: string
}

export const warehousesService = {
  /**
   * Crea una nueva bodega
   */
  async create(data: CreateWarehouseDto): Promise<Warehouse> {
    const response = await api.post<Warehouse>('/warehouses', data)
    return response.data
  },

  /**
   * Obtiene todas las bodegas
   */
  async getAll(includeInactive = false): Promise<Warehouse[]> {
    const response = await api.get<Warehouse[]>('/warehouses', {
      params: includeInactive ? { include_inactive: 'true' } : {},
    })
    return response.data
  },

  /**
   * Obtiene la bodega por defecto
   */
  async getDefault(): Promise<Warehouse | null> {
    try {
      const response = await api.get<Warehouse>('/warehouses/default')
      return response.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  /**
   * Obtiene una bodega por ID
   */
  async getById(id: string): Promise<Warehouse> {
    const response = await api.get<Warehouse>(`/warehouses/${id}`)
    return response.data
  },

  /**
   * Obtiene el stock de una bodega
   */
  async getStock(warehouseId: string, productId?: string): Promise<WarehouseStock[]> {
    const params = productId ? { product_id: productId } : {}
    const response = await api.get<WarehouseStock[]>(`/warehouses/${warehouseId}/stock`, {
      params,
    })
    return response.data
  },

  /**
   * Actualiza una bodega
   */
  async update(id: string, data: UpdateWarehouseDto): Promise<Warehouse> {
    const response = await api.put<Warehouse>(`/warehouses/${id}`, data)
    return response.data
  },

  /**
   * Elimina una bodega (soft delete)
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/warehouses/${id}`)
  },
}

