import { api } from '@/lib/api'

export type PaymentMethod = 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER'

export interface PaymentMethodConfig {
  id: string
  store_id: string
  method: PaymentMethod
  min_amount_bs: number | null
  min_amount_usd: number | null
  max_amount_bs: number | null
  max_amount_usd: number | null
  enabled: boolean
  requires_authorization: boolean
  sort_order?: number | null
  commission_percentage?: number | null
  created_at: string
  updated_at: string
}

export interface CreatePaymentMethodConfigRequest {
  method: PaymentMethod
  min_amount_bs?: number | null
  min_amount_usd?: number | null
  max_amount_bs?: number | null
  max_amount_usd?: number | null
  enabled?: boolean
  requires_authorization?: boolean
  sort_order?: number | null
  commission_percentage?: number | null
}

export interface CashMovement {
  id: string
  store_id: string
  shift_id: string | null
  cash_session_id: string | null
  movement_type: 'entry' | 'exit'
  amount_bs: number | string
  amount_usd: number | string
  reason: string
  note: string | null
  created_by: string
  created_at: string
}

export interface CreateCashMovementRequest {
  movement_type: 'entry' | 'exit'
  amount_bs: number
  amount_usd: number
  reason: string
  shift_id?: string | null
  cash_session_id?: string | null
  note?: string | null
}

export interface CashMovementsResponse {
  movements: CashMovement[]
  total: number
}

export interface CashMovementsSummary {
  entries_bs: number
  entries_usd: number
  exits_bs: number
  exits_usd: number
  net_bs: number
  net_usd: number
  total_movements: number
}

export const paymentsService = {
  /**
   * Crea o actualiza configuración de método de pago
   */
  async upsertPaymentMethodConfig(
    method: PaymentMethod,
    data: CreatePaymentMethodConfigRequest
  ): Promise<PaymentMethodConfig> {
    const response = await api.put<PaymentMethodConfig>(`/payments/methods/${method}`, data)
    return response.data
  },

  /**
   * Obtiene todas las configuraciones de métodos de pago
   */
  async getPaymentMethodConfigs(): Promise<PaymentMethodConfig[]> {
    const response = await api.get<PaymentMethodConfig[]>('/payments/methods')
    return response.data
  },

  /**
   * Obtiene configuración de un método específico
   */
  async getPaymentMethodConfig(method: PaymentMethod): Promise<PaymentMethodConfig | null> {
    const response = await api.get<PaymentMethodConfig | null>(`/payments/methods/${method}`)
    return response.data
  },

  /**
   * Elimina configuración de método de pago
   */
  async deletePaymentMethodConfig(method: PaymentMethod): Promise<void> {
    await api.delete(`/payments/methods/${method}`)
  },

  /**
   * Registra un movimiento de efectivo (entrada o salida)
   */
  async createCashMovement(data: CreateCashMovementRequest): Promise<CashMovement> {
    const response = await api.post<CashMovement>('/payments/movements', data)
    return response.data
  },

  /**
   * Obtiene los movimientos de efectivo
   */
  async getCashMovements(params?: {
    limit?: number
    offset?: number
    shift_id?: string
    cash_session_id?: string
  }): Promise<CashMovementsResponse> {
    const response = await api.get<CashMovementsResponse>('/payments/movements', { params })
    return response.data
  },

  /**
   * Obtiene resumen de movimientos de efectivo
   */
  async getCashMovementsSummary(params?: {
    shift_id?: string
    cash_session_id?: string
  }): Promise<CashMovementsSummary> {
    const response = await api.get<CashMovementsSummary>('/payments/movements/summary', { params })
    return response.data
  },
}
