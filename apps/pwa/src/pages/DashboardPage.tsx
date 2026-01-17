import { useState, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '@/stores/auth.store'
import {
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  ShoppingCart,
  ReceiptText,
  BarChart3,
  ArrowUpRight,
  Printer,
  FileSpreadsheet,
} from 'lucide-react'
import { exportDashboardToExcel } from '@/utils/export-excel'
import toast from 'react-hot-toast'
import ExpiringLotsAlert from '@/components/lots/ExpiringLotsAlert'
import PendingOrdersIndicator from '@/components/suppliers/PendingOrdersIndicator'
import { dashboardService } from '@/services/dashboard.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatQuantity } from '@/lib/weight'
import SalesTrendChart from '@/components/dashboard/SalesTrendChart'
import TopProductsChart from '@/components/dashboard/TopProductsChart'
import DashboardPrintView from '@/components/dashboard/DashboardPrintView'

const formatCurrency = (amount: number, currency: 'BS' | 'USD' = 'BS') => {
  if (currency === 'USD') {
    return `$${Number(amount).toFixed(2)}`
  }
  return `Bs. ${Number(amount).toFixed(2)}`
}

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('es-VE').format(num)
}

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    label: string
  }
  color?: 'blue' | 'green' | 'red' | 'orange' | 'purple'
  icon?: React.ReactNode
  link?: string
}

