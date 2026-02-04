import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import { formatQuantity } from '@/lib/weight'
import { useMobileDetection } from '@/hooks/use-mobile-detection'

/**
 * Obtiene el valor de una variable CSS como HSL completo
 */
function getCSSVariableAsHSL(variable: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const root = document.documentElement
    const value = getComputedStyle(root).getPropertyValue(variable).trim()
    if (!value) return null
    return `hsl(${value})`
  } catch {
    return null
  }
}

interface TopProductData {
  product_id: string
  product_name: string
  quantity_sold: number
  revenue_bs: number
  revenue_usd: number
  is_weight_product: boolean
  weight_unit: 'kg' | 'g' | 'lb' | 'oz' | null
}

interface TopProductsChartProps {
  data: TopProductData[]
  currency?: 'BS' | 'USD'
  limit?: number
  /** Ordenar por cantidad vendida o por ingresos. Por defecto 'revenue'. */
  sortBy?: 'quantity' | 'revenue'
}

const formatCurrency = (value: number, currency: 'BS' | 'USD') => {
  if (currency === 'USD') {
    return `$${value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `Bs. ${value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Paleta de colores moderna con gradientes
 * Colores más cohesivos y profesionales
 */
function getColors(): string[] {
  const primary = getCSSVariableAsHSL('--primary') ?? 'hsl(221, 83%, 53%)'
  return [
    primary,
    getCSSVariableAsHSL('--chart-2') ?? 'hsl(173, 80%, 40%)',
    getCSSVariableAsHSL('--chart-3') ?? 'hsl(262, 83%, 58%)',
    getCSSVariableAsHSL('--chart-4') ?? 'hsl(350, 89%, 60%)',
    getCSSVariableAsHSL('--chart-5') ?? 'hsl(38, 92%, 50%)',
    'hsl(221, 83%, 53%)', // Azul
    'hsl(173, 80%, 40%)', // Turquesa
    'hsl(262, 83%, 58%)', // Púrpura
    'hsl(350, 89%, 60%)', // Rojo
    'hsl(38, 92%, 50%)',  // Naranja
  ]
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    payload: {
      name: string
      revenue: number
      quantity: string
      fullName: string
    }
  }>
  currency: 'BS' | 'USD'
}

const CustomTooltip = ({ active, payload, currency }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl p-4 min-w-[220px] backdrop-blur-sm">
        <p className="font-semibold text-foreground mb-3 text-base line-clamp-2 border-b border-border pb-2">
          {data.fullName}
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Ingresos:</span>
            <span className="text-sm font-bold text-foreground">
              {formatCurrency(data.revenue, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Cantidad:</span>
            <span className="text-sm font-semibold text-foreground">
              {data.quantity}
            </span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

// Componente para mostrar el valor en la barra
const CustomLabel = ({ x, y, width, value }: any) => {
  if (!value || width < 50) return null // No mostrar si la barra es muy pequeña
  
  const formattedValue = value >= 1000 
    ? `${(value / 1000).toFixed(1)}k` 
    : value.toFixed(0)
  
  return (
    <text
      x={x + width - 8}
      y={y + 15}
      fill="hsl(var(--foreground))"
      textAnchor="end"
      fontSize={11}
      fontWeight={600}
      className="drop-shadow-sm"
    >
      {formattedValue}
    </text>
  )
}

export default function TopProductsChart({
  data,
  currency = 'BS',
  limit = 10,
  sortBy = 'revenue',
}: TopProductsChartProps) {
  const isMobile = useMobileDetection()
  const colors = useMemo(() => getColors(), [])
  
  const chartData = useMemo(() => {
    const sortedData = [...data].sort((a, b) => {
      if (sortBy === 'quantity') {
        return b.quantity_sold - a.quantity_sold
      }
      const revenueA = currency === 'BS' ? a.revenue_bs : a.revenue_usd
      const revenueB = currency === 'BS' ? b.revenue_bs : b.revenue_usd
      return revenueB - revenueA
    })
    
    const maxRevenue = sortedData.length > 0 
      ? (currency === 'BS' ? sortedData[0].revenue_bs : sortedData[0].revenue_usd)
      : 1
    
    return sortedData.slice(0, limit).map((item, index) => {
      const revenue = currency === 'BS' ? item.revenue_bs : item.revenue_usd
      return {
        name: isMobile && item.product_name.length > 15
          ? `${item.product_name.substring(0, 15)}...`
          : item.product_name.length > 25
          ? `${item.product_name.substring(0, 25)}...`
          : item.product_name,
        fullName: item.product_name,
        revenue,
        quantity: formatQuantity(
          item.quantity_sold,
          item.is_weight_product,
          item.weight_unit
        ),
        percentage: maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0,
        index,
      }
    })
  }, [data, currency, limit, sortBy, isMobile])

  if (!data || data.length === 0) {
    return (
      <div className="h-[350px] sm:h-[400px] flex flex-col items-center justify-center text-muted-foreground space-y-2">
        <p className="text-sm sm:text-base">No hay datos de productos disponibles</p>
        <p className="text-xs text-muted-foreground">Los productos aparecerán aquí cuando haya ventas</p>
      </div>
    )
  }

  const maxRevenue = chartData.length > 0 ? chartData[0].revenue : 1

  return (
    <div className="h-[350px] sm:h-[400px] w-full min-h-0">
      <ResponsiveContainer width="100%" height="100%" minHeight={0}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ 
            top: 10, 
            right: isMobile ? 50 : 80, 
            left: isMobile ? 10 : 20, 
            bottom: 10 
          }}
        >
          <defs>
            {colors.map((color, index) => (
              <linearGradient key={index} id={`gradient-${index}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={color} stopOpacity={0.7} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            horizontal={true}
            vertical={false}
            opacity={0.3}
          />
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ 
              fill: 'hsl(var(--muted-foreground))', 
              fontSize: isMobile ? 10 : 12,
              fontWeight: 500,
            }}
            tickFormatter={(value) => {
              if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
              if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
              return value.toString()
            }}
            domain={[0, maxRevenue * 1.1]}
          />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ 
              fill: 'hsl(var(--foreground))', 
              fontSize: isMobile ? 10 : 12,
              fontWeight: 500,
            }}
            width={isMobile ? 100 : 140}
          />
          <Tooltip
            content={<CustomTooltip currency={currency} />}
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
          />
          <Bar
            dataKey="revenue"
            radius={[0, 6, 6, 0]}
            maxBarSize={isMobile ? 35 : 40}
          >
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={`url(#gradient-${index % colors.length})`}
              />
            ))}
            <LabelList
              content={<CustomLabel />}
              position="right"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
