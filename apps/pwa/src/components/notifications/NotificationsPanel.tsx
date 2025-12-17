import { useServerNotifications } from '@/hooks/useNotifications'
import { useNotificationBadge } from '@/hooks/useNotificationBadge'
import { Button } from '@/components/ui/button'
import type { NotificationSeverity } from '@/types/notifications.types'
import { Bell, CheckCheck, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Panel de notificaciones
 */
export function NotificationsPanel() {
  const {
    notifications,
    unreadNotifications,
    markAsRead,
    markAllAsRead,
    isLoading,
  } = useServerNotifications()
  const { unreadCount } = useNotificationBadge()

  const getSeverityColor = (severity: NotificationSeverity | null): string => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500'
      case 'high':
        return 'bg-orange-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'low':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return '⚠️'
      case 'warning':
        return '⚠️'
      case 'success':
        return '✅'
      case 'info':
        return 'ℹ️'
      case 'system':
        return '🔧'
      default:
        return '🔔'
    }
  }

  if (isLoading) {
    return (
      <div className="w-80 p-4">
        <p className="text-sm text-muted-foreground">Cargando notificaciones...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-80 max-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h3 className="font-semibold">Notificaciones</h3>
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsRead()}
            className="h-8 text-xs"
          >
            <CheckCheck className="h-3 w-3 mr-1" />
            Marcar todas
          </Button>
        )}
      </div>

      {/* Lista de notificaciones */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay notificaciones</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 cursor-pointer hover:bg-accent transition-colors ${
                  !notification.is_read ? 'bg-accent/50' : ''
                }`}
                onClick={() => {
                  if (!notification.is_read) {
                    markAsRead(notification.id)
                  }
                  if (notification.action_url) {
                    window.location.href = notification.action_url
                  }
                }}
              >
                <div className="flex gap-3">
                  {/* Indicador de severidad */}
                  <div
                    className={`w-1 rounded-full flex-shrink-0 ${getSeverityColor(
                      notification.severity
                    )}`}
                  />

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-base flex-shrink-0">
                          {getTypeIcon(notification.notification_type)}
                        </span>
                        <h4
                          className={`font-medium text-sm ${
                            !notification.is_read ? 'font-semibold' : ''
                          }`}
                        >
                          {notification.title}
                        </h4>
                      </div>
                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      </div>
                      {notification.action_url && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.location.href = notification.action_url!
                          }}
                        >
                          {notification.action_label || 'Ver más'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
