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
} from '@/types/realtime-analytics.types'
import { createLogger } from '@/lib/logger'

const logger = createLogger('RealtimeAnalytics')

export const realtimeAnalyticsService = {
  /**
   * Obtiene métricas en tiempo real
   */
  async getMetrics(metricTypes?: string[]): Promise<RealTimeMetricsResponse> {
    const startTime = performance.now()

    // Backend expects singular 'metric_type' parameter, not plural 'metric_types'
    // If no metric types specified, fetch all metrics
    const params: Record<string, string> = {}
    if (metricTypes && metricTypes.length > 0) {
      // If multiple types requested, use first one for now
      // TODO: Consider making multiple requests or updating backend to accept array
      params.metric_type = metricTypes[0]
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
   * Verifica umbrales manualmente
   */
  async checkThresholds(): Promise<void> {
    await api.post('/realtime-analytics/thresholds/check')
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
}

