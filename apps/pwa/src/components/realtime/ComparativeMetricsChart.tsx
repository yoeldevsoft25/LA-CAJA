import { useState } from 'react'
import { useComparativeMetrics } from '@/hooks/useComparativeMetrics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react'
import {
  MetricType,
  ComparisonPeriod,
} from '@/types/realtime-analytics.types'

const metricLabels: Record<string, string> = {
  daily_revenue_bs: 'Ingresos (Bs)',
  daily_revenue_usd: 'Ingresos (USD)',
  daily_sales_count: 'Cantidad de Ventas',
  avg_ticket_bs: 'Ticket Promedio (Bs)',
  avg_ticket_usd: 'Ticket Promedio (USD)',
  products_sold_count: 'Productos Vendidos',
  low_stock_count: 'Stock Bajo',
  pending_orders_count: 'Órdenes Pendientes',
  active_customers_count: 'Clientes Activos',
  total_debt_bs: 'Deuda Total (Bs)',
}

const periodLabels: Record<ComparisonPeriod, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
  year: 'Año',
}

export default function ComparativeMetricsChart() {
  const [metricType, setMetricType] = useState<MetricType>('daily_revenue_bs')
  const [period, setPeriod] = useState<ComparisonPeriod>('day')

  const { data, isLoading, error } = useComparativeMetrics(metricType, period)

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Error al cargar métricas comparativas</p>
        </CardContent>
      </Card>
    )
  }

  const metrics = data?.metrics || []
  const selectedMetric = metrics.find((m) => m.metric_type === metricType)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Métricas Comparativas
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select
              value={metricType}
              onValueChange={(value) => setMetricType(value as MetricType)}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(metricLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={period}
              onValueChange={(value) => setPeriod(value as ComparisonPeriod)}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(periodLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : !selectedMetric ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No hay datos disponibles</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Comparación visual */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Período Actual</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('es-VE').format(
                    selectedMetric.current_period.value,
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(
                    selectedMetric.current_period.start_date,
                  ).toLocaleDateString()}{' '}
                  -{' '}
                  {new Date(
                    selectedMetric.current_period.end_date,
                  ).toLocaleDateString()}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Período Anterior</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('es-VE').format(
                    selectedMetric.previous_period.value,
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(
                    selectedMetric.previous_period.start_date,
                  ).toLocaleDateString()}{' '}
                  -{' '}
                  {new Date(
                    selectedMetric.previous_period.end_date,
                  ).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Cambio porcentual */}
            <div className="p-4 bg-card border border-border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Cambio</p>
                  <div className="flex items-center gap-2">
                    {selectedMetric.trend === 'up' ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : selectedMetric.trend === 'down' ? (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    ) : (
                      <Minus className="w-5 h-5 text-gray-600" />
                    )}
                    <p
                      className={`text-2xl font-bold ${selectedMetric.trend === 'up'
                        ? 'text-green-600'
                        : selectedMetric.trend === 'down'
                          ? 'text-red-600'
                          : 'text-gray-600'
                        }`}
                    >
                      {selectedMetric.change_percentage >= 0 ? '+' : ''}
                      {selectedMetric.change_percentage.toFixed(2)}%
                    </p>
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={
                    selectedMetric.trend === 'up'
                      ? 'bg-green-100 text-green-800'
                      : selectedMetric.trend === 'down'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-card text-foreground border border-border'
                  }
                >
                  {selectedMetric.trend === 'up'
                    ? 'Aumento'
                    : selectedMetric.trend === 'down'
                      ? 'Disminución'
                      : 'Estable'}
                </Badge>
              </div>
            </div>

            {/* Gráfico de barras simple */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">Comparación Visual</p>
              <div className="flex items-end gap-2 h-32">
                <div className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-blue-600 rounded-t transition-all hover:opacity-80"
                    style={{
                      height: `${(selectedMetric.current_period.value /
                        Math.max(
                          selectedMetric.current_period.value,
                          selectedMetric.previous_period.value,
                          1,
                        )) *
                        100
                        }%`,
                    }}
                    title={`Actual: ${selectedMetric.current_period.value.toFixed(2)}`}
                  />
                  <p className="text-xs text-muted-foreground mt-2">Actual</p>
                </div>
                <div className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-gray-400 rounded-t transition-all hover:opacity-80"
                    style={{
                      height: `${(selectedMetric.previous_period.value /
                        Math.max(
                          selectedMetric.current_period.value,
                          selectedMetric.previous_period.value,
                          1,
                        )) *
                        100
                        }%`,
                    }}
                    title={`Anterior: ${selectedMetric.previous_period.value.toFixed(2)}`}
                  />
                  <p className="text-xs text-muted-foreground mt-2">Anterior</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

