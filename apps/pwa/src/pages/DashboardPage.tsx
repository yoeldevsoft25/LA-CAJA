import { useState, useRef, useCallback, useEffect } from 'react'
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
  AlertCircle,
  CheckCircle2,
  XCircle,
  Settings,
} from 'lucide-react'
import { exportDashboardToExcel } from '@/utils/export-excel'
import toast from '@/lib/toast'
import ExpiringLotsAlert from '@/components/lots/ExpiringLotsAlert'
import PendingOrdersIndicator from '@/components/suppliers/PendingOrdersIndicator'
import { dashboardService } from '@/services/dashboard.service'
import { setupService } from '@/services/setup.service'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatQuantity } from '@/lib/weight'
import SalesTrendChart from '@/components/dashboard/SalesTrendChart'
import TopProductsChart from '@/components/dashboard/TopProductsChart'
import DashboardPrintView from '@/components/dashboard/DashboardPrintView'
import { useNavigate } from 'react-router-dom'
import { StaggerContainer, StaggerItem, FadeInUp } from '@/components/ui/motion-wrapper'
import { cn } from '@/lib/utils'

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
  className?: string
}

function KPICard({
  title,
  value,
  subtitle,
  trend,
  color = 'blue',
  icon,
  link,
  className,
}: KPICardProps) {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    orange: 'text-orange-600',
    purple: 'text-purple-600',
  }

  return (
    <Card className={cn(
      "glass-panel premium-shadow-md hover:premium-shadow-lg transition-all duration-300 border-white/20",
      className
    )}>
      <CardContent className="p-4 sm:p-6 h-full flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm text-muted-foreground font-medium uppercase tracking-wider">
              {title}
            </h3>
            {icon && <div className="p-2 rounded-xl bg-primary/5 text-primary">{icon}</div>}
          </div>
          <p className={`text-2xl sm:text-3xl font-black tracking-tight ${colorClasses[color]}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium italic opacity-80">
              {subtitle}
            </p>
          )}
        </div>

        <div className="mt-4">
          {trend && (
            <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-background/50 w-fit">
              {trend.value >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-green-600 font-bold" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-red-600 font-bold" />
              )}
              <p
                className={`text-xs font-bold ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'
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
              className="text-xs font-bold text-primary hover:text-primary/70 mt-3 flex items-center gap-1 group w-fit transition-colors"
            >
              Ver detalles <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isOwner = user?.role === 'owner'
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [chartCurrency, setChartCurrency] = useState<'BS' | 'USD'>('BS')
  const printRef = useRef<HTMLDivElement>(null)

  // Validar estado de configuración (solo para owners)
  const { data: setupStatus } = useQuery({
    queryKey: ['setup', 'validate'],
    queryFn: () => setupService.validateSetup(),
    enabled: isOwner,
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  // Obtener KPIs - SOLO si el usuario es owner
  const {
    data: kpis,
    isLoading: kpisLoading,
    isFetching: kpisFetching,
    dataUpdatedAt: kpisUpdatedAt,
    error: kpisError,
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
    retry: (failureCount, error: any) => {
      // No reintentar si es error 403 (permisos) o 401 (auth)
      if (error?.response?.status === 403 || error?.response?.status === 401) {
        return false
      }
      return failureCount < 2
    },
  })

  // Obtener tendencias - SOLO si el usuario es owner
  const {
    data: trends,
    isLoading: trendsLoading,
    isFetching: trendsFetching,
    error: trendsError,
  } = useQuery({
    queryKey: ['dashboard', 'trends'],
    queryFn: () => dashboardService.getTrends(),
    enabled: isOwner, // Solo ejecutar si es owner
    staleTime: 1000 * 60 * 2, // 2 minutos
    refetchInterval: 1000 * 60 * 2, // Refrescar cada 2 minutos
    retry: (failureCount, error: any) => {
      // No reintentar si es error 403 (permisos) o 401 (auth)
      if (error?.response?.status === 403 || error?.response?.status === 401) {
        return false
      }
      return failureCount < 2
    },
  })

  // Manejar errores de las queries
  useEffect(() => {
    if (kpisError) {
      const error: any = kpisError
      console.error('[Dashboard] Error cargando KPIs:', error)
      if (error?.response?.status === 403) {
        toast.error('No tienes permisos para ver el dashboard. Se requiere rol de owner.')
      } else if (error?.response?.status !== 401) {
        // No mostrar error si es 401 (el interceptor lo maneja)
        toast.error('Error al cargar los KPIs del dashboard')
      }
    }
  }, [kpisError])

  useEffect(() => {
    if (trendsError) {
      const error: any = trendsError
      console.error('[Dashboard] Error cargando tendencias:', error)
      if (error?.response?.status === 403) {
        toast.error('No tienes permisos para ver las tendencias. Se requiere rol de owner.')
      } else if (error?.response?.status !== 401) {
        toast.error('Error al cargar las tendencias del dashboard')
      }
    }
  }, [trendsError])

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
  const hasError = kpisError || trendsError

  // Si no es owner, mostrar mensaje
  if (!isOwner) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-2xl font-bold mb-2">Acceso Restringido</h2>
            <p className="text-muted-foreground text-center mb-4">
              Esta página requiere permisos de owner. Tu rol actual es: <strong>{user?.role || 'desconocido'}</strong>
            </p>
            <Link to="/app/pos">
              <Button>Ir al POS</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Si hay errores, mostrar información de depuración
  if (hasError) {
    const error = kpisError || trendsError
    const is403 = error?.response?.status === 403
    const errorMessage = error?.response?.data?.message || error?.message || 'Error desconocido'

    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Error al cargar el Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-semibold mb-2">Detalles del error:</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Estado HTTP: {error?.response?.status || 'N/A'}</li>
                <li>Mensaje: {errorMessage}</li>
                <li>Rol del usuario: {user?.role || 'desconocido'}</li>
                <li>Store ID: {user?.store_id || 'N/A'}</li>
                {is403 && (
                  <li className="text-destructive font-semibold">
                    Este endpoint requiere rol 'owner'. Verifica tu token JWT.
                  </li>
                )}
              </ul>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>
                Recargar Página
              </Button>
              <Button variant="outline" onClick={() => {
                localStorage.removeItem('auth_token')
                window.location.href = '/login'
              }}>
                Cerrar Sesión
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-6 print:hidden">
        {/* Setup Status Banner - Solo para owners */}
        {isOwner && setupStatus && !setupStatus.is_complete && (
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                    Configuración Incompleta
                  </h3>
                  <p className="text-sm text-orange-800 dark:text-orange-200 mb-3">
                    Tu sistema requiere configuración adicional para funcionar correctamente.
                  </p>
                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-medium text-orange-900 dark:text-orange-100">
                      Pasos faltantes:
                    </p>
                    <ul className="space-y-1">
                      {setupStatus.missing_steps.map((step) => (
                        <li key={step} className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-300">
                          <XCircle className="w-3 h-3" />
                          <span className="capitalize">
                            {step === 'warehouse' && 'Almacén'}
                            {step === 'price_list' && 'Lista de Precios'}
                            {step === 'chart_of_accounts' && 'Plan de Cuentas'}
                            {step === 'invoice_series' && 'Serie de Factura'}
                            {!['warehouse', 'price_list', 'chart_of_accounts', 'invoice_series'].includes(step) && step}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    onClick={() => navigate('/onboarding')}
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Completar Configuración
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Setup Status Success - Opcional, solo mostrar si todo está completo */}
        {isOwner && setupStatus && setupStatus.is_complete && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-900/20 print:hidden">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>Configuración completa.</strong> Todos los componentes del sistema están configurados correctamente.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {/* Header */}
        <div className="space-y-4">
          {/* Título y descripción */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-primary flex-shrink-0" />
                <span className="truncate">Dashboard Ejecutivo</span>
              </h1>
              <p className="text-xs sm:text-sm lg:text-base text-muted-foreground mt-1">
                Resumen de KPIs y métricas del negocio
              </p>
            </div>
            {/* Estado de actualización */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
              {isFetching ? (
                <>
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span>Actualizando datos...</span>
                </>
              ) : kpisUpdatedAt ? (
                <span>Actualizado: {new Date(kpisUpdatedAt).toLocaleTimeString()}</span>
              ) : null}
            </div>
          </div>

          {/* Filtros de fecha y botones */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="grid grid-cols-2 gap-2 flex-1 sm:flex-initial">
              <div className="flex flex-col gap-1">
                <Label htmlFor="startDate" className="text-xs">
                  Fecha Inicio
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs sm:text-sm"
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
                  className="w-full text-xs sm:text-sm"
                />
              </div>
            </div>
            {/* Botones de exportar */}
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={isLoading || !kpis || !trends}
                className="gap-1.5 print:hidden"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Excel</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={isLoading || !kpis || !trends}
                className="gap-1.5 print:hidden"
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
            {/* KPIs Principales - Ventas - Bento Grid */}
            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 grid-rows-2 auto-rows-fr gap-4">
              <StaggerItem className="lg:col-span-2 lg:row-span-2">
                <KPICard
                  title="Ventas del Período"
                  value={formatNumber(kpis.sales.period_count)}
                  subtitle={`${formatCurrency(kpis.sales.period_amount_bs, 'BS')} / ${formatCurrency(kpis.sales.period_amount_usd, 'USD')}`}
                  color="green"
                  icon={<ShoppingCart className="w-6 h-6" />}
                  link="/app/sales"
                  className="h-full bg-gradient-to-br from-green-50 to-white dark:from-green-950/10 dark:to-background"
                />
              </StaggerItem>

              <StaggerItem>
                <KPICard
                  title="Ventas Hoy"
                  value={formatNumber(kpis.sales.today_count)}
                  subtitle={`${formatCurrency(kpis.sales.today_amount_bs, 'BS')} / ${formatCurrency(kpis.sales.today_amount_usd, 'USD')}`}
                  color="blue"
                  icon={<DollarSign className="w-5 h-5" />}
                  link="/app/sales"
                />
              </StaggerItem>

              <StaggerItem>
                <KPICard
                  title="Ticket Promedio"
                  value={formatCurrency(kpis.performance.avg_sale_amount_bs, 'BS')}
                  subtitle={formatCurrency(kpis.performance.avg_sale_amount_usd, 'USD')}
                  color="purple"
                  icon={<ReceiptText className="w-5 h-5" />}
                />
              </StaggerItem>

              <StaggerItem className="lg:col-span-2">
                <KPICard
                  title="Crecimiento Proyectado"
                  value={`${kpis.sales.growth_percentage >= 0 ? '+' : ''}${kpis.sales.growth_percentage.toFixed(1)}%`}
                  subtitle="Basado en el período anterior"
                  color={kpis.sales.growth_percentage >= 0 ? 'green' : 'red'}
                  icon={
                    kpis.sales.growth_percentage >= 0 ? (
                      <TrendingUp className="w-5 h-5" />
                    ) : (
                      <TrendingDown className="w-5 h-5" />
                    )
                  }
                  className="bg-gradient-to-r from-background to-primary/5"
                />
              </StaggerItem>
            </StaggerContainer>

            {/* KPIs Secundarios */}
            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Inventario */}
              <StaggerItem>
                <Card className="glass-panel premium-shadow-md border-white/20 h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                        <Package className="w-4 h-4" />
                      </div>
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
                      <Badge variant="destructive" className="text-[10px] sm:text-xs">
                        {formatNumber(kpis.inventory.low_stock_count)}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        Por Vencer:
                      </span>
                      <Badge variant="destructive" className="text-[10px] sm:text-xs">
                        {formatNumber(kpis.inventory.expiring_soon_count)}
                      </Badge>
                    </div>
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-[10px] text-muted-foreground uppercase font-black opacity-60">
                        Valor total
                      </p>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                        {formatCurrency(kpis.inventory.total_stock_value_bs, 'BS')}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground">
                        {formatCurrency(kpis.inventory.total_stock_value_usd, 'USD')}
                      </p>
                    </div>
                    <Link
                      to="/app/inventory"
                      className="text-xs font-bold text-primary hover:text-primary/70 inline-flex items-center gap-1 mt-2 transition-colors"
                    >
                      Ver inventario <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </CardContent>
                </Card>
              </StaggerItem>

              {/* Finanzas */}
              <StaggerItem>
                <Card className="glass-panel premium-shadow-md border-white/20 h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-green-500/10 text-green-600">
                        <DollarSign className="w-4 h-4" />
                      </div>
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
                    <div className="pt-2 border-t border-border/40 opacity-0 h-0 overflow-hidden">
                      {/* Espaciador para alinear con el de al lado */}
                    </div>
                    <Link
                      to="/app/debts"
                      className="text-xs font-bold text-primary hover:text-primary/70 inline-flex items-center gap-1 mt-2 transition-colors"
                    >
                      Ver detalles <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </CardContent>
                </Card>
              </StaggerItem>

              {/* Compras */}
              <StaggerItem>
                <Card className="glass-panel premium-shadow-md border-white/20 h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600">
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                      Compras
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        Pendientes:
                      </span>
                      <Badge variant="destructive" className="text-[10px] sm:text-xs">
                        {formatNumber(kpis.purchases.pending_orders)}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        Completadas:
                      </span>
                      <Badge variant="default" className="text-[10px] sm:text-xs bg-green-600">
                        {formatNumber(kpis.purchases.completed_orders)}
                      </Badge>
                    </div>
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-[10px] text-muted-foreground uppercase font-black opacity-60">
                        Total Compras
                      </p>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                        {formatCurrency(kpis.purchases.total_purchases_bs, 'BS')}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground">
                        {formatCurrency(kpis.purchases.total_purchases_usd, 'USD')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>

              {/* Fiscal */}
              <StaggerItem>
                <Card className="glass-panel premium-shadow-md border-white/20 h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600">
                        <ReceiptText className="w-4 h-4" />
                      </div>
                      Facturación Fiscal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        Emitidas:
                      </span>
                      <Badge variant="default" className="text-[10px] sm:text-xs bg-green-600">
                        {formatNumber(kpis.fiscal.issued_invoices)}
                      </Badge>
                    </div>
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-[10px] text-muted-foreground uppercase font-black opacity-60">
                        Total Facturado
                      </p>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                        {formatCurrency(kpis.fiscal.total_fiscal_amount_bs, 'BS')}
                      </p>
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-medium text-muted-foreground">
                          {formatCurrency(kpis.fiscal.total_fiscal_amount_usd, 'USD')}
                        </p>
                        <p className="text-xs font-black text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          Tax: {formatCurrency(kpis.fiscal.total_tax_collected_usd, 'USD')}
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/app/fiscal-invoices"
                      className="text-xs font-bold text-primary hover:text-primary/70 inline-flex items-center gap-1 mt-2 transition-colors"
                    >
                      Ver facturas <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </CardContent>
                </Card>
              </StaggerItem>
            </StaggerContainer>

            {/* Performance y Top Productos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Producto */}
              <FadeInUp>
                <Card className="glass-panel premium-shadow-md border-white/20 h-full overflow-hidden">
                  <CardHeader className="bg-primary/5 border-b border-border/40">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      Producto Más Vendido
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {kpis.performance.top_selling_product ? (
                      <div className="flex flex-col h-full">
                        <p className="text-xl sm:text-2xl font-black text-primary tracking-tight">
                          {kpis.performance.top_selling_product.name}
                        </p>
                        <div className="mt-4 p-3 rounded-xl bg-background/50 border border-border/40">
                          <p className="text-xs text-muted-foreground uppercase font-black opacity-60">
                            Cantidad vendida
                          </p>
                          <p className="text-lg font-bold">
                            {formatQuantity(
                              kpis.performance.top_selling_product.quantity_sold,
                              kpis.performance.top_selling_product.is_weight_product,
                              kpis.performance.top_selling_product.weight_unit,
                            )}
                          </p>
                        </div>
                        <Link
                          to="/app/products"
                          className="text-xs font-bold text-primary hover:text-primary/70 inline-flex items-center gap-1 mt-6 transition-colors"
                        >
                          Ver producto <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      </div>
                    ) : (
                      <p className="text-muted-foreground py-10 text-center">
                        No hay datos disponibles
                      </p>
                    )}
                  </CardContent>
                </Card>
              </FadeInUp>

              {/* Categoría Más Vendida */}
              <FadeInUp>
                <Card className="glass-panel premium-shadow-md border-white/20 h-full overflow-hidden">
                  <CardHeader className="bg-green-500/5 border-b border-border/40">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-green-600" />
                      Categoría Más Vendida
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {kpis.performance.best_selling_category ? (
                      <div className="flex flex-col h-full items-center justify-center py-6">
                        <div className="p-4 rounded-full bg-green-500/10 mb-4">
                          <TrendingUp className="w-8 h-8 text-green-600" />
                        </div>
                        <p className="text-2xl sm:text-3xl font-black text-green-600 tracking-tight text-center">
                          {kpis.performance.best_selling_category}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2 font-medium">
                          Liderando el volumen del período
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground py-10 text-center">
                        No hay datos disponibles
                      </p>
                    )}
                  </CardContent>
                </Card>
              </FadeInUp>
            </div>

            {/* Top 10 Productos de la Semana - Bento Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Gráfico: Productos por Peso */}
              <FadeInUp>
                <Card className="glass-panel premium-shadow-md border-white/20">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base sm:text-lg font-black flex items-center gap-2">
                      <Package className="w-4 h-4 text-primary" />
                      Top Productos por Peso
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {chartCurrency}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <TopProductsChart
                      data={trends.top_products_trend.filter(p => p.is_weight_product)}
                      currency={chartCurrency}
                      limit={10}
                      sortBy="revenue"
                    />
                  </CardContent>
                </Card>
              </FadeInUp>

              {/* Gráfico: Productos por Cantidad */}
              <FadeInUp>
                <Card className="glass-panel premium-shadow-md border-white/20">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base sm:text-lg font-black flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-green-600" />
                      Top Productos por Unidades
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {chartCurrency}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <TopProductsChart
                      data={trends.top_products_trend.filter(p => !p.is_weight_product)}
                      currency={chartCurrency}
                      limit={10}
                      sortBy="revenue"
                    />
                  </CardContent>
                </Card>
              </FadeInUp>
            </div>

            {/* Tabla Detallada */}
            <FadeInUp>
              <Card className="glass-panel premium-shadow-md border-white/20">
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg font-black">
                    Detalle Top 10 Productos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="weight" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4 bg-background/50">
                      <TabsTrigger value="weight" className="font-bold">Por Peso</TabsTrigger>
                      <TabsTrigger value="units" className="font-bold">Por Unidades</TabsTrigger>
                    </TabsList>

                    {/* Tab: Productos por Peso */}
                    <TabsContent value="weight" className="mt-0">
                      <div className="overflow-x-auto overflow-y-auto max-h-[380px] [-webkit-overflow-scrolling:touch]">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background/80 backdrop-blur-md z-10">
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Producto</TableHead>
                              <TableHead className="text-right">Cant.</TableHead>
                              <TableHead className="text-right">Ingresos</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const weightProducts = trends.top_products_trend
                                .filter(p => p.is_weight_product)
                                .sort((a, b) => {
                                  const revenueA = chartCurrency === 'BS' ? a.revenue_bs : a.revenue_usd
                                  const revenueB = chartCurrency === 'BS' ? b.revenue_bs : b.revenue_usd
                                  return revenueB - revenueA
                                })
                                .slice(0, 10)
                              return weightProducts.length > 0 ? (
                                weightProducts.map((product, index) => (
                                  <TableRow key={product.product_id} className="hover:bg-primary/5 transition-colors">
                                    <TableCell>
                                      <div className={cn(
                                        "w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-bold",
                                        index === 0 ? "bg-amber-500 text-white" :
                                          index === 1 ? "bg-slate-400 text-white" :
                                            index === 2 ? "bg-orange-600 text-white" : "bg-muted text-muted-foreground"
                                      )}>
                                        {index + 1}
                                      </div>
                                    </TableCell>
                                    <TableCell className="font-bold max-w-[200px] truncate">
                                      {product.product_name}
                                    </TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">
                                      {formatQuantity(
                                        product.quantity_sold,
                                        product.is_weight_product,
                                        product.weight_unit,
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div>
                                        <p className="font-bold text-sm">
                                          {formatCurrency(product.revenue_bs, 'BS')}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground font-medium">
                                          {formatCurrency(product.revenue_usd, 'USD')}
                                        </p>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                                    No hay datos disponibles
                                  </TableCell>
                                </TableRow>
                              )
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>

                    {/* Tab: Productos por Unidades */}
                    <TabsContent value="units" className="mt-0">
                      <div className="overflow-x-auto overflow-y-auto max-h-[380px] [-webkit-overflow-scrolling:touch]">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background/80 backdrop-blur-md z-10">
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Producto</TableHead>
                              <TableHead className="text-right">Cant.</TableHead>
                              <TableHead className="text-right">Ingresos</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const unitProducts = trends.top_products_trend
                                .filter(p => !p.is_weight_product)
                                .sort((a, b) => {
                                  const revenueA = chartCurrency === 'BS' ? a.revenue_bs : a.revenue_usd
                                  const revenueB = chartCurrency === 'BS' ? b.revenue_bs : b.revenue_usd
                                  return revenueB - revenueA
                                })
                                .slice(0, 10)
                              return unitProducts.length > 0 ? (
                                unitProducts.map((product, index) => (
                                  <TableRow key={product.product_id} className="hover:bg-primary/5 transition-colors">
                                    <TableCell>
                                      <div className={cn(
                                        "w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-bold",
                                        index === 0 ? "bg-amber-500 text-white" :
                                          index === 1 ? "bg-slate-400 text-white" :
                                            index === 2 ? "bg-orange-600 text-white" : "bg-muted text-muted-foreground"
                                      )}>
                                        {index + 1}
                                      </div>
                                    </TableCell>
                                    <TableCell className="font-bold max-w-[200px] truncate">
                                      {product.product_name}
                                    </TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">
                                      {formatQuantity(
                                        product.quantity_sold,
                                        product.is_weight_product,
                                        product.weight_unit,
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div>
                                        <p className="font-bold text-sm">
                                          {formatCurrency(product.revenue_bs, 'BS')}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground font-medium">
                                          {formatCurrency(product.revenue_usd, 'USD')}
                                        </p>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                                    No hay datos disponibles
                                  </TableCell>
                                </TableRow>
                              )
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </FadeInUp>
          </>
        )}
      </div>

      {/* Vista de Impresión */}
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
