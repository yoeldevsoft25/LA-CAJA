import { useRealtimeMetrics } from '@/hooks/useRealtimeMetrics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MetricType } from '@/types/realtime-analytics.types'
import { TrendingUp, TrendingDown, Minus, Wifi, WifiOff } from 'lucide-react'

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

  const metric = metrics.find((m) => m.metric_name === metricType)

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

  const changePercentage = metric.change_percentage || 0
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
          <div className="flex items-center gap-1">
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
          <div className="flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-bold">
              {formatValue(metric.metric_value)}
            </p>
            {metric.previous_value !== undefined && (
              <Badge
                variant="secondary"
                className={
                  isPositive
                    ? 'bg-green-100 text-green-800'
                    : isNegative
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
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
          {metric.previous_value !== undefined && (
            <p className="text-xs text-muted-foreground">
              Anterior: {formatValue(metric.previous_value)}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Actualizado: {new Date(metric.created_at).toLocaleTimeString()}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

