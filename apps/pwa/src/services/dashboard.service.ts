import { api } from '@/lib/api'
import { createLogger } from '@/lib/logger'

const logger = createLogger('DashboardService')

export interface KPIs {
  sales: {
    today_count: number
    today_amount_bs: number
    today_amount_usd: number
    period_count: number
    period_amount_bs: number
    period_amount_usd: number
    growth_percentage: number
  }
  inventory: {
    total_products: number
    low_stock_count: number
    total_stock_value_bs: number
    total_stock_value_usd: number
    expiring_soon_count: number
  }
  finances: {
    total_debt_bs: number
    total_debt_usd: number
    total_collected_bs: number
    total_collected_usd: number
    pending_collections_bs: number
    pending_collections_usd: number
  }
  purchases: {
    pending_orders: number
    total_purchases_bs: number
    total_purchases_usd: number
    completed_orders: number
  }
  fiscal: {
    issued_invoices: number
    total_fiscal_amount_bs: number
    total_fiscal_amount_usd: number
    total_tax_collected_bs: number
    total_tax_collected_usd: number
  }
  performance: {
    avg_sale_amount_bs: number
    avg_sale_amount_usd: number
    top_selling_product: {
      id: string
      name: string
      quantity_sold: number
      is_weight_product: boolean
      weight_unit: 'kg' | 'g' | 'lb' | 'oz' | null
    } | null
    best_selling_category: string | null
  }
}

export interface Trends {
  sales_trend: Array<{
    date: string
    count: number
    amount_bs: number
    amount_usd: number
  }>
  top_products_trend: Array<{
    product_id: string
    product_name: string
    quantity_sold: number
    revenue_bs: number
    revenue_usd: number
    is_weight_product: boolean
    weight_unit: 'kg' | 'g' | 'lb' | 'oz' | null
  }>
}

export const dashboardService = {
  /**
   * Obtiene KPIs consolidados para el dashboard
   */
  async getKPIs(startDate?: string, endDate?: string): Promise<KPIs> {
    const startTime = performance.now()
    const params: Record<string, string> = {}
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    const response = await api.get<KPIs>('/dashboard/kpis', { params })
    const endTime = performance.now()
    logger.debug('KPIs loaded', {
      duration: `${(endTime - startTime).toFixed(2)}ms`,
      filtered: startDate || endDate ? `${startDate || 'any'} to ${endDate || 'any'}` : false,
    })
    return response.data
  },

  /**
   * Obtiene métricas de tendencias (últimos 7 días)
   */
  async getTrends(startDate?: string, endDate?: string): Promise<Trends> {
    const startTime = performance.now()
    const params: Record<string, string> = {}
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    const response = await api.get<Trends>('/dashboard/trends', { params })
    const endTime = performance.now()
    logger.debug('Trends loaded', {
      duration: `${(endTime - startTime).toFixed(2)}ms`,
      filtered: startDate || endDate ? `${startDate || 'any'} to ${endDate || 'any'}` : false,
    })
    return response.data
  },
}
