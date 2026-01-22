import { useMemo } from 'react'
import { format, getHours } from 'date-fns'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Sale } from '@/services/sales.service'
import { useMobileDetection } from '@/hooks/use-mobile-detection'

interface DailySalesChartProps {
  sales: Sale[]
  date: Date
  isLoading?: boolean
}

interface HourlyData {
  hour: number
  hourLabel: string
  total_bs: number
  total_usd: number
  sales_count: number
  avg_ticket_bs: number
  avg_ticket_usd: number
}

/**
 * Componente de gráfico de ventas del día agrupadas por hora
 * Muestra la evolución de ventas durante el día con métricas clave
 */
export default function DailySalesChart({
  sales,
  date,
  isLoading = false,
}: DailySalesChartProps) {
  const isMobile = useMobileDetection()

  // Agrupar ventas por hora
  const hourlyData = useMemo(() => {
    // Inicializar todas las horas del día (0-23) con valores en 0
    const hoursMap = new Map<number, HourlyData>()
    
    for (let hour = 0; hour < 24; hour++) {
      hoursMap.set(hour, {
        hour,
        hourLabel: `${hour.toString().padStart(2, '0')}:00`,
        total_bs: 0,
        total_usd: 0,
        sales_count: 0,
        avg_ticket_bs: 0,
        avg_ticket_usd: 0,
      })
    }

    // Agrupar ventas por hora
    sales.forEach((sale) => {
      const saleDate = new Date(sale.sold_at)
      const hour = getHours(saleDate)
      
      const hourData = hoursMap.get(hour)!
      hourData.sales_count += 1
      hourData.total_bs += Number(sale.totals.total_bs)
      hourData.total_usd += Number(sale.totals.total_usd)
    })

    // Calcular promedios
    hoursMap.forEach((data) => {
      if (data.sales_count > 0) {
        data.avg_ticket_bs = data.total_bs / data.sales_count
        data.avg_ticket_usd = data.total_usd / data.sales_count
      }
    })

    // Convertir a array y filtrar solo horas con ventas o las horas activas del día
    const now = new Date()
    const isToday = format(date, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')
    const currentHour = isToday ? getHours(now) : 23

    return Array.from(hoursMap.values())
      .filter((data) => {
        // Mostrar todas las horas hasta la hora actual si es hoy, o todas si es otro día
        return data.hour <= currentHour
      })
      .map((data) => ({
        ...data,
        // Formato más legible para mobile
        hourLabelShort: isMobile 
          ? `${data.hour}h` 
          : data.hourLabel,
      }))
  }, [sales, date, isMobile])

  // Calcular métricas totales del día
  const dayMetrics = useMemo(() => {
    const total = sales.reduce(
      (acc, sale) => ({
        total_bs: acc.total_bs + Number(sale.totals.total_bs),
        total_usd: acc.total_usd + Number(sale.totals.total_usd),
        sales_count: acc.sales_count + 1,
      }),
      { total_bs: 0, total_usd: 0, sales_count: 0 }
    )

    return {
      ...total,
      avg_ticket_bs: total.sales_count > 0 ? total.total_bs / total.sales_count : 0,
      avg_ticket_usd: total.sales_count > 0 ? total.total_usd / total.sales_count : 0,
    }
  }, [sales])

  // Encontrar hora pico
  const peakHour = useMemo(() => {
    if (hourlyData.length === 0) return null
    return hourlyData.reduce((max, hour) =>
      hour.total_usd > max.total_usd ? hour : max
    )
  }, [hourlyData])

  if (isLoading) {
    return (
      <Card className="mb-4 sm:mb-6 border border-border">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            Ventas del Día - {format(date, 'dd/MM/yyyy')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] sm:h-[400px] flex items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (sales.length === 0) {
    return (
      <Card className="mb-4 sm:mb-6 border border-border">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            Ventas del Día - {format(date, 'dd/MM/yyyy')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] sm:h-[400px] flex flex-col items-center justify-center text-muted-foreground space-y-2">
            <p className="text-sm sm:text-base">No hay ventas registradas</p>
            <p className="text-xs text-muted-foreground">
              Las ventas del día aparecerán aquí
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Custom tooltip mejorado
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload as HourlyData
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3 sm:p-4 min-w-[200px]">
          <p className="text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">
            {data.hourLabel}
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: 'hsl(var(--primary))' }}
                />
                <span className="text-xs sm:text-sm text-muted-foreground">Total Bs</span>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-foreground">
                {data.total_bs.toLocaleString('es-VE', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                Bs
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: 'hsl(var(--chart-2))' }}
                />
                <span className="text-xs sm:text-sm text-muted-foreground">Total USD</span>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-foreground">
                ${data.total_usd.toLocaleString('es-VE', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
              <span className="text-xs sm:text-sm text-muted-foreground">Ventas</span>
              <span className="text-xs sm:text-sm font-semibold text-foreground">
                {data.sales_count}
              </span>
            </div>
            {data.sales_count > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs sm:text-sm text-muted-foreground">Ticket Promedio</span>
                <span className="text-xs sm:text-sm font-medium text-foreground">
                  ${data.avg_ticket_usd.toLocaleString('es-VE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  const maxValue = Math.max(
    ...hourlyData.map((d) => Math.max(d.total_bs, d.total_usd)),
    1
  )

  return (
    <Card className="mb-4 sm:mb-6 border border-border">
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <CardTitle className="text-base sm:text-lg">
            Ventas del Día - {format(date, 'dd/MM/yyyy')}
          </CardTitle>
          
          {/* Métricas resumidas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm">
            <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
              <p className="text-muted-foreground mb-1">Total Bs</p>
              <p className="font-bold text-foreground">
                {dayMetrics.total_bs.toLocaleString('es-VE', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
              <p className="text-muted-foreground mb-1">Total USD</p>
              <p className="font-bold text-foreground">
                ${dayMetrics.total_usd.toLocaleString('es-VE', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
              <p className="text-muted-foreground mb-1">Ventas</p>
              <p className="font-bold text-foreground">{dayMetrics.sales_count}</p>
            </div>
            {peakHour && (
              <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
                <p className="text-muted-foreground mb-1">Hora Pico</p>
                <p className="font-bold text-foreground">{peakHour.hourLabel}</p>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] sm:h-[400px] w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%" minHeight={0}>
            <AreaChart
              data={hourlyData}
              margin={{
                top: 10,
                right: isMobile ? 5 : 20,
                left: isMobile ? -10 : 0,
                bottom: isMobile ? 5 : 10,
              }}
            >
              <defs>
                <linearGradient id="colorBs" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="colorUsd" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--chart-2))"
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--chart-2))"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey={isMobile ? 'hourLabelShort' : 'hourLabel'}
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: isMobile ? 10 : 12,
                }}
                dy={10}
                interval={isMobile ? 2 : 0}
              />
              <YAxis
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: isMobile ? 10 : 12,
                }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
                  return value.toString()
                }}
                width={isMobile ? 40 : 60}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                iconType="circle"
                formatter={(value) => {
                  if (value === 'total_bs') return 'Total Bs'
                  if (value === 'total_usd') return 'Total USD'
                  return value
                }}
                wrapperStyle={{
                  fontSize: isMobile ? '11px' : '12px',
                  paddingTop: '8px',
                }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="total_bs"
                stroke="hsl(var(--primary))"
                strokeWidth={isMobile ? 2 : 2.5}
                fillOpacity={1}
                fill="url(#colorBs)"
                activeDot={{
                  r: isMobile ? 5 : 6,
                  stroke: 'hsl(var(--primary))',
                  strokeWidth: 2,
                  fill: 'hsl(var(--background))',
                }}
                name="total_bs"
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="total_usd"
                stroke="hsl(var(--chart-2))"
                strokeWidth={isMobile ? 2 : 2.5}
                fillOpacity={1}
                fill="url(#colorUsd)"
                activeDot={{
                  r: isMobile ? 5 : 6,
                  stroke: 'hsl(var(--chart-2))',
                  strokeWidth: 2,
                  fill: 'hsl(var(--background))',
                }}
                name="total_usd"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
