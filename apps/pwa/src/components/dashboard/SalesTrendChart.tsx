import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

interface SalesTrendData {
  date: string
  count: number
  amount_bs: number
  amount_usd: number
}

interface SalesTrendChartProps {
  data: SalesTrendData[]
  currency?: 'BS' | 'USD'
}

const formatCurrency = (value: number, currency: 'BS' | 'USD') => {
  if (currency === 'USD') {
    return `$${value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `Bs. ${value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    value: number
    dataKey: string
    color: string
    payload?: {
      date: string
      formattedDate: string
      amount: number
      count: number
    }
  }>
  currency: 'BS' | 'USD'
}

const CustomTooltip = ({ active, payload, currency }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    // Obtener la fecha original del payload (no usar label que está formateado)
    const firstPayload = payload[0]?.payload
    const dateString = firstPayload?.date
    
    if (!dateString) {
      return null
    }
    
    // Validar y parsear la fecha
    let date: Date
    try {
      date = parseISO(dateString)
      
      // Verificar que la fecha sea válida
      if (isNaN(date.getTime())) {
        console.warn('[SalesTrendChart] Invalid date:', dateString)
        return null
      }
    } catch (error) {
      console.warn('[SalesTrendChart] Error parsing date:', dateString, error)
      return null
    }
    
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[180px]">
        <p className="font-semibold text-foreground mb-2">
          {format(date, "EEEE, d 'de' MMMM", { locale: es })}
        </p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-muted-foreground">
                  {entry.dataKey === 'amount' ? 'Monto' : 'Ventas'}
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {entry.dataKey === 'amount'
                  ? formatCurrency(entry.value, currency)
                  : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

export default function SalesTrendChart({ data, currency = 'BS' }: SalesTrendChartProps) {
  const chartData = useMemo(() => {
    return data.map((item) => ({
      date: item.date,
      amount: currency === 'BS' ? item.amount_bs : item.amount_usd,
      count: item.count,
      formattedDate: format(parseISO(item.date), 'dd/MM'),
    }))
  }, [data, currency])

  const maxAmount = useMemo(() => {
    return Math.max(...chartData.map((d) => d.amount), 0)
  }, [chartData])

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        No hay datos de ventas disponibles
      </div>
    )
  }

  return (
    <div className="h-[300px] w-full min-h-0">
      <ResponsiveContainer width="100%" height="100%" minHeight={0}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
          <XAxis
            dataKey="formattedDate"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            dy={10}
          />
          <YAxis
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickFormatter={(value) =>
              value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
            }
            domain={[0, maxAmount * 1.1]}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            domain={[0, 'auto']}
          />
          <Tooltip content={<CustomTooltip currency={currency} />} />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => (
              <span className="text-sm text-muted-foreground">
                {value === 'amount' ? `Monto (${currency})` : 'Cantidad de ventas'}
              </span>
            )}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="amount"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorAmount)"
            activeDot={{
              r: 6,
              stroke: 'hsl(var(--primary))',
              strokeWidth: 2,
              fill: 'hsl(var(--background))',
            }}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="count"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorCount)"
            activeDot={{
              r: 6,
              stroke: 'hsl(var(--chart-2))',
              strokeWidth: 2,
              fill: 'hsl(var(--background))',
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
