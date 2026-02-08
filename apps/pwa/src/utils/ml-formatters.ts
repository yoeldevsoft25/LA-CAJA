import { AnomalySeverity, AnomalyType } from '@/types/ml.types'

/**
 * Formatea el score de confianza como porcentaje
 */
export function formatConfidenceScore(score: number): string {
  return `${Math.round(score)}% de confianza`
}

/**
 * Obtiene el label y color para una severidad de anomalía
 */
export function formatAnomalySeverity(severity: AnomalySeverity): {
  label: string
  color: string
  bgColor: string
} {
  const severityMap: Record<
    AnomalySeverity,
    { label: string; color: string; bgColor: string }
  > = {
    low: {
      label: 'Baja',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    },
    medium: {
      label: 'Media',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
    high: {
      label: 'Alta',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-500/10',
    },
    critical: {
      label: 'Crítica',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-500/10',
    },
  }

  return severityMap[severity]
}

/**
 * Traduce el tipo de anomalía al español
 */
export function formatAnomalyType(type: AnomalyType): string {
  const typeMap: Record<AnomalyType, string> = {
    sale_amount: 'Monto de Venta',
    sale_frequency: 'Frecuencia de Venta',
    product_movement: 'Movimiento de Producto',
    inventory_level: 'Nivel de Inventario',
    price_deviation: 'Desviación de Precio',
    customer_behavior: 'Comportamiento de Cliente',
    payment_pattern: 'Patrón de Pago',
  }

  return typeMap[type] || type
}

/**
 * Formatea las métricas del modelo de forma legible
 */
export function formatModelMetrics(metrics: {
  mae?: number
  rmse?: number
  mape?: number
  r2?: number
}): string {
  const parts: string[] = []

  if (metrics.mae !== undefined) {
    parts.push(`MAE: ${metrics.mae.toFixed(2)}`)
  }
  if (metrics.rmse !== undefined) {
    parts.push(`RMSE: ${metrics.rmse.toFixed(2)}`)
  }
  if (metrics.mape !== undefined) {
    parts.push(`MAPE: ${metrics.mape.toFixed(2)}%`)
  }
  if (metrics.r2 !== undefined) {
    parts.push(`R²: ${metrics.r2.toFixed(3)}`)
  }

  return parts.join(' | ')
}

/**
 * Obtiene el color para un score de confianza
 */
export function getConfidenceColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
  if (score >= 40) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

/**
 * Obtiene el color para un score de recomendación
 */
export function getRecommendationScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
  if (score >= 50) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10'
  return 'text-muted-foreground bg-muted'
}











