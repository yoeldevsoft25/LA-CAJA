import { api } from '@/lib/api'

export type AuthorizationRole = 'owner' | 'admin' | 'supervisor' | 'cashier'

export interface DiscountConfig {
  id: string
  store_id: string
  max_percentage: number | string
  max_amount_bs: number | string | null
  max_amount_usd: number | string | null
  requires_authorization: boolean
  authorization_role: AuthorizationRole | null
  auto_approve_below_percentage: number | string | null
  auto_approve_below_amount_bs: number | string | null
  created_at: string
  updated_at: string
}

export interface CreateDiscountConfigRequest {
  max_percentage?: number
  max_amount_bs?: number | null
  max_amount_usd?: number | null
  requires_authorization?: boolean
  authorization_role?: AuthorizationRole | null
  auto_approve_below_percentage?: number | null
  auto_approve_below_amount_bs?: number | null
}

export interface DiscountAuthorization {
  id: string
  sale_id: string
  store_id: string
  discount_amount_bs: number | string
  discount_amount_usd: number | string
  discount_percentage: number | string
  authorized_by: string
  authorization_pin_hash: string | null
  reason: string | null
  authorized_at: string
}

export interface AuthorizeDiscountRequest {
  sale_id: string
  reason?: string | null
  authorization_pin?: string
}

export interface DiscountAuthorizationsResponse {
  authorizations: DiscountAuthorization[]
  total: number
}

export interface DiscountSummary {
  total_discounts_bs: number
  total_discounts_usd: number
  average_percentage: number
  total_authorizations: number
  by_authorizer: Array<{
    authorizer_id: string
    authorizer_name: string
    count: number
    total_bs: number
    total_usd: number
  }>
}

export const discountsService = {
  /**
   * Crea o actualiza configuración de descuentos
   */
  async upsertDiscountConfig(data: CreateDiscountConfigRequest): Promise<DiscountConfig> {
    const response = await api.put<DiscountConfig>('/discounts/config', data)
    return response.data
  },

  /**
   * Obtiene la configuración de descuentos
   */
  async getDiscountConfig(): Promise<DiscountConfig | null> {
    const response = await api.get<DiscountConfig | null>('/discounts/config')
    return response.data
  },

  /**
   * Autoriza un descuento en una venta
   */
  async authorizeDiscount(data: AuthorizeDiscountRequest): Promise<DiscountAuthorization> {
    const response = await api.post<DiscountAuthorization>('/discounts/authorize', data)
    return response.data
  },

  /**
   * Obtiene las autorizaciones de una venta
   */
  async getAuthorizationsBySale(saleId: string): Promise<DiscountAuthorization[]> {
    const response = await api.get<DiscountAuthorization[]>(`/discounts/authorizations/sale/${saleId}`)
    return response.data
  },

  /**
   * Obtiene todas las autorizaciones de la tienda
   */
  async getAuthorizations(params?: {
    limit?: number
    offset?: number
    start_date?: string
    end_date?: string
  }): Promise<DiscountAuthorizationsResponse> {
    const response = await api.get<DiscountAuthorizationsResponse>('/discounts/authorizations', { params })
    return response.data
  },

  /**
   * Obtiene resumen de descuentos autorizados
   */
  async getDiscountSummary(params?: {
    start_date?: string
    end_date?: string
  }): Promise<DiscountSummary> {
    const response = await api.get<DiscountSummary>('/discounts/summary', { params })
    return response.data
  },
}

