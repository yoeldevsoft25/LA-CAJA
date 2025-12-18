import { useState } from 'react'
import { useDemandPrediction } from '@/hooks/useDemandPrediction'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, RefreshCw, AlertCircle } from 'lucide-react'
import { formatConfidenceScore, getConfidenceColor } from '@/utils/ml-formatters'
import { format } from 'date-fns'
import {
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from 'recharts'

interface DemandPredictionCardProps {
  productId: string
  productName?: string
  onUpdate?: () => void
}

export default function DemandPredictionCard({
  productId,
  onUpdate,
}: DemandPredictionCardProps) {
  const [daysAhead, setDaysAhead] = useState(7)

  const { data, isLoading, error, refetch } = useDemandPrediction(
    productId,
    daysAhead,
  )

  const handleRefresh = () => {
    refetch()
    onUpdate?.()
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <p>Error al cargar la predicción</p>
          </div>
          <Button onClick={handleRefresh} className="mt-4" variant="outline">
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  const predictions = data?.predictions || []
  
  // Preparar datos para el gráfico con formato para recharts
  const chartData = predictions.map((prediction) => ({
    date: format(new Date(prediction.date), 'dd/MM'),
    fullDate: prediction.date,
    cantidad: Math.round(prediction.predicted_quantity * 100) / 100,
    confianza: Math.round(prediction.confidence_score),
    cantidadFormateada: prediction.predicted_quantity.toFixed(0),
  }))

  const maxQuantity = Math.max(
    ...predictions.map((p) => p.predicted_quantity),
    1,
  )
  const minQuantity = Math.min(
    ...predictions.map((p) => p.predicted_quantity),
    0,
  )

  // Custom tooltip para mostrar información detallada
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-sm mb-2">{data.fullDate}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground text-xs">Predicción:</span>
              <span className="font-semibold text-sm">{data.cantidadFormateada} unidades</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground text-xs">Confianza:</span>
              <Badge
                variant="secondary"
                className={`text-xs ${getConfidenceColor(data.confianza)}`}
              >
                {data.confianza}%
              </Badge>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  // Custom label para el eje X
  const CustomXAxisLabel = (props: any) => {
    const { x, y, payload } = props
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={16}
          textAnchor="middle"
          fill="hsl(var(--muted-foreground))"
          className="text-xs"
        >
          {payload.value}
        </text>
      </g>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Predicción de Demanda
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
        <div className="mt-4">
          <Label htmlFor="daysAhead">Días hacia adelante</Label>
          <Input
            id="daysAhead"
            type="number"
            min="1"
            max="90"
            value={daysAhead}
            onChange={(e) => setDaysAhead(Math.max(1, Math.min(90, parseInt(e.target.value) || 7)))}
            className="mt-2 w-32"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-8" />
          </div>
        ) : predictions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              No hay datos históricos suficientes para generar una predicción
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Gráfico avanzado con recharts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Predicciones de Demanda</h4>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary/80"></div>
                    <span>Predicción</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary/20"></div>
                    <span>Área de confianza</span>
                  </div>
                </div>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      opacity={0.3}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={<CustomXAxisLabel />}
                      stroke="hsl(var(--muted-foreground))"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      style={{ fontSize: '12px' }}
                      label={{
                        value: 'Unidades',
                        angle: -90,
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))', fontSize: '12px' },
                      }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
                      iconType="line"
                    />
                    {/* Área con gradiente para visualización suave */}
                    <Area
                      type="monotone"
                      dataKey="cantidad"
                      stroke="none"
                      fill="url(#colorArea)"
                      fillOpacity={0.4}
                    />
                    {/* Línea principal de predicción */}
                    <Line
                      type="monotone"
                      dataKey="cantidad"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 5, stroke: 'hsl(var(--background))' }}
                      activeDot={{ r: 7, strokeWidth: 2 }}
                      name="Predicción"
                    />
                    {/* Línea de referencia para promedio si hay variación */}
                    {maxQuantity !== minQuantity && (
                      <ReferenceLine
                        y={(maxQuantity + minQuantity) / 2}
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="5 5"
                        strokeOpacity={0.5}
                        label={{ value: 'Promedio', position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: '10px' }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              
              {/* Indicadores de confianza por día */}
              <div className="border-t pt-4">
                <h5 className="text-xs font-semibold mb-2 text-muted-foreground">Nivel de Confianza por Día</h5>
                <div className="flex gap-1 justify-between items-end h-16">
                  {chartData.map((item, index) => {
                    const height = (item.confianza / 100) * 64
                    return (
                      <div
                        key={index}
                        className="flex-1 flex flex-col items-center group cursor-pointer"
                        title={`${item.date}: ${item.confianza}% confianza`}
                      >
                        <div
                          className="w-full rounded-t transition-all hover:opacity-80 relative"
                          style={{
                            height: `${height}px`,
                            backgroundColor: `hsl(var(--primary))`,
                            opacity: item.confianza / 100,
                          }}
                        >
                          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                              {item.confianza}%
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.date}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Métricas */}
            {data?.metrics && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-2">Métricas del Modelo</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">MAE</p>
                    <p className="font-semibold">{data.metrics.mae.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">RMSE</p>
                    <p className="font-semibold">{data.metrics.rmse.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">MAPE</p>
                    <p className="font-semibold">{data.metrics.mape.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">R²</p>
                    <p className="font-semibold">{data.metrics.r2.toFixed(3)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Resumen */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Promedio de confianza:</span>
                <span className="font-semibold">
                  {formatConfidenceScore(
                    predictions.reduce((sum, p) => sum + p.confidence_score, 0) /
                      predictions.length,
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">Modelo usado:</span>
                <span className="font-semibold">
                  {predictions[0]?.model_used === 'fallback' 
                    ? 'Promedio Simple (datos insuficientes)' 
                    : predictions[0]?.model_used === 'ensemble'
                    ? 'Ensemble (Exponential Smoothing + ARIMA)'
                    : predictions[0]?.model_used || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

