import { useEffect, useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { realtimeAnalyticsService } from '@/services/realtime-analytics.service'
import { realtimeWebSocketService } from '@/services/realtime-websocket.service'
import { RealTimeAlert, AlertSeverity } from '@/types/realtime-analytics.types'
import toast from '@/lib/toast'

export function useRealtimeAlerts(params?: {
  is_read?: boolean
  severity?: AlertSeverity
  limit?: number
}) {
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)
  const [newAlerts, setNewAlerts] = useState<RealTimeAlert[]>([])

  // Obtener alertas iniciales desde API REST
  const {
    data: alertsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['realtime-alerts', params],
    queryFn: () => realtimeAnalyticsService.getAlerts(params),
    staleTime: 1000 * 60 * 2, // 2 minutos - más frecuente porque es rápido con vistas materializadas
    refetchInterval: 1000 * 60 * 2, // Refrescar cada 2 minutos como fallback (más frecuente)
  })

  // Callback para nuevas alertas
  const handleNewAlert = useCallback(
    (alert: RealTimeAlert) => {
      setNewAlerts((prev) => {
        if (prev.find((a) => a.id === alert.id)) return prev
        return [alert, ...prev]
      })

      // Mostrar notificación toast
      toast.error(alert.message, {
        duration: alert.severity === 'critical' ? 10000 : 5000,
        icon: '⚠️',
      })

      // Actualizar cache
      queryClient.setQueryData(
        ['realtime-alerts', params],
        (old: any) => {
          if (!old) {
            return {
              alerts: [alert],
              unread_count: 1,
            }
          }
          return {
            alerts: [alert, ...old.alerts],
            unread_count: old.unread_count + 1,
          }
        },
      )
    },
    [params, queryClient],
  )

  // Conectar WebSocket y suscribirse
  useEffect(() => {
    realtimeWebSocketService.connect()

    const checkConnection = setInterval(() => {
      const connected = realtimeWebSocketService.connected
      setIsConnected(connected)
      
      // Suscribirse cuando se conecte
      if (connected) {
        realtimeWebSocketService.subscribeToAlerts()
      }
    }, 1000)

    const unsubscribe = realtimeWebSocketService.onAlertNew(handleNewAlert)

    return () => {
      clearInterval(checkConnection)
      unsubscribe()
    }
  }, [handleNewAlert])

  // Limpiar nuevas alertas después de un tiempo
  useEffect(() => {
    const timer = setInterval(() => {
      setNewAlerts([])
    }, 1000 * 60 * 10) // Limpiar cada 10 minutos

    return () => clearInterval(timer)
  }, [])

  const markAsRead = async (alertId: string) => {
    try {
      await realtimeAnalyticsService.markAlertAsRead(alertId)
      queryClient.invalidateQueries({ queryKey: ['realtime-alerts'] })
    } catch (error) {
      console.error('Error marcando alerta como leída:', error)
    }
  }

  return {
    alerts: alertsData?.alerts || [],
    unreadCount: alertsData?.unread_count || 0,
    newAlerts,
    isLoading,
    error,
    isConnected,
    markAsRead,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['realtime-alerts'] }),
  }
}

