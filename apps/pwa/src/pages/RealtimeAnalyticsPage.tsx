import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Activity, AlertTriangle, Calendar, BarChart3, Settings, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import RealtimeMetricsCard from '@/components/realtime/RealtimeMetricsCard'
import AlertsPanel from '@/components/realtime/AlertsPanel'
import SalesHeatmapChart from '@/components/realtime/SalesHeatmapChart'
import ComparativeMetricsChart from '@/components/realtime/ComparativeMetricsChart'
import ThresholdsManager from '@/components/realtime/ThresholdsManager'
import { ApplyDefaultsModal } from '@/components/realtime/ApplyDefaultsModal'
import { realtimeAnalyticsService } from '@/services/realtime-analytics.service'
import { DollarSign, ShoppingCart, Package } from 'lucide-react'

export default function RealtimeAnalyticsPage() {
  const [isDefaultsModalOpen, setIsDefaultsModalOpen] = useState(false)
  const [hasThresholds, setHasThresholds] = useState<boolean | null>(null)

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
            Métricas, alertas y análisis en tiempo real
          </p>
        </div>

        <Button
          onClick={() => setIsDefaultsModalOpen(true)}
          variant={hasThresholds === false ? "default" : "outline"}
          className="w-full sm:w-auto"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {hasThresholds === false ? "Configurar Alertas Inteligentes" : "Configuración Recomendada"}
        </Button>
      </div>

      <ApplyDefaultsModal
        open={isDefaultsModalOpen}
        onOpenChange={setIsDefaultsModalOpen}
        onSuccess={() => {
          checkThresholds()
          // Opcionalmente recargar otras partes si es necesario
        }}
      />

      {/* Métricas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <RealtimeMetricsCard
          metricType="revenue_bs"
          title="Ingresos Hoy (Bs)"
          formatValue={(value) => `Bs. ${Number(value).toFixed(2)}`}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <RealtimeMetricsCard
          metricType="revenue_usd"
          title="Ingresos Hoy (USD)"
          formatValue={(value) => `$${Number(value).toFixed(2)}`}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <RealtimeMetricsCard
          metricType="sales_count"
          title="Ventas Hoy"
          icon={<ShoppingCart className="w-4 h-4" />}
        />
        <RealtimeMetricsCard
          metricType="low_stock_count"
          title="Stock Bajo"
          icon={<Package className="w-4 h-4" />}
        />
      </div>

      {/* Tabs para diferentes vistas */}
      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metrics">
            <Activity className="w-4 h-4 mr-2" />
            Métricas
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Alertas
          </TabsTrigger>
          <TabsTrigger value="heatmap">
            <Calendar className="w-4 h-4 mr-2" />
            Heatmap
          </TabsTrigger>
          <TabsTrigger value="comparative">
            <BarChart3 className="w-4 h-4 mr-2" />
            Comparativas
          </TabsTrigger>
          <TabsTrigger value="thresholds">
            <Settings className="w-4 h-4 mr-2" />
            Umbrales
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <RealtimeMetricsCard
              metricType="avg_ticket_bs"
              title="Ticket Promedio (Bs)"
              formatValue={(value) => `Bs. ${Number(value).toFixed(2)}`}
            />
            <RealtimeMetricsCard
              metricType="avg_ticket_usd"
              title="Ticket Promedio (USD)"
              formatValue={(value) => `$${Number(value).toFixed(2)}`}
            />
            <RealtimeMetricsCard
              metricType="products_sold"
              title="Productos Vendidos"
            />
            <RealtimeMetricsCard
              metricType="pending_orders"
              title="Órdenes Pendientes"
            />
            <RealtimeMetricsCard
              metricType="active_customers"
              title="Clientes Activos"
            />
            <RealtimeMetricsCard
              metricType="debt_total_bs"
              title="Deuda Total (Bs)"
              formatValue={(value) => `Bs. ${Number(value).toFixed(2)}`}
            />
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <AlertsPanel limit={20} showFilters={true} />
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

