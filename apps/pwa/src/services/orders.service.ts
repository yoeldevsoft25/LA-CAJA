import { api } from '@/lib/api'
import { CreateSaleRequest } from './sales.service'

export type OrderStatus = 'open' | 'paused' | 'closed' | 'cancelled'

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  variant_id: string | null
  qty: number
  unit_price_bs: number | string
  unit_price_usd: number | string
  discount_bs: number | string
  discount_usd: number | string
  note: string | null
  added_at: string
  created_at: string
  product?: {
    id: string
    name: string
    sku?: string | null
    barcode?: string | null
  } | null
  variant?: {
    id: string
    variant_type: string
    variant_value: string
  } | null
}

export interface OrderPayment {
  id: string
  order_id: string
  sale_id: string | null
  amount_bs: number | string
  amount_usd: number | string
  payment_method: string
  paid_at: string
  paid_by_user_id: string | null
  note: string | null
  created_at: string
}

export interface Order {
  id: string
  store_id: string
  table_id: string | null
  order_number: string
  status: OrderStatus
  opened_at: string
  paused_at: string | null
  closed_at: string | null
  customer_id: string | null
  opened_by_user_id: string | null
  closed_by_user_id: string | null
  note: string | null
  created_at: string
  updated_at: string
  table?: {
    id: string
    table_number: string
    name: string | null
  } | null
  customer?: {
    id: string
    name: string
    document_id: string | null
  } | null
  items: OrderItem[]
  payments: OrderPayment[]
}

export interface CreateOrderRequest {
  table_id?: string | null
  customer_id?: string | null
  note?: string | null
  items?: {
    product_id: string
    variant_id?: string | null
    qty: number
    discount_bs?: number
    discount_usd?: number
    note?: string | null
  }[]
}

export interface AddOrderItemRequest {
  product_id: string
  variant_id?: string | null
  qty: number
  discount_bs?: number
  discount_usd?: number
  note?: string | null
}

export interface CreatePartialPaymentRequest {
  amount_bs: number
  amount_usd: number
  payment_method: 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER' | 'SPLIT'
  note?: string | null
  customer_id?: string
}

export interface MoveOrderRequest {
  table_id?: string | null
}

export interface MergeOrdersRequest {
  order_ids: string[]
  target_order_id: string
}

export const ordersService = {
  /**
   * Crea una nueva orden
   */
  async createOrder(data: CreateOrderRequest): Promise<Order> {
    const response = await api.post<Order>('/orders', data)
    return response.data
  },

  /**
   * Obtiene todas las órdenes abiertas
   */
  async getOpenOrders(): Promise<Order[]> {
    const response = await api.get<Order[]>('/orders/open')
    return response.data
  },

  /**
   * Obtiene una orden por ID
   */
  async getOrderById(id: string): Promise<Order> {
    const response = await api.get<Order>(`/orders/${id}`)
    return response.data
  },

  /**
   * Agrega un item a una orden
   */
  async addOrderItem(orderId: string, data: AddOrderItemRequest): Promise<OrderItem> {
    const response = await api.post<OrderItem>(`/orders/${orderId}/items`, data)
    return response.data
  },

  /**
   * Elimina un item de una orden
   */
  async removeOrderItem(orderId: string, itemId: string): Promise<void> {
    await api.put(`/orders/${orderId}/items/${itemId}`, {})
  },

  /**
   * Pausa una orden
   */
  async pauseOrder(orderId: string): Promise<Order> {
    const response = await api.put<Order>(`/orders/${orderId}/pause`, {})
    return response.data
  },

  /**
   * Reanuda una orden pausada
   */
  async resumeOrder(orderId: string): Promise<Order> {
    const response = await api.put<Order>(`/orders/${orderId}/resume`, {})
    return response.data
  },

  /**
   * Mueve una orden a otra mesa
   */
  async moveOrder(orderId: string, data: MoveOrderRequest): Promise<Order> {
    const response = await api.put<Order>(`/orders/${orderId}/move`, data)
    return response.data
  },

  /**
   * Fusiona múltiples órdenes
   */
  async mergeOrders(data: MergeOrdersRequest): Promise<Order> {
    const response = await api.post<Order>('/orders/merge', data)
    return response.data
  },

  /**
   * Crea un pago parcial (recibo parcial)
   */
  async createPartialPayment(
    orderId: string,
    data: CreatePartialPaymentRequest
  ): Promise<OrderPayment> {
    const response = await api.post<OrderPayment>(`/orders/${orderId}/payments/partial`, data)
    return response.data
  },

  /**
   * Cierra una orden completa (genera venta final)
   */
  async closeOrder(orderId: string, saleData: CreateSaleRequest): Promise<any> {
    const response = await api.post(`/orders/${orderId}/close`, saleData)
    return response.data
  },

  /**
   * Cancela una orden
   */
  async cancelOrder(orderId: string): Promise<Order> {
    const response = await api.put<Order>(`/orders/${orderId}/cancel`, {})
    return response.data
  },
}

