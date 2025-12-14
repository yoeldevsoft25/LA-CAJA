import { api } from '@/lib/api'

export interface SalesByDayReport {
  total_sales: number
  total_amount_bs: number
  total_amount_usd: number
  total_cost_bs: number
  total_cost_usd: number
  total_profit_bs: number
  total_profit_usd: number
  profit_margin: number
  by_payment_method: Record<string, { count: number; amount_bs: number; amount_usd: number }>
  daily: Array<{
    date: string
    sales_count: number
    total_bs: number
    total_usd: number
    cost_bs: number
    cost_usd: number
    profit_bs: number
    profit_usd: number
  }>
}

export interface TopProduct {
  product_id: string
  product_name: string
  quantity_sold: number
  revenue_bs: number
  revenue_usd: number
  cost_bs: number
  cost_usd: number
  profit_bs: number
  profit_usd: number
  profit_margin: number
}

export interface DebtSummaryReport {
  total_debt_bs: number
  total_debt_usd: number
  total_paid_bs: number
  total_paid_usd: number
  total_pending_bs: number
  total_pending_usd: number
  by_status: {
    open: number
    partial: number
    paid: number
  }
  top_debtors: Array<{
    customer_id: string
    customer_name: string
    total_debt_bs: number
    total_debt_usd: number
    total_paid_bs: number
    total_paid_usd: number
    pending_bs: number
    pending_usd: number
  }>
}

export interface ReportDateRange {
  start_date?: string
  end_date?: string
}

export const reportsService = {
  // Reporte de ventas por día
  async getSalesByDay(params?: ReportDateRange): Promise<SalesByDayReport> {
    const response = await api.get<SalesByDayReport>('/reports/sales/by-day', {
      params,
    })
    return response.data
  },

  // Top productos más vendidos
  async getTopProducts(limit = 10, params?: ReportDateRange): Promise<TopProduct[]> {
    const response = await api.get<TopProduct[]>('/reports/sales/top-products', {
      params: { limit, ...params },
    })
    return response.data
  },

  // Resumen de deudas/FIAO
  async getDebtSummary(): Promise<DebtSummaryReport> {
    const response = await api.get<DebtSummaryReport>('/reports/debts/summary')
    return response.data
  },

  // Exportar ventas a CSV
  async exportSalesCSV(params?: ReportDateRange): Promise<Blob> {
    const response = await api.get('/reports/sales/export/csv', {
      params,
      responseType: 'blob',
    })
    return response.data
  },
}
