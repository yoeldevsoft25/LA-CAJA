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
import { Activity, AlertTriangle, BarChart3, Server, GitMerge } from 'lucide-react';
import { FederationHealthDashboard } from '@/components/observability/FederationHealthDashboard';

export default function ObservabilityPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Queries para datos
  const { data: status } = useQuery({
    queryKey: ['observability', 'status'],
    queryFn: () => observabilityService.getStatus(),
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: uptime, isLoading: uptimeLoading } = useQuery({
    queryKey: ['observability', 'uptime'],
    queryFn: () => observabilityService.getUptime(undefined, 30),
    refetchInterval: autoRefresh ? 60000 : false,
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['observability', 'alerts'],
    queryFn: () => observabilityService.getAlerts({ status: 'active' }),
    refetchInterval: autoRefresh ? 15000 : false,
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['observability', 'services'],
    queryFn: () => observabilityService.getServices(),
    refetchInterval: autoRefresh ? 30000 : false,
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* ... Other HealthStatusCard components ... */}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="federation">Federación</TabsTrigger>
          <TabsTrigger value="services">Servicios</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
            {/* ... Overview content ... */}
        </TabsContent>

        <TabsContent value="federation" className="space-y-4">
          <FederationHealthDashboard />
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
            {/* ... Services content ... */}
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
            {/* ... Metrics content ... */}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
            {/* ... Alerts content ... */}
        </TabsContent>
      </Tabs>
    </div>
  );
}
