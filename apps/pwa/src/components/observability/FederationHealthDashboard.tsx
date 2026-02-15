import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { observabilityService, FederationHealthReport } from '@/services/observability.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, AlertTriangle, GitBranch, ArrowRightLeft, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const healthColorMap = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  critical: 'bg-red-500',
};

const HealthBadge = ({ health }: { health: 'healthy' | 'degraded' | 'critical' }) => (
  <Badge className={cn('text-white', healthColorMap[health])}>{health}</Badge>
);

const MetricDisplay = ({ label, value, icon, isCritical = false }: { label: string; value: any; icon: React.ReactNode; isCritical?: boolean }) => (
  <div className={cn('p-2 rounded-lg', isCritical ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800')}>
    <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon} {label}</div>
    <div className={cn('text-2xl font-bold', isCritical ? 'text-red-600 dark:text-red-400' : 'text-primary')}>{value}</div>
  </div>
);

export function FederationHealthDashboard() {
  const [selectedStore, setSelectedStore] = useState<FederationHealthReport | null>(null);

  const { data: reports, isLoading, error } = useQuery<FederationHealthReport[]>({
    queryKey: ['observability', 'federationHealth'],
    queryFn: () => observabilityService.getAllFederationHealthReports(),
    refetchInterval: 60000, // Refrescar cada minuto
  });

  useEffect(() => {
    if (reports && reports.length > 0 && !selectedStore) {
      // Select the first store with a critical or degraded status, or the first one
      const criticalStore = reports.find(r => r.overallHealth === 'critical');
      const degradedStore = reports.find(r => r.overallHealth === 'degraded');
      setSelectedStore(criticalStore || degradedStore || reports[0]);
    } else if (reports && selectedStore) {
      // Update selected store data
      const updatedStore = reports.find(r => r.storeId === selectedStore.storeId);
      if (updatedStore) {
        setSelectedStore(updatedStore);
      }
    }
  }, [reports, selectedStore]);

  if (isLoading) return <div>Cargando reportes de federación...</div>;
  if (error) return <div>Error al cargar los datos: {error.message}</div>;
  if (!reports || reports.length === 0) return <div>No hay tiendas para monitorear.</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Tiendas Monitoreadas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow
                    key={report.storeId}
                    onClick={() => setSelectedStore(report)}
                    className={cn('cursor-pointer', selectedStore?.storeId === report.storeId ? 'bg-muted/50' : '')}
                  >
                    <TableCell className="font-medium">{report.storeId.substring(0, 8)}</TableCell>
                    <TableCell><HealthBadge health={report.overallHealth} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        {selectedStore ? (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Detalle de Salud: {selectedStore.storeId.substring(0, 8)}</CardTitle>
                  <CardDescription>Actualizado: {new Date(selectedStore.timestamp).toLocaleString()}</CardDescription>
                </div>
                <HealthBadge health={selectedStore.overallHealth} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <MetricDisplay label="Stock Negativo" value={selectedStore.metrics.negativeStockCount} icon={<AlertTriangle />} isCritical={selectedStore.metrics.negativeStockCount > 0} />
                <MetricDisplay label="Brechas Proyección" value={selectedStore.metrics.projectionGapCount} icon={<GitBranch />} isCritical={selectedStore.metrics.projectionGapCount > 0} />
                <MetricDisplay label="Duplicados Fiscales" value={selectedStore.metrics.fiscalDuplicates} icon={<ShieldAlert />} isCritical={selectedStore.metrics.fiscalDuplicates > 0} />
                <MetricDisplay label="Eventos Muertos" value={selectedStore.metrics.outboxDead} icon={<AlertCircle />} isCritical={selectedStore.metrics.outboxDead > 0} />
                <MetricDisplay label="Eventos en Cola" value={selectedStore.metrics.outboxBacklog} icon={<Clock />} />
                <MetricDisplay label="Tasa de Conflictos" value={selectedStore.metrics.conflictRate} icon={<ArrowRightLeft />} />
                <MetricDisplay label="Latencia Remota" value={`${selectedStore.metrics.remoteLatencyMs ?? 'N/A'} ms`} icon={<Clock />} />
                <MetricDisplay label="Conexión Remota" value={selectedStore.metrics.remoteReachable ? <CheckCircle className='text-green-500'/> : <AlertCircle className='text-red-500'/>} icon={<CheckCircle />} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div>Seleccione una tienda para ver los detalles.</div>
        )}
      </div>
    </div>
  );
}
