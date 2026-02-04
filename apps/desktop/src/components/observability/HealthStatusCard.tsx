import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface HealthStatusCardProps {
  title: string;
  status: 'ok' | 'degraded' | 'down' | 'warning' | 'unknown';
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function HealthStatusCard({
  title,
  status,
  value,
  subtitle,
  icon,
}: HealthStatusCardProps) {
  const statusColors = {
    ok: 'border-green-500 bg-green-50 dark:bg-green-950',
    degraded: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950',
    down: 'border-red-500 bg-red-50 dark:bg-red-950',
    warning: 'border-orange-500 bg-orange-50 dark:bg-orange-950',
    unknown: 'border-gray-500 bg-gray-50 dark:bg-gray-950',
  };

  const statusTextColors = {
    ok: 'text-green-600 dark:text-green-400',
    degraded: 'text-yellow-600 dark:text-yellow-400',
    down: 'text-red-600 dark:text-red-400',
    warning: 'text-orange-600 dark:text-orange-400',
    unknown: 'text-gray-600 dark:text-gray-400',
  };

  return (
    <Card className={cn('border-2', statusColors[status])}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {title}
            </p>
            <p className={cn('text-2xl font-bold', statusTextColors[status])}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div className={cn('ml-4', statusTextColors[status])}>{icon}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
