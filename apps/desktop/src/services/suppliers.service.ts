import { api } from '@/lib/api'

export interface Supplier {
  id: string
  store_id: string
  name: string
  code: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  tax_id: string | null
  payment_terms: string | null
  is_active: boolean
  note: string | null
  created_at: string
  updated_at: string
}

export interface SupplierStatistics {
  total_orders: number
  total_amount_bs: number
  total_amount_usd: number
  pending_orders: number
  completed_orders: number
  last_order_date: string | null
}

export interface CreateSupplierDto {
  name: string
  code?: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
  tax_id?: string
  payment_terms?: string
  note?: string
}

export interface UpdateSupplierDto {
  name?: string
  code?: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
  tax_id?: string
  payment_terms?: string
  is_active?: boolean
  note?: string
}

export const suppliersService = {
  /**
   * Obtiene todos los proveedores
   */
  async getAll(includeInactive = false): Promise<Supplier[]> {
    const response = await api.get<Supplier[]>('/suppliers', {
      params: includeInactive ? { include_inactive: 'true' } : {},
    })
    return response.data
  },

  /**
   * Obtiene un proveedor por ID
   */
  async getById(id: string): Promise<Supplier> {
    const response = await api.get<Supplier>(`/suppliers/${id}`)
    return response.data
  },

  /**
   * Obtiene estadísticas de un proveedor
   */
  async getStatistics(id: string): Promise<SupplierStatistics> {
    const response = await api.get<SupplierStatistics>(`/suppliers/${id}/statistics`)
    return response.data
  },

  /**
   * Obtiene las órdenes de compra de un proveedor
   */
  async getPurchaseOrders(id: string, status?: string): Promise<any[]> {
    const response = await api.get<any[]>(`/suppliers/${id}/purchase-orders`, {
      params: status ? { status } : {},
    })
    return response.data
  },

  /**
   * Crea un nuevo proveedor
   */
  async create(data: CreateSupplierDto): Promise<Supplier> {
    const response = await api.post<Supplier>('/suppliers', data)
    return response.data
  },

  /**
   * Actualiza un proveedor
   */
  async update(id: string, data: UpdateSupplierDto): Promise<Supplier> {
    const response = await api.put<Supplier>(`/suppliers/${id}`, data)
    return response.data
  },

  /**
   * Elimina un proveedor (soft delete)
   */
  async remove(id: string): Promise<void> {
    await api.delete(`/suppliers/${id}`)
  },
}

