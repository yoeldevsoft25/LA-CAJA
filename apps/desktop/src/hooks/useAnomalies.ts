import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mlService } from '@/services/ml.service'
import {
  DetectAnomaliesResponse,
  AnomalyType,
  EntityType,
  AnomalySeverity,
} from '@/types/ml.types'

interface UseAnomaliesParams {
  anomaly_type?: AnomalyType
  entity_type?: EntityType
  min_severity?: AnomalySeverity
  start_date?: string
  end_date?: string
  limit?: number
}

export function useAnomalies(params?: UseAnomaliesParams) {
  return useQuery<DetectAnomaliesResponse>({
    queryKey: ['ml', 'anomalies', params],
    queryFn: () => mlService.detectAnomalies(params),
    staleTime: 1000 * 60 * 15, // 15 minutos (coincide con caché backend)
    gcTime: 1000 * 60 * 30, // 30 minutos
  })
}

export function useResolveAnomaly() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      anomalyId,
      resolutionNote,
    }: {
      anomalyId: string
      resolutionNote?: string
    }) => mlService.resolveAnomaly(anomalyId, resolutionNote),
    onSuccess: () => {
      // Invalidar caché de anomalías
      queryClient.invalidateQueries({ queryKey: ['ml', 'anomalies'] })
    },
  })
}

