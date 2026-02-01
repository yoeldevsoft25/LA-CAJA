import { useRealtimeAlerts } from '@/hooks/useRealtimeAlerts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, CheckCircle2, Bell } from 'lucide-react'
// Helper para formatear severidad de alertas
const formatAlertSeverity = (severity: string): { label: string; bgColor: string } => {
  const severityMap: Record<string, { label: string; bgColor: string }> = {
    low: { label: 'Baja', bgColor: 'bg-gray-100' },
    medium: { label: 'Media', bgColor: 'bg-yellow-100' },
    high: { label: 'Alta', bgColor: 'bg-orange-100' },
    critical: { label: 'Crítica', bgColor: 'bg-red-100' },
  }
  return severityMap[severity] || { label: severity, bgColor: 'bg-gray-100' }
}
import { format } from 'date-fns'
import { AlertSeverity } from '@/types/realtime-analytics.types'
import { useState } from 'react'

interface AlertsPanelProps {
  limit?: number
  showFilters?: boolean
}

export default function AlertsPanel({
  limit = 10,
  showFilters = true,
}: AlertsPanelProps) {
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all')
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('unread')

  const { alerts, unreadCount, isLoading, markAsRead } = useRealtimeAlerts({
    severity: severityFilter === 'all' ? undefined : severityFilter,
    is_read: readFilter === 'all' ? undefined : readFilter === 'read',
    limit,
  })

  const filteredAlerts = alerts.filter((alert) => {
    if (readFilter === 'unread' && alert.is_read) return false
    if (readFilter === 'read' && !alert.is_read) return false
    return true
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Alertas en Tiempo Real
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Select
              value={severityFilter}
              onValueChange={(value) => setSeverityFilter(value as AlertSeverity | 'all')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="low">Baja</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={readFilter}
              onValueChange={(value) =>
                setReadFilter(value as 'all' | 'unread' | 'read')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="unread">No leídas</SelectItem>
                <SelectItem value="read">Leídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Lista de alertas */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No hay alertas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAlerts.map((alert) => {
              const severity = formatAlertSeverity(alert.severity)
              return (
                <div
                  key={alert.id}
                  className={`p-3 border rounded-lg ${
                    !alert.is_read ? 'bg-muted/50 border-primary/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle
                          className={`w-4 h-4 ${
                            alert.severity === 'critical'
                              ? 'text-red-600'
                              : alert.severity === 'high'
                              ? 'text-orange-600'
                              : 'text-yellow-600'
                          }`}
                        />
                        <Badge className={severity.bgColor} variant="secondary">
                          {severity.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(alert.created_at), 'dd/MM/yyyy HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm font-medium mb-1">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">
                        Valor actual: {alert.current_value.toFixed(2)} | Umbral:{' '}
                        {alert.threshold_value.toFixed(2)}
                      </p>
                    </div>
                    {!alert.is_read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markAsRead(alert.id)}
                        className="flex-shrink-0"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

