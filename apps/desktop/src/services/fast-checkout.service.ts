import { api } from '@/lib/api'

export type PaymentMethod = 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER'

export interface FastCheckoutConfig {
  id: string
  store_id: string
  max_items: number
  enabled: boolean
  allow_discounts: boolean
  allow_customer_selection: boolean
  default_payment_method: PaymentMethod | null
  created_at: string
  updated_at: string
}

export interface CreateFastCheckoutConfigRequest {
  max_items?: number
  enabled?: boolean
  allow_discounts?: boolean
  allow_customer_selection?: boolean
  default_payment_method?: PaymentMethod | null
}

export interface QuickProduct {
  id: string
  store_id: string
  product_id: string
  quick_key: string
  position: number
  is_active: boolean
  created_at: string
  updated_at: string
  product?: {
    id: string
    name: string
    price_bs: number | string
    price_usd: number | string
    barcode?: string | null
    is_weight_product?: boolean
    weight_unit?: 'kg' | 'g' | 'lb' | 'oz' | null
    price_per_weight_bs?: number | string | null
    price_per_weight_usd?: number | string | null
    min_weight?: number | string | null
    max_weight?: number | string | null
  }
}

export interface CreateQuickProductRequest {
  product_id: string
  quick_key: string
  position?: number
  is_active?: boolean
}

export const fastCheckoutService = {
  /**
   * Crea o actualiza configuración de caja rápida
   */
  async upsertFastCheckoutConfig(
    data: CreateFastCheckoutConfigRequest
  ): Promise<FastCheckoutConfig> {
    const response = await api.put<FastCheckoutConfig>('/fast-checkout/config', data)
    return response.data
  },

  /**
   * Obtiene la configuración de caja rápida
   */
  async getFastCheckoutConfig(): Promise<FastCheckoutConfig | null> {
    const response = await api.get<FastCheckoutConfig | null>('/fast-checkout/config')
    return response.data
  },

  /**
   * Crea o actualiza un producto rápido
   */
  async upsertQuickProduct(data: CreateQuickProductRequest): Promise<QuickProduct> {
    const response = await api.put<QuickProduct>('/fast-checkout/quick-products', data)
    return response.data
  },

  /**
   * Obtiene todos los productos rápidos
   */
  async getQuickProducts(): Promise<QuickProduct[]> {
    const response = await api.get<QuickProduct[]>('/fast-checkout/quick-products')
    return response.data
  },

  /**
   * Obtiene un producto rápido por tecla
   */
  async getQuickProductByKey(key: string): Promise<QuickProduct | null> {
    const response = await api.get<QuickProduct | null>(`/fast-checkout/quick-products/key/${key}`)
    return response.data
  },

  /**
   * Elimina un producto rápido
   */
  async deleteQuickProduct(id: string): Promise<void> {
    await api.delete(`/fast-checkout/quick-products/${id}`)
  },

  /**
   * Desactiva un producto rápido
   */
  async deactivateQuickProduct(id: string): Promise<QuickProduct> {
    const response = await api.post<QuickProduct>(`/fast-checkout/quick-products/${id}/deactivate`)
    return response.data
  },

  /**
   * Reordena productos rápidos
   */
  async reorderQuickProducts(quickProductIds: string[]): Promise<QuickProduct[]> {
    const response = await api.post<QuickProduct[]>('/fast-checkout/quick-products/reorder', {
      quick_product_ids: quickProductIds,
    })
    return response.data
  },
}
