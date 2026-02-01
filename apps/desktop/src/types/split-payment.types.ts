/**
 * Sistema de Pagos Divididos
 * Permite combinar múltiples métodos de pago en una sola transacción
 */

export type PaymentMethod =
  | 'CASH_USD'
  | 'CASH_BS'
  | 'PAGO_MOVIL'
  | 'TRANSFER'
  | 'POINT_OF_SALE'
  | 'ZELLE'
  | 'OTHER'
  | 'FIAO'

export interface SplitPaymentItem {
  id: string // UUID temporal para identificar el pago en el UI
  method: PaymentMethod
  amount_usd: number
  amount_bs: number
  reference?: string // Para pago móvil, transferencia, etc.
  bank?: string // Para pago móvil, transferencia
  phone?: string // Para pago móvil
  card_last_4?: string // Para punto de venta
  confirmed: boolean // Si el pago fue confirmado/verificado
  notes?: string
}

export interface SplitPaymentState {
  payments: SplitPaymentItem[]
  total_due_usd: number
  total_due_bs: number
  total_paid_usd: number
  total_paid_bs: number
  remaining_usd: number
  remaining_bs: number
  is_complete: boolean
  overpayment?: {
    amount_usd: number
    amount_bs: number
    action: 'refund' | 'credit' | 'tip' | 'adjust_last_payment'
  }
}

export interface PaymentSuggestion {
  method: PaymentMethod
  amount_usd: number
  amount_bs: number
  reason: string
  priority: number // 1-10, donde 10 es más recomendado
}

export interface BankOption {
  code: string
  name: string
  logo?: string
  supportsPayoMovil: boolean
  supportsTransfer: boolean
}
