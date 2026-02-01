import { useQuery } from '@tanstack/react-query'
import { realtimeAnalyticsService } from '@/services/realtime-analytics.service'
import {
  ComparativeMetricsResponse,
  GetComparativeMetricsRequest,
  ComparisonPeriod,
  MetricType,
} from '@/types/realtime-analytics.types'

export function useComparativeMetrics(
  metricType: MetricType | undefined,
  period: ComparisonPeriod = 'day',
  startDate?: Date,
  endDate?: Date,
) {
  const params: GetComparativeMetricsRequest = {
    period,
    metric_type: metricType,
  }

  if (startDate && endDate) {
    params.start_date = startDate.toISOString().split('T')[0]
    params.end_date = endDate.toISOString().split('T')[0]
  }

  return useQuery<ComparativeMetricsResponse>({
    queryKey: ['comparative-metrics', params],
    queryFn: () => realtimeAnalyticsService.getComparativeMetrics(params),
    enabled: !!metricType,
    staleTime: 1000 * 60 * 2, // 2 minutos - más frecuente porque es rápido con vistas materializadas
  })
}


