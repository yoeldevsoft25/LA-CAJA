import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { notificationsWebSocketService } from '@/services/notifications-websocket.service'
import { notificationsService } from '@/services/notifications.service'
import type { Notification } from '@/types/notifications.types'
import { useAuth } from '@/stores/auth.store'

/**
 * Hook para manejar notificaciones del servidor en tiempo real
 */
export function useServerNotifications() {
  const { user } = useAuth()
  const storeId = user?.store_id
  const userId = user?.user_id
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isConnected, setIsConnected] = useState(false)

  // Query inicial
  const { data: initialNotifications, isLoading } = useQuery({
    queryKey: ['notifications', storeId, userId],
    queryFn: () => notificationsService.getNotifications({ limit: 50 }),
    enabled: !!storeId && !!userId,
  })

  useEffect(() => {
    if (initialNotifications) {
      setNotifications(initialNotifications)
    }
  }, [initialNotifications])

  // WebSocket connection
  useEffect(() => {
    if (!storeId || !userId) return

    notificationsWebSocketService.connect(storeId, userId)
    setIsConnected(notificationsWebSocketService.isConnected())

    const handleConnect = () => setIsConnected(true)
    const handleDisconnect = () => setIsConnected(false)
    const handleNewNotification = (event: { notification: Notification }) => {
      setNotifications((prev) => [event.notification, ...prev])
    }
    const handleNotifications = (event: { notifications: Notification[] }) => {
      setNotifications(event.notifications)
    }

    notificationsWebSocketService.on('connected', handleConnect)
    notificationsWebSocketService.on('disconnect', handleDisconnect)
    notificationsWebSocketService.on('notification:new', handleNewNotification)
    notificationsWebSocketService.on('notifications', handleNotifications)

    notificationsWebSocketService.subscribe()
    notificationsWebSocketService.getNotifications({ limit: 50 })

    return () => {
      notificationsWebSocketService.off('connected', handleConnect)
      notificationsWebSocketService.off('disconnect', handleDisconnect)
      notificationsWebSocketService.off('notification:new', handleNewNotification)
      notificationsWebSocketService.off('notifications', handleNotifications)
      notificationsWebSocketService.disconnect()
    }
  }, [storeId, userId])

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markAsRead(id),
    onSuccess: (updated) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === updated.id ? updated : n))
      )
    },
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: (category?: string) =>
      notificationsService.markAllAsRead(category),
    onSuccess: () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    },
  })

  return {
    notifications,
    unreadNotifications: notifications.filter((n) => !n.is_read),
    isLoading,
    isConnected,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
  }
}
