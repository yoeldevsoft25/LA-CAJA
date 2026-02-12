import { useRealtimeMetrics } from '@/hooks/useRealtimeMetrics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MetricType } from '@/types/realtime-analytics.types'
import { TrendingUp, TrendingDown, Minus, Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { useRealtimeAlerts } from '@/hooks/useRealtimeAlerts'

interface RealtimeMetricsCardProps {
  metricType: MetricType
  title: string
  formatValue?: (value: number) => string
  icon?: React.ReactNode
}

const defaultFormatValue = (value: number): string => {
  return new Intl.NumberFormat('es-VE').format(value)
}

export default function RealtimeMetricsCard({
  metricType,
  title,
  formatValue = defaultFormatValue,
  icon,
}: RealtimeMetricsCardProps) {
  const { metrics, isLoading, isConnected } = useRealtimeMetrics([metricType])
  const { alerts } = useRealtimeAlerts({ is_read: false })

  const metric = metrics.find((m) => m.metric_name === metricType)
  const metricAlerts = alerts.filter((a) => a.metric_name === metricType)
  const hasAlert = metricAlerts.length > 0

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6">
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-12 w-24" />
        </CardContent>
      </Card>
    )
  }

  if (!metric) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6 text-center">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-2 italic">Sin datos registrados</p>
        </CardContent>
      </Card>
    )
  }

  const changePercentage = Number(metric.change_percentage || 0)
  const isPositive = changePercentage > 0
  const isNegative = changePercentage < 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {hasAlert && (
              <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center rounded-full animate-pulse">
                <AlertCircle className="w-3.5 h-3.5" />
              </Badge>
            )}
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap min-h-[2.5rem]">
            <p className={`text-xl sm:text-2xl font-bold tracking-tight ${hasAlert ? 'text-red-600' : ''}`}>
              {formatValue(Number(metric.metric_value))}
            </p>
            {metric.previous_value !== null && metric.previous_value !== undefined && (
              <Badge
                variant="secondary"
                className={
                  isPositive
                    ? 'bg-green-100 text-green-800'
                    : isNegative
                      ? 'bg-red-100 text-red-800'
                      : 'bg-card text-foreground border border-border'
                }
              >
                {isPositive ? (
                  <TrendingUp className="w-3 h-3 mr-1" />
                ) : isNegative ? (
                  <TrendingDown className="w-3 h-3 mr-1" />
                ) : (
                  <Minus className="w-3 h-3 mr-1" />
                )}
                {isPositive ? '+' : ''}
                {changePercentage.toFixed(1)}%
              </Badge>
            )}
          </div>

          {/* Breakdown detallado para productos vendidos (Unidades vs Peso) */}
          {metric.metric_name === 'products_sold_count' && metric.metadata && (
            <div className="flex items-center gap-4 pt-3 mt-3 border-t border-dashed border-muted-foreground/20">
              {Number(metric.metadata.units || 0) > 0 && (
                <div className="flex flex-col">
                  <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">Unid.</span>
                  <span className="text-xs sm:text-sm font-bold text-foreground">
                    {Number(metric.metadata.units).toLocaleString('es-VE')}
                  </span>
                </div>
              )}
              {Number(metric.metadata.units || 0) > 0 && Number(metric.metadata.weight || 0) > 0 && (
                <div className="h-6 w-px bg-muted-foreground/20" />
              )}
              {Number(metric.metadata.weight || 0) > 0 && (
                <div className="flex flex-col">
                  <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">Ventas (Peso)</span>
                  <span className="text-xs sm:text-sm font-bold text-foreground">
                    {Number(metric.metadata.weight_items || 0).toLocaleString('es-VE')}
                  </span>
                </div>
              )}
              {Number(metric.metadata.weight || 0) > 0 && (
                <div className="h-6 w-px bg-muted-foreground/20" />
              )}
              {Number(metric.metadata.weight || 0) > 0 && (
                <div className="flex flex-col">
                  <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">Peso Total</span>
                  <span className="text-xs sm:text-sm font-bold text-foreground">
                    {Number(metric.metadata.weight).toLocaleString('es-VE', { minimumFractionDigits: 3 })} Kg
                  </span>
                </div>
              )}
            </div>
          )}

          {metric.previous_value !== null && metric.previous_value !== undefined && (
            <p className="text-xs text-muted-foreground">
              Anterior: {formatValue(Number(metric.previous_value))}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Actualizado: {new Date(metric.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

