import { api } from '@/lib/api'
import {
  RealTimeMetricsResponse,
  AlertThreshold,
  CreateAlertThresholdRequest,
  UpdateAlertThresholdRequest,
  RealTimeAlertsResponse,
  RealTimeAlert,
  SalesHeatmapResponse,
  ComparativeMetricsResponse,
  GetComparativeMetricsRequest,
  AnalyticsDefaultsPreview,
  ApplyDefaultsResponse,
  HasThresholdsResponse,
} from '@/types/realtime-analytics.types'
import { createLogger } from '@/lib/logger'

const logger = createLogger('RealtimeAnalytics')

export const realtimeAnalyticsService = {
  /**
   * Obtiene métricas en tiempo real
   */
  async getMetrics(metricTypes?: string[]): Promise<RealTimeMetricsResponse> {
    const startTime = performance.now()

    // Backend expects 'metric_name' for specific metrics like 'revenue_bs', 'sales_count'
    // The metric_type parameter is for enum categories like 'revenue', 'sales', etc.
    const params: Record<string, string> = {}
    if (metricTypes && metricTypes.length > 0) {
      // If multiple types requested, use first one for now
      // TODO: Consider making multiple requests or updating backend to accept array
      params.metric_name = metricTypes[0]
    }

    const response = await api.get<RealTimeMetricsResponse>(
      '/realtime-analytics/metrics',
      { params },
    )
    const endTime = performance.now()
    logger.debug('Metrics loaded', {
      duration: `${(endTime - startTime).toFixed(2)}ms`,
      types: metricTypes && metricTypes.length > 0 ? metricTypes.join(', ') : 'all',
    })
    return response.data
  },

  /**
   * Fuerza el cálculo de métricas
   */
  async calculateMetrics(): Promise<RealTimeMetricsResponse> {
    const response = await api.post<RealTimeMetricsResponse>(
      '/realtime-analytics/metrics/calculate',
    )
    return response.data
  },

  /**
   * Obtiene todos los umbrales de alerta
   */
  async getThresholds(): Promise<AlertThreshold[]> {
    const response = await api.get<AlertThreshold[]>('/realtime-analytics/thresholds')
    return response.data
  },

  /**
   * Crea un nuevo umbral de alerta
   */
  async createThreshold(
    data: CreateAlertThresholdRequest,
  ): Promise<AlertThreshold> {
    const response = await api.post<AlertThreshold>(
      '/realtime-analytics/thresholds',
      data,
    )
    return response.data
  },

  /**
   * Actualiza un umbral de alerta
   */
  async updateThreshold(
    id: string,
    data: UpdateAlertThresholdRequest,
  ): Promise<AlertThreshold> {
    const response = await api.put<AlertThreshold>(
      `/realtime-analytics/thresholds/${id}`,
      data,
    )
    return response.data
  },

  /**
   * Elimina un umbral de alerta
   */
  async deleteThreshold(id: string): Promise<void> {
    await api.delete(`/realtime-analytics/thresholds/${id}`)
  },

  /**
   * Elimina todos los umbrales de la tienda
   */
  async deleteAllThresholds(): Promise<void> {
    await api.delete('/realtime-analytics/thresholds')
  },

  /**
   * Verifica umbrales manualmente
   */
  async checkThresholds(): Promise<void> {
    await api.post('/realtime-analytics/thresholds/check')
  },

  /**
   * Elimina todas las alertas de la tienda
   */
  async deleteAllAlerts(): Promise<void> {
    await api.delete('/realtime-analytics/alerts')
  },

  /**
   * Obtiene alertas en tiempo real
   */
  async getAlerts(params?: {
    is_read?: boolean
    severity?: string
    limit?: number
  }): Promise<RealTimeAlertsResponse> {
    const response = await api.get<RealTimeAlertsResponse>(
      '/realtime-analytics/alerts',
      { params },
    )
    return response.data
  },

  /**
   * Marca una alerta como leída
   */
  async markAlertAsRead(alertId: string): Promise<RealTimeAlert> {
    const response = await api.post<RealTimeAlert>(
      `/realtime-analytics/alerts/${alertId}/read`,
    )
    return response.data
  },

  /**
   * Obtiene heatmap de ventas
   */
  async getSalesHeatmap(
    startDate: string,
    endDate: string,
  ): Promise<SalesHeatmapResponse> {
    const startTime = performance.now()
    const response = await api.get<SalesHeatmapResponse>(
      '/realtime-analytics/heatmap',
      {
        params: {
          start_date: startDate,
          end_date: endDate,
        },
      },
    )
    const endTime = performance.now()
    logger.debug('Heatmap loaded', {
      duration: `${(endTime - startTime).toFixed(2)}ms`,
      dateRange: `${startDate} to ${endDate}`,
    })
    return response.data
  },

  /**
   * Obtiene métricas comparativas
   */
  async getComparativeMetrics(
    params: GetComparativeMetricsRequest,
  ): Promise<ComparativeMetricsResponse> {
    const startTime = performance.now()
    const response = await api.get<ComparativeMetricsResponse>(
      '/realtime-analytics/comparative',
      { params },
    )
    const endTime = performance.now()
    logger.debug('Comparative metrics loaded', {
      duration: `${(endTime - startTime).toFixed(2)}ms`,
      type: params.metric_type,
      period: params.period,
    })
    return response.data
  },

  /**
   * Obtiene preview de la configuración predeterminada
   */
  async getDefaultsPreview(): Promise<AnalyticsDefaultsPreview> {
    const response = await api.get<AnalyticsDefaultsPreview>(
      '/realtime-analytics/defaults/preview',
    )
    return response.data
  },

  /**
   * Verifica si la tienda ya tiene umbrales configurados
   */
  async hasExistingThresholds(): Promise<HasThresholdsResponse> {
    const response = await api.get<HasThresholdsResponse>(
      '/realtime-analytics/defaults/has-thresholds',
    )
    return response.data
  },

  /**
   * Aplica la configuración predeterminada de umbrales
   */
  async applyDefaultThresholds(): Promise<ApplyDefaultsResponse> {
    const response = await api.post<ApplyDefaultsResponse>(
      '/realtime-analytics/defaults/apply',
    )
    logger.info('Analytics defaults applied', {
      thresholds_created: response.data.thresholds_created,
      historical_data_used: response.data.historical_data_used,
    })
    return response.data
  },
}
