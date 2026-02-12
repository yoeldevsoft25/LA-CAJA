import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Activity,
  AlertTriangle,
  Calendar,
  BarChart3,
  Settings,
  Sparkles,
  DollarSign,
  ShoppingCart,
  Package,
  RefreshCw,
  TrendingDown,
  Users,
  Clock,
  Wallet,
  History,
  Store,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import RealtimeMetricsCard from '@/components/realtime/RealtimeMetricsCard'
import AlertsPanel from '@/components/realtime/AlertsPanel'
import SalesHeatmapChart from '@/components/realtime/SalesHeatmapChart'
import ComparativeMetricsChart from '@/components/realtime/ComparativeMetricsChart'
import ThresholdsManager from '@/components/realtime/ThresholdsManager'
import { ApplyDefaultsModal } from '@/components/realtime/ApplyDefaultsModal'
import { realtimeAnalyticsService } from '@/services/realtime-analytics.service'
import { useQueryClient } from '@tanstack/react-query'
import toast from '@/lib/toast'

export default function RealtimeAnalyticsPage() {
  const [isDefaultsModalOpen, setIsDefaultsModalOpen] = useState(false)
  const [hasThresholds, setHasThresholds] = useState<boolean | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    checkThresholds()
  }, [])

  const checkThresholds = async () => {
    try {
      const result = await realtimeAnalyticsService.hasExistingThresholds()
      setHasThresholds(result.hasThresholds)
    } catch (error) {
      console.error('Error checking thresholds:', error)
    }
  }

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await realtimeAnalyticsService.calculateMetrics()
      await queryClient.invalidateQueries({ queryKey: ['realtime-metrics'] })
      await queryClient.invalidateQueries({ queryKey: ['realtime-alerts'] })
      toast.success('Métricas recalculadas con éxito')
    } catch (error) {
      toast.error('Error al recalcular métricas')
    } finally {
      setIsRefreshing(false)
    }
  }

  const formatBs = (value: number) => `Bs. ${Number(value).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const formatUSD = (value: number) => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const formatInt = (value: number) => Number(value).toLocaleString('es-VE', { maximumFractionDigits: 0 })
  const formatQty = (value: number) => {
    const num = Number(value)
    // Si tiene decimales significativos, mostrar hasta 3 (para kg/peso)
    if (num % 1 !== 0) {
      return num.toLocaleString('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 3 })
    }
    return num.toLocaleString('es-VE', { maximumFractionDigits: 0 })
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
            Analytics en Tiempo Real
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Gestione su negocio con datos precisos y alertas automáticas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex-1 sm:flex-initial"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Recalcular
          </Button>

          <Button
            onClick={() => setIsDefaultsModalOpen(true)}
            variant={hasThresholds === false ? "default" : "outline"}
            className="flex-1 sm:flex-initial"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {hasThresholds === false ? "Configurar IA" : "Ajustes de Alertas"}
          </Button>
        </div>
      </div>

      <ApplyDefaultsModal
        open={isDefaultsModalOpen}
        onOpenChange={setIsDefaultsModalOpen}
        onSuccess={() => {
          checkThresholds()
          queryClient.invalidateQueries({ queryKey: ['realtime-metrics'] })
        }}
      />

      {/* Métricas principales (KPIs de Alto Impacto) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <RealtimeMetricsCard
          metricType="daily_revenue_bs"
          title="Ingresos Hoy (Bs)"
          formatValue={formatBs}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <RealtimeMetricsCard
          metricType="daily_revenue_usd"
          title="Ingresos Hoy (USD)"
          formatValue={formatUSD}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <RealtimeMetricsCard
          metricType="daily_sales_count"
          title="Ventas Hoy"
          formatValue={formatInt}
          icon={<ShoppingCart className="w-4 h-4" />}
        />
        <RealtimeMetricsCard
          metricType="low_stock_count"
          title="Alertas de Stock"
          formatValue={formatInt}
          icon={<Package className="w-4 h-4" />}
        />
      </div>

      {/* Tabs para diferentes vistas con scroll móvil */}
      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto pb-2 -mx-3 sm:mx-0 px-3 sm:px-0">
          <TabsList className="w-full justify-start md:justify-center p-1 bg-card border border-border/60 h-auto">
            <TabsTrigger value="overview" className="py-2.5 px-4">
              <Activity className="w-4 h-4 mr-2" />
              Vista General
            </TabsTrigger>
            <TabsTrigger value="alerts" className="py-2.5 px-4">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Alertas
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="py-2.5 px-4">
              <Calendar className="w-4 h-4 mr-2" />
              Horarios Pico
            </TabsTrigger>
            <TabsTrigger value="comparative" className="py-2.5 px-4 md:hidden lg:flex">
              <BarChart3 className="w-4 h-4 mr-2" />
              Tendencias
            </TabsTrigger>
            <TabsTrigger value="thresholds" className="py-2.5 px-4">
              <Settings className="w-4 h-4 mr-2" />
              Configuración
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-8">
          {/* Sección: Inventario Crítico */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2 px-1">
              <Package className="w-5 h-5 text-orange-600" />
              Inventario y Disponibilidad
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <RealtimeMetricsCard
                metricType="out_of_stock_count"
                title="Sin Stock (Crítico)"
                formatValue={formatInt}
                icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
              />
              <RealtimeMetricsCard
                metricType="low_stock_count"
                title="Stock por Agotarse"
                formatValue={formatInt}
                icon={<Package className="w-4 h-4 text-orange-600" />}
              />
              <RealtimeMetricsCard
                metricType="expired_products_count"
                title="Productos Vencidos"
                formatValue={formatInt}
                icon={<TrendingDown className="w-4 h-4 text-red-600" />}
              />
              <RealtimeMetricsCard
                metricType="expiring_soon_count"
                title="Por Vencer (30d)"
                formatValue={formatInt}
                icon={<Clock className="w-4 h-4 text-yellow-600" />}
              />
            </div>
          </div>

          {/* Sección: Cobranzas y Riesgo */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2 px-1">
              <Wallet className="w-5 h-5 text-blue-600" />
              Cobranzas y Riesgo Crediticio
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <RealtimeMetricsCard
                metricType="overdue_debt_bs"
                title="Deuda Vencida (Bs)"
                formatValue={formatBs}
                icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
              />
              <RealtimeMetricsCard
                metricType="total_debt_bs"
                title="Deuda Total"
                formatValue={formatBs}
              />
              <RealtimeMetricsCard
                metricType="customers_overdue_count"
                title="Clientes en Mora"
                formatValue={formatInt}
                icon={<Users className="w-4 h-4" />}
              />
            </div>
          </div>

          {/* Sección: Operaciones y Caja */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2 px-1">
              <Store className="w-5 h-5 text-green-600" />
              Operaciones Diarias
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <RealtimeMetricsCard
                metricType="cash_on_hand_bs"
                title="Efectivo en Caja"
                formatValue={formatBs}
              />
              <RealtimeMetricsCard
                metricType="active_customers_count"
                title="Clientes Activos"
                formatValue={formatInt}
              />
              <RealtimeMetricsCard
                metricType="active_sessions_count"
                title="Cajas Abiertas"
                formatValue={formatInt}
              />
              <RealtimeMetricsCard
                metricType="pending_orders_count"
                title="Órdenes Pendientes"
                formatValue={formatInt}
              />
            </div>
          </div>

          {/* Sección: Rendimiento de Ventas */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2 px-1">
              <History className="w-5 h-5 text-indigo-600" />
              Calidad de Ventas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <RealtimeMetricsCard
                metricType="products_sold_count"
                title="Productos Vendidos"
                formatValue={formatQty}
              />
              <RealtimeMetricsCard
                metricType="avg_ticket_bs"
                title="Ticket Prom. (Bs)"
                formatValue={formatBs}
              />
              <RealtimeMetricsCard
                metricType="avg_ticket_usd"
                title="Ticket Prom. (USD)"
                formatValue={formatUSD}
              />
              <RealtimeMetricsCard
                metricType="inventory_value_bs"
                title="Valor de Inventario"
                formatValue={formatBs}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <AlertsPanel limit={50} showFilters={true} />
        </TabsContent>

        <TabsContent value="heatmap">
          <SalesHeatmapChart />
        </TabsContent>

        <TabsContent value="comparative">
          <ComparativeMetricsChart />
        </TabsContent>

        <TabsContent value="thresholds">
          <ThresholdsManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
