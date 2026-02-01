import { api } from '@/lib/api'
import {
  PredictDemandResponse,
  GetRecommendationsResponse,
  DetectAnomaliesResponse,
  DetectedAnomaly,
  AnomalyType,
  EntityType,
  AnomalySeverity,
  ResolveAnomalyRequest,
  EvaluateDemandResponse,
} from '@/types/ml.types'

export const mlService = {
  /**
   * Predice la demanda de un producto para los próximos días
   */
  async predictDemand(
    productId: string,
    daysAhead: number = 7,
  ): Promise<PredictDemandResponse> {
    const response = await api.post<PredictDemandResponse>('/ml/predict-demand', {
      product_id: productId,
      days_ahead: daysAhead,
    })
    return response.data
  },

  /**
   * Obtiene recomendaciones de productos
   */
  async getRecommendations(params?: {
    source_product_id?: string
    recommendation_type?: string
    limit?: number
  }): Promise<GetRecommendationsResponse> {
    const response = await api.get<GetRecommendationsResponse>('/ml/recommendations', {
      params,
    })
    return response.data
  },

  /**
   * Detecta anomalías en el sistema
   */
  async detectAnomalies(params?: {
    anomaly_type?: AnomalyType
    entity_type?: EntityType
    min_severity?: AnomalySeverity
    start_date?: string
    end_date?: string
    limit?: number
  }): Promise<DetectAnomaliesResponse> {
    const response = await api.get<DetectAnomaliesResponse>('/ml/anomalies', {
      params,
    })
    return response.data
  },

  /**
   * Resuelve una anomalía detectada
   */
  async resolveAnomaly(
    anomalyId: string,
    resolutionNote?: string,
  ): Promise<DetectedAnomaly> {
    const response = await api.put<DetectedAnomaly>(
      `/ml/anomalies/${anomalyId}/resolve`,
      { resolution_note: resolutionNote } as ResolveAnomalyRequest,
    )
    return response.data
  },

  /**
   * Evalúa modelos de predicción de demanda (walk-forward)
   */
  async evaluateDemand(params?: {
    product_ids?: string[]
    top_n?: number
    days_back?: number
    horizon?: number
    min_train_size?: number
    max_folds?: number
  }): Promise<EvaluateDemandResponse> {
    const response = await api.post<EvaluateDemandResponse>(
      '/ml/evaluate-demand',
      params ?? {},
    )
    return response.data
  },
}










