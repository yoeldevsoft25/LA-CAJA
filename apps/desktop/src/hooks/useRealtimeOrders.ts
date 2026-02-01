import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/auth.store'
import { notificationsWebSocketService } from '@/services/notifications-websocket.service'
import toast from '@/lib/toast'

/**
 * Hook para escuchar actualizaciones de órdenes en tiempo real
 */
export function useRealtimeOrders() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const storeId = user?.store_id

  useEffect(() => {
    if (!storeId) return

    // Conectar al WebSocket si no está conectado
    if (!notificationsWebSocketService.isConnected()) {
      notificationsWebSocketService.connect(storeId, user?.user_id || '')
    }

    // Handler para actualizaciones de órdenes
    const handleOrderUpdate = (...args: unknown[]) => {
      const data = args[0] as { order: any; timestamp: number }
      const { order } = data

      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['order', order.id] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'open'] })
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] })

      // Si la orden está relacionada con una mesa, invalidar queries de mesas
      if (order.table_id) {
        queryClient.invalidateQueries({ queryKey: ['tables'] })
      }
    }

    // Handler para nuevas órdenes
    const handleOrderCreated = (...args: unknown[]) => {
      const data = args[0] as { order: any; timestamp: number }
      const { order } = data

      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['orders', 'open'] })
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })

      // Mostrar notificación si no es del usuario actual
      if (order.opened_by_user_id !== user?.user_id) {
        toast.success(`Nueva orden ${order.order_number}`, {
          icon: '🆕',
        })
      }
    }

    // Handler para actualizaciones de mesas
    const handleTableUpdate = (...args: unknown[]) => {
      const data = args[0] as { table: any; timestamp: number }
      const { table } = data

      // Invalidar queries de mesas
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['table', table.id] })
    }

    // Handler para cambios de estado de mesas
    const handleTableStatusChange = (...args: unknown[]) => {
      const data = args[0] as {
        table_id: string
        status: string
        timestamp: number
      }
      // Invalidar queries de mesas
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['table', data.table_id] })
    }

    // Handler para actualizaciones de cocina
    const handleKitchenUpdate = (...args: unknown[]) => {
      const data = args[0] as { order: any; timestamp: number }
      const { order } = data

      // Invalidar queries de cocina
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', order.id] })
    }

    // Suscribirse a eventos
    notificationsWebSocketService.on('order:update', handleOrderUpdate)
    notificationsWebSocketService.on('order:created', handleOrderCreated)
    notificationsWebSocketService.on('table:update', handleTableUpdate)
    notificationsWebSocketService.on('table:status_change', handleTableStatusChange)
    notificationsWebSocketService.on('kitchen:order_update', handleKitchenUpdate)

    // Cleanup
    return () => {
      notificationsWebSocketService.off('order:update', handleOrderUpdate)
      notificationsWebSocketService.off('order:created', handleOrderCreated)
      notificationsWebSocketService.off('table:update', handleTableUpdate)
      notificationsWebSocketService.off('table:status_change', handleTableStatusChange)
      notificationsWebSocketService.off('kitchen:order_update', handleKitchenUpdate)
    }
  }, [storeId, user?.user_id, queryClient])
}