function KPICard({
  title,
  value,
  subtitle,
  trend,
  color = 'blue',
  icon,
  link,
}: KPICardProps) {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    orange: 'text-orange-600',
    purple: 'text-purple-600',
  }

  const content = (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs sm:text-sm text-muted-foreground font-medium">
            {title}
          </h3>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        <p className={`text-xl sm:text-2xl font-bold ${colorClasses[color]}`}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {subtitle}
          </p>
        )}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend.value >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
            <p
              className={`text-xs ${
                trend.value >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend.value >= 0 ? '+' : ''}
              {trend.value.toFixed(1)}% {trend.label}
            </p>
          </div>
        )}
        {link && (
          <Link
            to={link}
            className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1"
          >
            Ver detalles <ArrowUpRight className="w-3 h-3" />
          </Link>
        )}
      </CardContent>
    </Card>
  )

  return content
}

export default function DashboardPage() {
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [chartCurrency, setChartCurrency] = useState<'BS' | 'USD'>('BS')
  const printRef = useRef<HTMLDivElement>(null)

  // Obtener KPIs - SOLO si el usuario es owner
  const {
    data: kpis,
    isLoading: kpisLoading,
    isFetching: kpisFetching,
    dataUpdatedAt: kpisUpdatedAt,
  } = useQuery({
    queryKey: ['dashboard', 'kpis', startDate, endDate],
    queryFn: () =>
      dashboardService.getKPIs(
        startDate || undefined,
        endDate || undefined,
      ),
    enabled: isOwner, // Solo ejecutar si es owner
    staleTime: 1000 * 60 * 2, // 2 minutos - más frecuente porque las queries son más rápidas con vistas materializadas
    refetchInterval: 1000 * 60 * 2, // Refrescar cada 2 minutos
  })

  // Obtener tendencias - SOLO si el usuario es owner
  const {
    data: trends,
    isLoading: trendsLoading,
    isFetching: trendsFetching,
  } = useQuery({
    queryKey: ['dashboard', 'trends'],
    queryFn: () => dashboardService.getTrends(),
    enabled: isOwner, // Solo ejecutar si es owner
    staleTime: 1000 * 60 * 2, // 2 minutos
    refetchInterval: 1000 * 60 * 2, // Refrescar cada 2 minutos
  })

  // Función para imprimir/exportar PDF
  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  // Función para exportar a Excel/CSV
  const handleExportExcel = useCallback(() => {
    if (!kpis || !trends) {
      toast.error('No hay datos disponibles para exportar')
      return
    }
    
    try {
      exportDashboardToExcel(kpis, trends, { start: startDate, end: endDate })
      toast.success('Reporte exportado exitosamente')
    } catch (error) {
      toast.error('Error al exportar reporte')
      console.error('Error exporting to Excel:', error)
    }
  }, [kpis, trends, startDate, endDate])

  const isLoading = kpisLoading || trendsLoading
  const isFetching = kpisFetching || trendsFetching

  return (
    <>
    <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-6 print:hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                Dashboard Ejecutivo
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Resumen de KPIs y métricas del negocio
              </p>
            </div>
            {isFetching && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                Actualizando datos...
              </div>
            )}
            {!isFetching && kpisUpdatedAt && (
              <div className="text-xs text-muted-foreground">
                Actualizado: {new Date(kpisUpdatedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-end">
          <div className="flex flex-col gap-1">
            <Label htmlFor="startDate" className="text-xs">
              Fecha Inicio
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full sm:w-[150px]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="endDate" className="text-xs">
              Fecha Fin
            </Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full sm:w-[150px]"
            />
          </div>
          {/* Botones de exportar */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="default"
              onClick={handleExportExcel}
              disabled={isLoading || !kpis || !trends}
              className="gap-2 print:hidden"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button
              variant="outline"
              size="default"
              onClick={handlePrint}
              disabled={isLoading || !kpis || !trends}
              className="gap-2 print:hidden"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </div>
      ) : !kpis || !trends ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No hay datos disponibles</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs Principales - Ventas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Ventas Hoy"
              value={formatNumber(kpis.sales.today_count)}
              subtitle={`${formatCurrency(kpis.sales.today_amount_bs, 'BS')} / ${formatCurrency(kpis.sales.today_amount_usd, 'USD')}`}
              color="blue"
              icon={<DollarSign className="w-5 h-5" />}
              link="/app/sales"
            />
            <KPICard
              title="Ventas del Período"
              value={formatNumber(kpis.sales.period_count)}
              subtitle={`${formatCurrency(kpis.sales.period_amount_bs, 'BS')} / ${formatCurrency(kpis.sales.period_amount_usd, 'USD')}`}
              color="green"
              icon={<ShoppingCart className="w-5 h-5" />}
              link="/app/sales"
            />
            <KPICard
              title="Crecimiento"
              value={`${kpis.sales.growth_percentage >= 0 ? '+' : ''}${kpis.sales.growth_percentage.toFixed(1)}%`}
              subtitle="vs período anterior"
              color={kpis.sales.growth_percentage >= 0 ? 'green' : 'red'}
              icon={
                kpis.sales.growth_percentage >= 0 ? (
                  <TrendingUp className="w-5 h-5" />
                ) : (
                  <TrendingDown className="w-5 h-5" />
                )
              }
            />
            <KPICard
              title="Ticket Promedio"
              value={formatCurrency(kpis.performance.avg_sale_amount_bs, 'BS')}
              subtitle={formatCurrency(kpis.performance.avg_sale_amount_usd, 'USD')}
              color="purple"
              icon={<ReceiptText className="w-5 h-5" />}
            />
          </div>

          {/* KPIs Secundarios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Inventario */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Inventario
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Total Productos:
                  </span>
                  <span className="font-semibold text-sm">
                    {formatNumber(kpis.inventory.total_products)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Stock Bajo:
                  </span>
                  <Badge variant="destructive" className="text-xs">
                    {formatNumber(kpis.inventory.low_stock_count)}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Por Vencer:
                  </span>
                  <Badge variant="destructive" className="text-xs">
                    {formatNumber(kpis.inventory.expiring_soon_count)}
                  </Badge>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">
                    Valor Inventario:
                  </p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(kpis.inventory.total_stock_value_bs, 'BS')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(kpis.inventory.total_stock_value_usd, 'USD')}
                  </p>
                </div>
                <Link
                  to="/app/inventory"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-2"
                >
                  Ver inventario <ArrowUpRight className="w-3 h-3" />
                </Link>
              </CardContent>
            </Card>

            {/* Finanzas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Finanzas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Deuda Total:
                  </span>
                  <span className="font-semibold text-sm text-red-600">
                    {formatCurrency(kpis.finances.total_debt_bs, 'BS')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Cobrado:
                  </span>
                  <span className="font-semibold text-sm text-green-600">
                    {formatCurrency(kpis.finances.total_collected_bs, 'BS')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Pendiente:
                  </span>
                  <span className="font-semibold text-sm text-orange-600">
                    {formatCurrency(kpis.finances.pending_collections_bs, 'BS')}
                  </span>
                </div>
                <Link
                  to="/app/debts"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-2"
                >
                  Ver detalles <ArrowUpRight className="w-3 h-3" />
                </Link>
              </CardContent>
            </Card>

            {/* Compras */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Compras
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Pendientes:
                  </span>
                  <Badge variant="destructive" className="text-xs">
                    {formatNumber(kpis.purchases.pending_orders)}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Completadas:
                  </span>
                  <Badge variant="default" className="text-xs bg-green-600">
                    {formatNumber(kpis.purchases.completed_orders)}
                  </Badge>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">
                    Total Compras:
                  </p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(kpis.purchases.total_purchases_bs, 'BS')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(kpis.purchases.total_purchases_usd, 'USD')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Fiscal */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ReceiptText className="w-4 h-4" />
                  Facturación Fiscal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Emitidas:
                  </span>
                  <Badge variant="default" className="text-xs bg-green-600">
                    {formatNumber(kpis.fiscal.issued_invoices)}
                  </Badge>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">
                    Total Facturado:
                  </p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(kpis.fiscal.total_fiscal_amount_bs, 'BS')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(kpis.fiscal.total_fiscal_amount_usd, 'USD')}
                  </p>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">
                    Impuestos:
                  </p>
                  <p className="text-sm font-semibold text-blue-600">
                    {formatCurrency(kpis.fiscal.total_tax_collected_bs, 'BS')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(kpis.fiscal.total_tax_collected_usd, 'USD')}
                  </p>
                </div>
                <Link
                  to="/app/fiscal-invoices"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-2"
                >
                  Ver facturas <ArrowUpRight className="w-3 h-3" />
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Performance y Top Productos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Producto */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">
                  Producto Más Vendido
                </CardTitle>
              </CardHeader>
              <CardContent>
                {kpis.performance.top_selling_product ? (
                  <div>
                    <p className="text-lg sm:text-xl font-bold text-primary">
                      {kpis.performance.top_selling_product.name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Cantidad vendida:{' '}
                      <span className="font-semibold">
                        {formatQuantity(
                          kpis.performance.top_selling_product.quantity_sold,
                          kpis.performance.top_selling_product.is_weight_product,
                          kpis.performance.top_selling_product.weight_unit,
                        )}
                      </span>
                    </p>
                    <Link
                      to="/app/products"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-2"
                    >
                      Ver producto <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No hay datos disponibles
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Categoría Más Vendida */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">
                  Categoría Más Vendida
                </CardTitle>
              </CardHeader>
              <CardContent>
                {kpis.performance.best_selling_category ? (
                  <div>
                    <p className="text-lg sm:text-xl font-bold text-green-600">
                      {kpis.performance.best_selling_category}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No hay datos disponibles
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Alertas y Indicadores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <ExpiringLotsAlert variant="card" />
            <PendingOrdersIndicator variant="card" />
          </div>

          {/* Gráfico de Tendencias de Ventas - Interactivo */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base sm:text-lg">
                Tendencias de Ventas (Últimos 7 Días)
              </CardTitle>
              <Tabs
                value={chartCurrency}
                onValueChange={(v) => setChartCurrency(v as 'BS' | 'USD')}
                className="w-auto"
              >
                <TabsList className="h-8">
                  <TabsTrigger value="BS" className="text-xs px-3 h-7">
                    Bs.
                  </TabsTrigger>
                  <TabsTrigger value="USD" className="text-xs px-3 h-7">
                    USD
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <SalesTrendChart data={trends.sales_trend} currency={chartCurrency} />
            </CardContent>
          </Card>

          {/* Top 10 Productos de la Semana - Grid con Gráfico y Tabla */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Gráfico de Barras Horizontal */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base sm:text-lg">
                  Top Productos por Ingresos
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {chartCurrency}
                </Badge>
              </CardHeader>
              <CardContent>
                <TopProductsChart
                  data={trends.top_products_trend}
                  currency={chartCurrency}
                  limit={10}
                />
              </CardContent>
            </Card>

            {/* Tabla Detallada */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">
                  Detalle Top 10 Productos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead className="text-right">Ingresos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trends.top_products_trend.length > 0 ? (
                        trends.top_products_trend.map((product, index) => (
                          <TableRow key={product.product_id} className="hover:bg-muted/50">
                            <TableCell>
                              <Badge
                                variant={index < 3 ? 'default' : 'secondary'}
                                className={
                                  index === 0
                                    ? 'bg-amber-500 hover:bg-amber-600'
                                    : index === 1
                                      ? 'bg-slate-400 hover:bg-slate-500'
                                      : index === 2
                                        ? 'bg-orange-600 hover:bg-orange-700'
                                        : ''
                                }
                              >
                                {index + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium max-w-[150px] truncate" title={product.product_name}>
                              {product.product_name}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {formatQuantity(
                                product.quantity_sold,
                                product.is_weight_product,
                                product.weight_unit,
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div>
                                <span className="font-semibold text-sm">
                                  {formatCurrency(product.revenue_bs, 'BS')}
                                </span>
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrency(product.revenue_usd, 'USD')}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            No hay datos disponibles
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

    </div>

    {/* Vista de Impresión (solo visible al imprimir) */}
    {kpis && trends && (
      <DashboardPrintView
        ref={printRef}
        kpis={kpis}
        trends={trends}
        dateRange={{ start: startDate, end: endDate }}
      />
    )}
    </>
  )
}
