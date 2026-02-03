import { Alert } from '@/services/observability.service';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@la-caja/ui-core';
import { AlertTriangle, XCircle, Info, CheckCircle2 } from 'lucide-react';
import { observabilityService } from '@/services/observability.service';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from '@/lib/toast';
import { cn } from '@la-caja/ui-core';

interface AlertsPanelProps {
  alerts: Alert[];
  loading: boolean;
}

export function AlertsPanel({ alerts, loading }: AlertsPanelProps) {
  const queryClient = useQueryClient();

  const resolveMutation = useMutation({
    mutationFn: (alertId: string) => observabilityService.resolveAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observability', 'alerts'] });
      toast.success('Alerta resuelta');
    },
    onError: () => {
      toast.error('Error al resolver la alerta');
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => observabilityService.acknowledgeAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observability', 'alerts'] });
      toast.success('Alerta reconocida');
    },
    onError: () => {
      toast.error('Error al reconocer la alerta');
    },
  });

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
        <p className="text-muted-foreground">No hay alertas activas</p>
      </div>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-500">Crítica</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">Advertencia</Badge>;
      case 'info':
        return <Badge className="bg-blue-500">Info</Badge>;
      default:
        return <Badge variant="secondary">{severity}</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            'p-4 rounded-lg border',
            alert.severity === 'critical' && 'bg-red-50 dark:bg-red-950 border-red-200',
            alert.severity === 'warning' && 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200',
            alert.severity === 'info' && 'bg-blue-50 dark:bg-blue-950 border-blue-200',
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {getSeverityIcon(alert.severity)}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">{alert.service_name}</p>
                  {getSeverityBadge(alert.severity)}
                </div>
                <p className="text-sm text-muted-foreground mb-1">{alert.message}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(alert.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => acknowledgeMutation.mutate(alert.id)}
                disabled={acknowledgeMutation.isPending}
              >
                Reconocer
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => resolveMutation.mutate(alert.id)}
                disabled={resolveMutation.isPending}
              >
                Resolver
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
