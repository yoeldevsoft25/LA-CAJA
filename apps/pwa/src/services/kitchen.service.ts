import { api } from '@/lib/api'

export interface KitchenOrderItem {
  id: string
  product_name: string
  qty: number
  note: string | null
  status: 'pending' | 'preparing' | 'ready'
  added_at: string
}

export interface KitchenOrder {
  id: string
  order_number: string
  table_number: string
  table_name: string | null
  items: KitchenOrderItem[]
  created_at: string
  elapsed_time: number
}

export const kitchenService = {
  /**
   * Obtiene todas las órdenes abiertas para la cocina
   */
  async getKitchenOrders(): Promise<KitchenOrder[]> {
    const response = await api.get<KitchenOrder[]>('/kitchen/orders')
    return response.data
  },

  /**
   * Obtiene una orden específica para la cocina
   */
  async getKitchenOrder(orderId: string): Promise<KitchenOrder | null> {
    const response = await api.get<{ success: boolean; order?: KitchenOrder }>(
      `/kitchen/orders/${orderId}`
    )
    return response.data.order || null
  },

  /**
   * Actualiza el estado de un item de orden
   */
  async updateOrderItemStatus(
    orderId: string,
    itemId: string,
    status: 'pending' | 'preparing' | 'ready'
  ): Promise<{ success: boolean; item: { id: string; status: string } }> {
    const response = await api.put<{ success: boolean; item: { id: string; status: string } }>(
      `/kitchen/orders/${orderId}/items/${itemId}/status`,
      { status }
    )
    return response.data
  },
}
