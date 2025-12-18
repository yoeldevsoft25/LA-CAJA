import { useQuery } from '@tanstack/react-query'
import { mlService } from '@/services/ml.service'
import { GetRecommendationsResponse } from '@/types/ml.types'

interface UseRecommendationsParams {
  source_product_id?: string
  recommendation_type?: string
  limit?: number
}

export function useRecommendations(params?: UseRecommendationsParams) {
  return useQuery<GetRecommendationsResponse>({
    queryKey: ['ml', 'recommendations', params],
    queryFn: () => mlService.getRecommendations(params),
    staleTime: 1000 * 60 * 60, // 1 hora (coincide con caché backend)
    gcTime: 1000 * 60 * 60 * 2, // 2 horas
  })
}



