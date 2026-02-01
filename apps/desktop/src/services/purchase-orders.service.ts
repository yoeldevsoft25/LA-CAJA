import { api } from '@/lib/api'

/**
 * Estado de orden de compra
 */
export type PurchaseOrderStatus = 'draft' | 'sent' | 'confirmed' | 'partial' | 'completed' | 'cancelled'

/**
 * Item de orden de compra
 */
export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  product_id: string
  variant_id: string | null
  quantity: number
  quantity_received: number
  unit_cost_bs: number | string
  unit_cost_usd: number | string
  total_cost_bs: number | string
  total_cost_usd: number | string
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
 * Orden de compra
 */
export interface PurchaseOrder {
  id: string
  store_id: string
  order_number: string
  supplier_id: string
  warehouse_id: string | null
  status: PurchaseOrderStatus
  expected_delivery_date: string | null
  requested_by: string | null
  requested_at: string
  sent_at: string | null
  confirmed_at: string | null
  received_by: string | null
  received_at: string | null
  total_amount_bs: number | string
  total_amount_usd: number | string
  note: string | null
  created_at: string
  updated_at: string
  supplier?: {
    id: string
    name: string
    code: string | null
  }
  warehouse?: {
    id: string
    name: string
    code: string
  }
  requester?: {
    id: string
    full_name: string | null
  }
  receiver?: {
    id: string
    full_name: string | null
  }
  items: PurchaseOrderItem[]
}

/**
 * DTO para crear un item de orden de compra
 */
export interface CreatePurchaseOrderItemDto {
  product_id: string
  variant_id?: string | null
  quantity: number
  unit_cost_bs: number
  unit_cost_usd: number
  note?: string
}

/**
 * DTO para crear una orden de compra
 */
export interface CreatePurchaseOrderDto {
  supplier_id: string
  warehouse_id?: string | null
  expected_delivery_date?: string | null
  items: CreatePurchaseOrderItemDto[]
  note?: string
}

/**
 * DTO para recibir un item de orden de compra
 */
export interface ReceivePurchaseOrderItemDto {
  quantity_received: number
}

/**
 * DTO para recibir una orden de compra
 */
export interface ReceivePurchaseOrderDto {
  items: ReceivePurchaseOrderItemDto[]
  note?: string
}

export const purchaseOrdersService = {
  /**
   * Obtiene todas las órdenes de compra
   */
  async getAll(
    status?: PurchaseOrderStatus,
    supplierId?: string,
    warehouseId?: string
  ): Promise<PurchaseOrder[]> {
    const params: Record<string, string> = {}
    if (status) params.status = status
    if (supplierId) params.supplier_id = supplierId
    if (warehouseId) params.warehouse_id = warehouseId

    const response = await api.get<PurchaseOrder[]>('/purchase-orders', { params })
    return response.data
  },

  /**
   * Obtiene una orden de compra por ID
   */
  async getById(id: string): Promise<PurchaseOrder> {
    const response = await api.get<PurchaseOrder>(`/purchase-orders/${id}`)
    return response.data
  },

  /**
   * Crea una nueva orden de compra
   */
  async create(data: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    const response = await api.post<PurchaseOrder>('/purchase-orders', data)
    return response.data
  },

  /**
   * Envía una orden al proveedor (cambia estado de draft a sent)
   */
  async send(id: string): Promise<PurchaseOrder> {
    const response = await api.put<PurchaseOrder>(`/purchase-orders/${id}/send`, {})
    return response.data
  },

  /**
   * Confirma una orden (cambia estado de sent a confirmed)
   */
  async confirm(id: string): Promise<PurchaseOrder> {
    const response = await api.put<PurchaseOrder>(`/purchase-orders/${id}/confirm`, {})
    return response.data
  },

  /**
   * Recibe una orden de compra (cambia estado a completed/partial y actualiza inventario)
   */
  async receive(id: string, data: ReceivePurchaseOrderDto): Promise<PurchaseOrder> {
    const response = await api.put<PurchaseOrder>(`/purchase-orders/${id}/receive`, data)
    return response.data
  },

  /**
   * Cancela una orden de compra
   */
  async cancel(id: string): Promise<PurchaseOrder> {
    const response = await api.put<PurchaseOrder>(`/purchase-orders/${id}/cancel`, {})
    return response.data
  },
}

