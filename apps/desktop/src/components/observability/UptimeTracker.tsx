import { UptimeStats } from '@/services/observability.service';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface UptimeTrackerProps {
  uptime: UptimeStats | undefined;
  loading: boolean;
}

export function UptimeTracker({ uptime, loading }: UptimeTrackerProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!uptime) {
    return <div className="text-center text-muted-foreground">No hay datos disponibles</div>;
  }

  const isHealthy = uptime.uptime >= uptime.targetUptime;
  const isDegraded = uptime.uptime >= 99.0 && uptime.uptime < uptime.targetUptime;

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-4">
      {/* Uptime Percentage */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Uptime: {uptime.uptime.toFixed(3)}%</span>
          <span className="text-sm text-muted-foreground">
            Objetivo: {uptime.targetUptime}%
          </span>
        </div>
        <Progress value={uptime.uptime} className="h-2" />
      </div>

      {/* Status Icon */}
      <div className="flex items-center gap-2">
        {isHealthy ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : isDegraded ? (
          <AlertCircle className="h-5 w-5 text-yellow-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        )}
        <span className={cn(
          'text-sm font-medium',
          isHealthy ? 'text-green-600' : isDegraded ? 'text-yellow-600' : 'text-red-600'
        )}>
          {isHealthy ? 'Cumpliendo SLA' : isDegraded ? 'Degradado' : 'Fuera de SLA'}
        </span>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
        <div>
          <p className="text-xs text-muted-foreground">Tiempo Activo</p>
          <p className="text-lg font-semibold">{formatTime(uptime.totalUptimeSeconds)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Tiempo Inactivo</p>
          <p className="text-lg font-semibold">{formatTime(uptime.totalDowntimeSeconds)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Checks Exitosos</p>
          <p className="text-lg font-semibold">{uptime.successfulChecks}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Checks Fallidos</p>
          <p className="text-lg font-semibold">{uptime.failedChecks}</p>
        </div>
      </div>

      {/* Period Info */}
      <div className="text-xs text-muted-foreground pt-2 border-t">
        Período: {uptime.period} ({new Date(uptime.periodStart).toLocaleDateString()} - {new Date(uptime.periodEnd).toLocaleDateString()})
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils';
