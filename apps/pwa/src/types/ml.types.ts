// Interfaces para predicciones
export interface DemandPrediction {
  date: string
  predicted_quantity: number
  confidence_score: number
  model_used: string
}

export interface PredictDemandResponse {
  product_id: string
  predictions: DemandPrediction[]
  metrics?: {
    mae: number
    rmse: number
    mape: number
    r2: number
  }
}

// Interfaces para recomendaciones
export interface ProductRecommendation {
  product_id: string
  product_name: string
  score: number
  reason: string
  recommendation_type: 'collaborative' | 'content_based' | 'hybrid'
}

export interface GetRecommendationsResponse {
  recommendations: ProductRecommendation[]
}

// Interfaces para anomalías
export type AnomalyType =
  | 'sale_amount'
  | 'sale_frequency'
  | 'product_movement'
  | 'inventory_level'
  | 'price_deviation'
  | 'customer_behavior'
  | 'payment_pattern'

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical'

export type EntityType = 'sale' | 'product' | 'customer' | 'inventory' | 'payment'

export interface DetectedAnomaly {
  id: string
  anomaly_type: AnomalyType
  entity_type: EntityType
  entity_id: string | null
  severity: AnomalySeverity
  score: number
  description: string
  detected_at: string
  resolved_at?: string | null
  resolution_note?: string | null
}

export interface DetectAnomaliesResponse {
  anomalies: DetectedAnomaly[]
}

export interface ResolveAnomalyRequest {
  resolution_note?: string
}


