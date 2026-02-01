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
  quantity_sold_kg: number
  quantity_sold_units: number
  revenue_bs: number
  revenue_usd: number
  cost_bs: number
  cost_usd: number
  profit_bs: number
  profit_usd: number
  profit_margin: number
  is_weight_product: boolean
  weight_unit: 'kg' | 'g' | 'lb' | 'oz' | null
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

export interface PurchasesBySupplierReport {
  total_orders: number
  total_amount_bs: number
  total_amount_usd: number
  by_supplier: Array<{
    supplier_id: string
    supplier_name: string
    supplier_code: string | null
    orders_count: number
    total_amount_bs: number
    total_amount_usd: number
    completed_orders: number
    pending_orders: number
  }>
}

export interface FiscalInvoicesReport {
  total_invoices: number
  total_amount_bs: number
  total_amount_usd: number
  total_tax_bs: number
  total_tax_usd: number
  by_status: Record<string, number>
  by_type: Record<string, number>
  daily: Array<{
    date: string
    invoices_count: number
    total_bs: number
    total_usd: number
    tax_bs: number
    tax_usd: number
  }>
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

  // Reporte de compras por proveedor
  async getPurchasesBySupplier(params?: ReportDateRange): Promise<PurchasesBySupplierReport> {
    const response = await api.get<PurchasesBySupplierReport>('/reports/purchases/by-supplier', {
      params,
    })
    return response.data
  },

  // Reporte de facturas fiscales emitidas
  async getFiscalInvoicesReport(
    startDate?: string,
    endDate?: string,
    status?: string,
  ): Promise<FiscalInvoicesReport> {
    const params: any = {}
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    if (status) params.status = status
    const response = await api.get<FiscalInvoicesReport>(
      '/reports/fiscal-invoices',
      { params },
    )
    return response.data
  },
}
