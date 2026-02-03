import { useState } from 'react'
import { useSalesHeatmap } from '@/hooks/useSalesHeatmap'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@la-caja/ui-core'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar } from 'lucide-react'
import { format, subDays } from 'date-fns'

export default function SalesHeatmapChart() {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7))
  const [endDate, setEndDate] = useState<Date>(new Date())

  const { data, isLoading, error } = useSalesHeatmap(startDate, endDate)

  // Organizar datos por día y hora
  const heatmapData = new Map<string, Map<number, number>>()

  data.forEach((item) => {
    const dateKey = format(new Date(item.date), 'yyyy-MM-dd')
    if (!heatmapData.has(dateKey)) {
      heatmapData.set(dateKey, new Map())
    }
    const dayData = heatmapData.get(dateKey)!
    dayData.set(item.hour, item.sales_count)
  })

  // Obtener rango de horas
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const dates = Array.from(heatmapData.keys()).sort()

  // Calcular máximo para normalizar colores
  const maxValue = Math.max(
    ...data.map((d) => d.sales_count),
    1,
  )

  const getColorIntensity = (value: number): string => {
    if (value === 0) return 'bg-gray-100'
    const intensity = Math.min(value / maxValue, 1)
    if (intensity < 0.3) return 'bg-blue-200'
    if (intensity < 0.6) return 'bg-blue-400'
    if (intensity < 0.8) return 'bg-blue-600'
    return 'bg-blue-800'
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Error al cargar heatmap</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Heatmap de Ventas
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <div>
              <Label htmlFor="startDate" className="text-xs">
                Fecha Inicio
              </Label>
              <Input
                id="startDate"
                type="date"
                value={format(startDate, 'yyyy-MM-dd')}
                onChange={(e) =>
                  setStartDate(new Date(e.target.value))
                }
                className="w-full sm:w-[150px]"
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="text-xs">
                Fecha Fin
              </Label>
              <Input
                id="endDate"
                type="date"
                value={format(endDate, 'yyyy-MM-dd')}
                onChange={(e) => setEndDate(new Date(e.target.value))}
                className="w-full sm:w-[150px]"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-96" />
        ) : dates.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No hay datos para el período seleccionado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Header con horas */}
              <div className="flex mb-2">
                <div className="w-24 flex-shrink-0"></div>
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="flex-1 text-xs text-center text-muted-foreground px-1"
                  >
                    {hour}h
                  </div>
                ))}
              </div>

              {/* Filas por día */}
              <div className="space-y-1.5 min-w-[600px] md:min-w-0">
                {dates.map((dateKey) => {
                  const dayData = heatmapData.get(dateKey)!
                  return (
                    <div key={dateKey} className="flex items-center gap-1 sm:gap-1.5">
                      <div className="w-16 sm:w-24 flex-shrink-0 text-[10px] sm:text-xs font-medium text-muted-foreground">
                        {format(new Date(dateKey), 'dd/MM')}
                      </div>
                      {hours.map((hour) => {
                        const value = dayData.get(hour) || 0
                        const item = data.find(
                          (d) =>
                            format(new Date(d.date), 'yyyy-MM-dd') === dateKey &&
                            d.hour === hour,
                        )
                        return (
                          <div
                            key={hour}
                            className={`flex-1 h-6 sm:h-8 rounded-[2px] sm:rounded ${getColorIntensity(value)} hover:ring-1 hover:ring-primary/30 transition-all cursor-pointer relative group`}
                            title={
                              item
                                ? `${item.sales_count} ventas - ${formatCurrency(item.revenue_bs, 'BS')}`
                                : 'Sin ventas'
                            }
                          >
                            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background border shadow-lg text-[10px] sm:text-xs p-2 rounded-md whitespace-nowrap z-50 pointer-events-none">
                              <p className="font-bold">{item ? `${item.sales_count} ventas` : 'Sin ventas'}</p>
                              {item && <p className="text-primary">{formatCurrency(item.revenue_bs, 'BS')}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {/* Leyenda */}
              <div className="mt-4 flex items-center justify-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-100 rounded"></div>
                  <span>Sin ventas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-200 rounded"></div>
                  <span>Bajo</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-400 rounded"></div>
                  <span>Medio</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-600 rounded"></div>
                  <span>Alto</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-800 rounded"></div>
                  <span>Muy alto</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Helper para formatear moneda
const formatCurrency = (amount: number, currency: 'BS' | 'USD' = 'BS'): string => {
  if (currency === 'USD') {
    return `$${Number(amount).toFixed(2)}`
  }
  return `Bs. ${Number(amount).toFixed(2)}`
}

