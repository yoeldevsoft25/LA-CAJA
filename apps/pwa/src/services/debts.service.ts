import { api } from '@/lib/api'
import { Customer } from './customers.service'

export type DebtStatus = 'open' | 'partial' | 'paid'

export type PaymentMethod = 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER'

export interface DebtPayment {
  id: string
  store_id: string
  debt_id: string
  paid_at: string
  amount_bs: number
  amount_usd: number
  method: PaymentMethod
  note: string | null
}

export interface Debt {
  id: string
  store_id: string
  sale_id: string | null
  customer_id: string
  customer?: Customer
  created_at: string
  amount_bs: number
  amount_usd: number
  status: DebtStatus
  payments: DebtPayment[]
  sale?: {
    id: string
    sold_at: string
    totals: {
      total_bs: number
      total_usd: number
    }
    items?: Array<{
      id: string
      product_id: string
      product?: {
        id: string
        name: string
        sku?: string | null
      }
      variant?: {
        id: string
        name: string
      } | null
      qty: number
      unit_price_bs: number
      unit_price_usd: number
      discount_bs: number
      discount_usd: number
      is_weight_product?: boolean
      weight_unit?: string | null
      weight_value?: number | null
    }>
  }
}

export interface DebtSummary {
  total_debt_bs: number
  total_debt_usd: number
  total_paid_bs: number
  total_paid_usd: number
  remaining_bs: number
  remaining_usd: number
  open_debts_count: number
  total_debts_count: number
}

export interface CreateDebtPaymentDto {
  amount_bs: number
  amount_usd: number
  method: PaymentMethod
  note?: string
}

export interface DebtWithCalculations extends Debt {
  total_paid_bs: number
  total_paid_usd: number
  remaining_bs: number
  remaining_usd: number
}

// Helper para calcular totales de una deuda
export function calculateDebtTotals(debt: Debt): DebtWithCalculations {
  const totalPaidBs = (debt.payments || []).reduce((sum, p) => sum + Number(p.amount_bs), 0)
  const totalPaidUsd = (debt.payments || []).reduce((sum, p) => sum + Number(p.amount_usd), 0)

  return {
    ...debt,
    total_paid_bs: totalPaidBs,
    total_paid_usd: totalPaidUsd,
    remaining_bs: Number(debt.amount_bs) - totalPaidBs,
    remaining_usd: Number(debt.amount_usd) - totalPaidUsd,
  }
}

export const debtsService = {
  // Listar todas las deudas (opcionalmente filtradas por estado)
  async findAll(status?: DebtStatus): Promise<Debt[]> {
    const response = await api.get<Debt[]>('/debts', {
      params: status ? { status } : {},
    })
    return response.data
  },

  // Obtener una deuda por ID
  async findOne(id: string): Promise<Debt> {
    const response = await api.get<Debt>(`/debts/${id}`)
    return response.data
  },

  // Obtener deudas de un cliente específico
  async getByCustomer(customerId: string, includePaid = false): Promise<Debt[]> {
    const response = await api.get<Debt[]>(`/debts/customer/${customerId}`, {
      params: { include_paid: includePaid.toString() },
    })
    return response.data
  },

  // Obtener resumen de deudas de un cliente
  async getCustomerSummary(customerId: string): Promise<DebtSummary> {
    const response = await api.get<DebtSummary>(`/debts/customer/${customerId}/summary`)
    return response.data
  },

  // Registrar un pago/abono a una deuda
  async addPayment(debtId: string, data: CreateDebtPaymentDto): Promise<{ debt: Debt; payment: DebtPayment }> {
    const response = await api.post<{ debt: Debt; payment: DebtPayment }>(`/debts/${debtId}/payments`, data)
    return response.data
  },

  // Crear deuda desde una venta FIAO (usado internamente)
  async createFromSale(saleId: string, customerId: string): Promise<Debt> {
    const response = await api.post<Debt>(`/debts/from-sale/${saleId}`, { customer_id: customerId })
    return response.data
  },

  // Enviar recordatorio de deudas por WhatsApp
  async sendDebtReminder(customerId: string): Promise<{ success: boolean; error?: string }> {
    const response = await api.post<{ success: boolean; error?: string }>(
      `/debts/customer/${customerId}/send-reminder`
    )
    return response.data
  },

  // Pagar todas las deudas pendientes de un cliente
  async payAllDebts(customerId: string, data: CreateDebtPaymentDto): Promise<{ debts: Debt[]; payments: DebtPayment[] }> {
    const response = await api.post<{ debts: Debt[]; payments: DebtPayment[] }>(
      `/debts/customer/${customerId}/pay-all`,
      data
    )
    return response.data
  },
}
