import { api } from '@/lib/api'

/**
 * Promoción
 */
export interface Promotion {
  id: string
  store_id: string
  name: string
  code: string | null
  description: string | null
  promotion_type: 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'bundle'
  discount_percentage: number | null
  discount_amount_bs: number | null
  discount_amount_usd: number | null
  min_purchase_bs: number | null
  min_purchase_usd: number | null
  max_discount_bs: number | null
  max_discount_usd: number | null
  valid_from: string
  valid_until: string
  is_active: boolean
  usage_limit: number | null
  usage_count: number
  customer_limit: number | null
  note: string | null
  created_at: string
  updated_at: string
  products?: PromotionProduct[]
}

/**
 * Producto en promoción
 */
export interface PromotionProduct {
  id: string
  promotion_id: string
  product_id: string
  variant_id: string | null
  created_at: string
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
 * DTO para crear una promoción
 */
export interface CreatePromotionDto {
  name: string
  code?: string | null
  description?: string | null
  promotion_type: 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'bundle'
  discount_percentage?: number | null
  discount_amount_bs?: number | null
  discount_amount_usd?: number | null
  min_purchase_bs?: number | null
  min_purchase_usd?: number | null
  max_discount_bs?: number | null
  max_discount_usd?: number | null
  valid_from: string
  valid_until: string
  is_active?: boolean
  usage_limit?: number | null
  customer_limit?: number | null
  products?: Array<{
    product_id: string
    variant_id?: string | null
  }>
  note?: string | null
}

/**
 * Resultado de validación de promoción
 */
export interface PromotionValidationResult {
  valid: boolean
  discount_bs: number
  discount_usd: number
  message?: string
}

export const promotionsService = {
  /**
   * Crea una nueva promoción
   */
  async create(data: CreatePromotionDto): Promise<Promotion> {
    const response = await api.post<Promotion>('/promotions', data)
    return response.data
  },

  /**
   * Obtiene todas las promociones activas
   */
  async getActive(): Promise<Promotion[]> {
    const response = await api.get<Promotion[]>('/promotions/active')
    return response.data
  },

  /**
   * Obtiene una promoción por ID
   */
  async getById(id: string): Promise<Promotion> {
    const response = await api.get<Promotion>(`/promotions/${id}`)
    return response.data
  },

  /**
   * Obtiene una promoción por código
   */
  async getByCode(code: string): Promise<Promotion> {
    const response = await api.get<Promotion>(`/promotions/code/${code}`)
    return response.data
  },

  /**
   * Valida una promoción antes de aplicarla
   */
  async validate(
    id: string,
    subtotal_bs: number,
    subtotal_usd: number,
    customer_id?: string | null
  ): Promise<PromotionValidationResult> {
    const response = await api.post<PromotionValidationResult>(`/promotions/${id}/validate`, {
      subtotal_bs,
      subtotal_usd,
      customer_id,
    })
    return response.data
  },

  /**
   * Obtiene promociones aplicables a productos
   */
  async getApplicable(
    product_ids: string[],
    variant_ids?: (string | null)[]
  ): Promise<Promotion[]> {
    const response = await api.post<Promotion[]>('/promotions/applicable', {
      product_ids,
      variant_ids: variant_ids || [],
    })
    return response.data
  },
}

