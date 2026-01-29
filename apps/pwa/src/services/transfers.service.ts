import { api } from '@/lib/api'

/**
 * Estado de transferencia
 */
export type TransferStatus = 'pending' | 'in_transit' | 'completed' | 'cancelled'

/**
 * Item de transferencia
 */
export interface TransferItem {
  id: string
  transfer_id: string
  product_id: string
  variant_id: string | null
  quantity: number
  quantity_shipped: number
  quantity_received: number
  unit_cost_bs: number | string
  unit_cost_usd: number | string
  note: string | null
  created_at: string
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
 * Transferencia
 */
export interface Transfer {
  id: string
  store_id: string
  transfer_number: string
  from_warehouse_id: string
  to_warehouse_id: string
  status: TransferStatus
  requested_by: string | null
  requested_at: string
  shipped_by: string | null
  shipped_at: string | null
  received_by: string | null
  received_at: string | null
  note: string | null
  created_at: string
  updated_at: string
  from_warehouse?: {
    id: string
    name: string
    code: string
  }
  to_warehouse?: {
    id: string
    name: string
    code: string
  }
  requested_by_user?: {
    id: string
    full_name: string | null
  }
  shipped_by_user?: {
    id: string
    full_name: string | null
  }
  received_by_user?: {
    id: string
    full_name: string | null
  }
  items: TransferItem[]

  // Logistics
  driver_name?: string | null
  vehicle_plate?: string | null
  tracking_number?: string | null
  shipping_cost?: number
  priority: 'low' | 'normal' | 'high' | 'urgent'
  expected_arrival?: string | null
}

/**
 * DTO para crear una transferencia
 */
export interface CreateTransferItemDto {
  product_id: string
  variant_id?: string | null
  quantity: number
  unit_cost_bs?: number
  unit_cost_usd?: number
  note?: string
}

export interface CreateTransferDto {
  from_warehouse_id: string
  to_warehouse_id: string
  items: CreateTransferItemDto[]
  note?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  expected_arrival?: string
}

/**
 * DTO para enviar una transferencia
 */
export interface ShipTransferItemDto {
  quantity_shipped: number
}

export interface ShipTransferDto {
  items: ShipTransferItemDto[]
  note?: string
  driver_name?: string
  vehicle_plate?: string
  tracking_number?: string
  shipping_cost?: number
}

/**
 * DTO para recibir una transferencia
 */
export interface ReceiveTransferItemDto {
  quantity_received: number
}

export interface ReceiveTransferDto {
  items: ReceiveTransferItemDto[]
  note?: string
}

export const transfersService = {
  /**
   * Crea una nueva transferencia
   */
  async create(data: CreateTransferDto): Promise<Transfer> {
    const response = await api.post<Transfer>('/transfers', data)
    return response.data
  },

  /**
   * Obtiene todas las transferencias
   */
  async getAll(status?: TransferStatus, warehouseId?: string): Promise<Transfer[]> {
    const params: Record<string, string> = {}
    if (status) params.status = status
    if (warehouseId) params.warehouse_id = warehouseId

    const response = await api.get<Transfer[]>('/transfers', { params })
    return response.data
  },

  /**
   * Obtiene una transferencia por ID
   */
  async getById(id: string): Promise<Transfer> {
    const response = await api.get<Transfer>(`/transfers/${id}`)
    return response.data
  },

  /**
   * Marca una transferencia como enviada
   */
  async ship(id: string, data: ShipTransferDto): Promise<Transfer> {
    const response = await api.put<Transfer>(`/transfers/${id}/ship`, data)
    return response.data
  },

  /**
   * Marca una transferencia como recibida
   */
  async receive(id: string, data: ReceiveTransferDto): Promise<Transfer> {
    const response = await api.put<Transfer>(`/transfers/${id}/receive`, data)
    return response.data
  },

  /**
   * Cancela una transferencia
   */
  async cancel(id: string): Promise<Transfer> {
    const response = await api.put<Transfer>(`/transfers/${id}/cancel`, {})
    return response.data
  },
}

