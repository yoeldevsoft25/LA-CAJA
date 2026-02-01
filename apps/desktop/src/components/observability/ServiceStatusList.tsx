import { ServiceStatus } from '@/services/observability.service';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServiceStatusListProps {
  services: ServiceStatus[];
  loading: boolean;
}

export function ServiceStatusList({ services, loading }: ServiceStatusListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (services.length === 0) {
    return <div className="text-center text-muted-foreground py-8">No hay servicios para mostrar</div>;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'down':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'up':
        return <Badge className="bg-green-500">Operacional</Badge>;
      case 'down':
        return <Badge className="bg-red-500">Caído</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500">Degradado</Badge>;
      default:
        return <Badge variant="secondary">Desconocido</Badge>;
    }
  };

  return (
    <div className="space-y-2">
      {services.map((service) => (
        <div
          key={service.name}
          className={cn(
            'flex items-center justify-between p-4 rounded-lg border',
            service.status === 'up' && 'bg-green-50 dark:bg-green-950 border-green-200',
            service.status === 'down' && 'bg-red-50 dark:bg-red-950 border-red-200',
            service.status === 'degraded' && 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200',
          )}
        >
          <div className="flex items-center gap-3">
            {getStatusIcon(service.status)}
            <div>
              <p className="font-medium capitalize">{service.name}</p>
              {service.lastChecked && (
                <p className="text-xs text-muted-foreground">
                  Última verificación: {new Date(service.lastChecked).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {service.responseTime && (
              <span className="text-sm text-muted-foreground">
                {service.responseTime}ms
              </span>
            )}
            {getStatusBadge(service.status)}
          </div>
        </div>
      ))}
    </div>
  );
}
