import { useQuery } from '@tanstack/react-query'
import { mlService } from '@/services/ml.service'
import { PredictDemandResponse } from '@/types/ml.types'

export function useDemandPrediction(
  productId: string | null,
  daysAhead: number = 7,
) {
  return useQuery<PredictDemandResponse>({
    queryKey: ['ml', 'demand-prediction', productId, daysAhead],
    queryFn: () => mlService.predictDemand(productId!, daysAhead),
    enabled: !!productId && daysAhead >= 1 && daysAhead <= 90,
    staleTime: 1000 * 60 * 30, // 30 minutos (coincide con caché backend)
    gcTime: 1000 * 60 * 60, // 1 hora
  })
}


