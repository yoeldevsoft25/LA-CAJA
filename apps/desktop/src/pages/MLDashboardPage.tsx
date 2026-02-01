import { useAnomalies } from '@/hooks/useAnomalies'
import { useRecommendations } from '@/hooks/useRecommendations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Brain, AlertTriangle, TrendingUp, Package } from 'lucide-react'
import { formatAnomalySeverity } from '@/utils/ml-formatters'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import ProductRecommendations from '@/components/ml/ProductRecommendations'

export default function MLDashboardPage() {
  // Obtener anomalías críticas
  const { data: criticalAnomalies } = useAnomalies({
    min_severity: 'critical',
    limit: 10,
  })

  // Obtener recomendaciones generales
  const { data: recommendations } = useRecommendations({
    limit: 5,
  })

  const anomalies = criticalAnomalies?.anomalies || []
  const topRecommendations = recommendations?.recommendations.slice(0, 5) || []

  return (
    <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
            Dashboard de Machine Learning
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Predicciones, recomendaciones y detección de anomalías
          </p>
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Anomalías Críticas</p>
                <p className="text-2xl font-bold text-red-600">{anomalies.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <Link to="/ml/anomalies">
              <Button variant="ghost" size="sm" className="mt-2 w-full">
                Ver todas <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recomendaciones</p>
                <p className="text-2xl font-bold text-blue-600">
                  {topRecommendations.length}
                </p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
            <Link to="/app/ml">
              <Button variant="ghost" size="sm" className="mt-2 w-full">
                Ver todas <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Predicciones</p>
                <p className="text-2xl font-bold text-green-600">Activas</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
            <Link to="/ml/predictions">
              <Button variant="ghost" size="sm" className="mt-2 w-full">
                Ver todas <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Anomalías críticas */}
      {anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Anomalías Críticas Recientes
              </CardTitle>
              <Link to="/ml/anomalies">
                <Button variant="ghost" size="sm">
                  Ver todas <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {anomalies.slice(0, 5).map((anomaly) => {
                const severity = formatAnomalySeverity(anomaly.severity)
                return (
                  <div
                    key={anomaly.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={severity.bgColor} variant="secondary">
                          {severity.label}
                        </Badge>
                        <span className="text-sm font-medium">{anomaly.anomaly_type}</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {anomaly.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(anomaly.detected_at), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recomendaciones destacadas */}
      <ProductRecommendations limit={6} />

      {/* Grid de 2 columnas para desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Predicciones destacadas - placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Predicciones Destacadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Las predicciones de demanda están disponibles en la página de predicciones.
            </p>
            <Link to="/ml/predictions">
              <Button variant="outline" className="w-full">
                Ver Predicciones <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Métricas de modelos - placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Métricas de Modelos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Ejecuta la evaluación para comparar modelos y ajustar la demanda.
            </p>
            <Link to="/app/ml/evaluation">
              <Button variant="outline" className="w-full mt-4">
                Ver Evaluacion <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
