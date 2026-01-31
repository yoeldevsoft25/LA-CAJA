// Tipos de métricas
export type MetricType =
  | 'daily_revenue_bs'
  | 'daily_revenue_usd'
  | 'daily_sales_count'
  | 'avg_ticket_bs'
  | 'avg_ticket_usd'
  | 'products_sold_count'
  | 'low_stock_count'
  | 'out_of_stock_count'
  | 'inventory_value_bs'
  | 'expiring_soon_count'
  | 'expired_products_count'
  | 'active_customers_count'
  | 'total_debt_bs'
  | 'overdue_debt_bs'
  | 'customers_overdue_count'
  | 'active_sessions_count'
  | 'pending_orders_count'
  | 'cash_on_hand_bs'

// Tipos de alertas
export type AlertType =
  | 'stock_low'
  | 'revenue_drop'
  | 'sales_drop'
  | 'inventory_anomaly'
  | 'payment_issue'
  | 'system_error'
  | 'sale_anomaly'
  | 'revenue_spike'
  | 'inventory_high'
  | 'debt_overdue'
  | 'product_expiring'
  | 'custom'

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

// Métricas en tiempo real
export interface RealTimeMetric {
  id: string
  store_id: string
  metric_type: string
  metric_name: MetricType
  metric_value: number
  previous_value?: number
  change_percentage?: number
  period_start: string
  period_end: string
  created_at: string
  metadata?: Record<string, any>
}

export interface RealTimeMetricsResponse {
  metrics: RealTimeMetric[]
  calculated_at: string
}

// Umbrales de alerta
export type ComparisonOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'less_than' | 'greater_than' | 'equals' | 'not_equals'

export interface AlertThreshold {
  id: string
  store_id: string
  alert_type: AlertType
  metric_name: string
  threshold_value: number
  comparison_operator: ComparisonOperator
  severity: AlertSeverity
  is_active: boolean
  notification_channels?: string[]
  created_at: string
  updated_at: string
}

export interface CreateAlertThresholdRequest {
  alert_type: AlertType
  metric_name: string
  threshold_value: number
  comparison_operator: ComparisonOperator
  severity: AlertSeverity
  notification_channels?: string[]
}

export interface UpdateAlertThresholdRequest {
  threshold_value?: number
  comparison_operator?: ComparisonOperator
  severity?: AlertSeverity
  is_active?: boolean
  notification_channels?: string[]
}

// Alertas
export interface RealTimeAlert {
  id: string
  store_id: string
  alert_type: AlertType
  threshold_id: string
  metric_name: string
  current_value: number
  threshold_value: number
  severity: AlertSeverity
  message: string
  is_read: boolean
  created_at: string
  read_at?: string | null
}

export interface RealTimeAlertsResponse {
  alerts: RealTimeAlert[]
  unread_count: number
}

// Heatmap de ventas
export interface SalesHeatmapData {
  date: string
  hour: number
  sales_count: number
  revenue_bs: number
  revenue_usd: number
  avg_ticket_bs: number
  avg_ticket_usd: number
}

export interface SalesHeatmapResponse {
  data: SalesHeatmapData[]
  date_range: {
    start_date: string
    end_date: string
  }
}

// Métricas comparativas
export type ComparisonPeriod = 'day' | 'week' | 'month' | 'year'

export interface ComparativeMetric {
  metric_type: MetricType
  current_period: {
    value: number
    start_date: string
    end_date: string
  }
  previous_period: {
    value: number
    start_date: string
    end_date: string
  }
  change_percentage: number
  trend: 'up' | 'down' | 'stable'
}

export interface ComparativeMetricsResponse {
  metrics: ComparativeMetric[]
  current_period: {
    start_date: string
    end_date: string
  }
  previous_period: {
    start_date: string
    end_date: string
  }
}

export interface GetComparativeMetricsRequest {
  metric_type?: MetricType
  period: ComparisonPeriod
  start_date?: string
  end_date?: string
}

// Eventos WebSocket
export interface WebSocketEvent {
  type: string
  data: any
  timestamp: string
}

// Analytics Defaults
export interface AnalyticsDefaultsPreview {
  totalAlerts: number
  byPriority: {
    critical: number
    high: number
    medium: number
    low: number
  }
  metrics: string[]
}

export interface ApplyDefaultsResponse {
  message: string
  thresholds_created: number
  historical_data_used: boolean
  thresholds: AlertThreshold[]
}

export interface HasThresholdsResponse {
  hasThresholds: boolean
}

// Tasa de cambio (Websocket)
export interface ExchangeRateUpdate {
  rate: number
  rate_type: string
  timestamp: number
}







