import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { observabilityService } from '@/services/observability.service';
import { HealthStatusCard } from '@/components/observability/HealthStatusCard';
import { UptimeTracker } from '@/components/observability/UptimeTracker';
import { ServiceStatusList } from '@/components/observability/ServiceStatusList';
import { AlertsPanel } from '@/components/observability/AlertsPanel';
import { MetricsChart } from '@/components/observability/MetricsChart';
import { RealTimeMetrics } from '@/components/observability/RealTimeMetrics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, AlertTriangle, BarChart3, Server } from 'lucide-react';

export default function ObservabilityPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Queries para datos
  const { data: status } = useQuery({
    queryKey: ['observability', 'status'],
    queryFn: () => observabilityService.getStatus(),
    refetchInterval: autoRefresh ? 30000 : false, // Refrescar cada 30s si auto-refresh está activo
  });

  const { data: uptime, isLoading: uptimeLoading } = useQuery({
    queryKey: ['observability', 'uptime'],
    queryFn: () => observabilityService.getUptime(undefined, 30),
    refetchInterval: autoRefresh ? 60000 : false, // Refrescar cada minuto
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['observability', 'alerts'],
    queryFn: () => observabilityService.getAlerts({ status: 'active' }),
    refetchInterval: autoRefresh ? 15000 : false, // Refrescar cada 15s
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['observability', 'services'],
    queryFn: () => observabilityService.getServices(),
    refetchInterval: autoRefresh ? 30000 : false,
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Observabilidad</h1>
          <p className="text-muted-foreground">
            Monitoreo en tiempo real del estado de la plataforma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HealthStatusCard
          title="Estado General"
          status={status?.status || 'unknown'}
          value={status?.uptime.toFixed(3) + '%' || 'N/A'}
          subtitle={`Objetivo: ${status?.targetUptime || 99.9}%`}
          icon={<Activity className="h-4 w-4" />}
        />
        <HealthStatusCard
          title="Uptime (30 días)"
          status={uptime && uptime.uptime >= 99.9 ? 'ok' : uptime && uptime.uptime >= 99.0 ? 'degraded' : 'down'}
          value={uptime?.uptime.toFixed(3) + '%' || 'N/A'}
          subtitle={`${uptime?.successfulChecks || 0} checks exitosos`}
          icon={<Server className="h-4 w-4" />}
        />
        <HealthStatusCard
          title="Alertas Activas"
          status={alertsData && alertsData.alerts.length > 0 ? 'warning' : 'ok'}
          value={alertsData?.alerts.length || 0}
          subtitle={`${alertsData?.alerts.filter(a => a.severity === 'critical').length || 0} críticas`}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <HealthStatusCard
          title="Servicios"
          status={servicesData && servicesData.services.every(s => s.status === 'up') ? 'ok' : 'degraded'}
          value={`${servicesData?.services.filter(s => s.status === 'up').length || 0}/${servicesData?.services.length || 0}`}
          subtitle="Operacionales"
          icon={<BarChart3 className="h-4 w-4" />}
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="services">Servicios</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Uptime Tracker</CardTitle>
                <CardDescription>Historial de disponibilidad</CardDescription>
              </CardHeader>
              <CardContent>
                <UptimeTracker uptime={uptime} loading={uptimeLoading} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métricas en Tiempo Real</CardTitle>
                <CardDescription>Actualizaciones en vivo</CardDescription>
              </CardHeader>
              <CardContent>
                <RealTimeMetrics />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estado de Servicios</CardTitle>
              <CardDescription>Monitoreo de todos los servicios</CardDescription>
            </CardHeader>
            <CardContent>
              <ServiceStatusList
                services={servicesData?.services || []}
                loading={servicesLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Métricas del Sistema</CardTitle>
              <CardDescription>Gráficos de rendimiento</CardDescription>
            </CardHeader>
            <CardContent>
              <MetricsChart />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Panel de Alertas</CardTitle>
              <CardDescription>Alertas activas y configuración</CardDescription>
            </CardHeader>
            <CardContent>
              <AlertsPanel
                alerts={alertsData?.alerts || []}
                loading={alertsLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
