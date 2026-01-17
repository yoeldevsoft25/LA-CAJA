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
} from 'recharts'
import { formatQuantity } from '@/lib/weight'

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
}

const formatCurrency = (value: number, currency: 'BS' | 'USD') => {
  if (currency === 'USD') {
    return `$${value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `Bs. ${value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Paleta de colores vibrante
const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7c43',
  '#a4de6c',
]

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
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[200px]">
        <p className="font-semibold text-foreground mb-2 line-clamp-2">
          {data.fullName}
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Ingresos:</span>
            <span className="text-sm font-medium text-foreground">
              {formatCurrency(data.revenue, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Cantidad:</span>
            <span className="text-sm font-medium text-foreground">
              {data.quantity}
            </span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export default function TopProductsChart({
  data,
  currency = 'BS',
  limit = 10,
}: TopProductsChartProps) {
  const chartData = useMemo(() => {
    return data.slice(0, limit).map((item, index) => ({
      name: item.product_name.length > 20
        ? `${item.product_name.substring(0, 20)}...`
        : item.product_name,
      fullName: item.product_name,
      revenue: currency === 'BS' ? item.revenue_bs : item.revenue_usd,
      quantity: formatQuantity(
        item.quantity_sold,
        item.is_weight_product,
        item.weight_unit
      ),
      index,
    }))
  }, [data, currency, limit])

  if (!data || data.length === 0) {
    return (
      <div className="h-[350px] flex items-center justify-center text-muted-foreground">
        No hay datos de productos disponibles
      </div>
    )
  }

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            horizontal={true}
            vertical={false}
          />
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickFormatter={(value) =>
              value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()
            }
          />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            width={120}
          />
          <Tooltip
            content={<CustomTooltip currency={currency} />}
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
          />
          <Bar
            dataKey="revenue"
            radius={[0, 4, 4, 0]}
            maxBarSize={30}
          >
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
