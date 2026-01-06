import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { notificationsWebSocketService } from '@/services/notifications-websocket.service'
import { notificationsService } from '@/services/notifications.service'
import type { NotificationBadge } from '@/types/notifications.types'
import { useAuth } from '@/stores/auth.store'

const isBadgeUpdateEvent = (
  event: unknown
): event is { badge: NotificationBadge } =>
  typeof event === 'object' && event !== null && 'badge' in event

/**
 * Hook para obtener el badge de notificaciones no leídas
 */
export function useNotificationBadge(category?: string) {
  const { user } = useAuth()
  const storeId = user?.store_id
  const userId = user?.user_id
  const [badge, setBadge] = useState<NotificationBadge | null>(null)

  const { data: initialBadge } = useQuery({
    queryKey: ['notification-badge', storeId, userId, category],
    queryFn: () => notificationsService.getBadge(category),
    enabled: !!storeId && !!userId,
  })

  useEffect(() => {
    if (initialBadge) {
      setBadge(initialBadge)
    }
  }, [initialBadge])

  useEffect(() => {
    if (!storeId || !userId) return

    const handleBadgeUpdate = (event: unknown) => {
      if (!isBadgeUpdateEvent(event)) return
      if (!category || event.badge.category === category) {
        setBadge(event.badge)
      }
    }

    notificationsWebSocketService.on('badge:update', handleBadgeUpdate)
    notificationsWebSocketService.getBadge(category)

    return () => {
      notificationsWebSocketService.off('badge:update', handleBadgeUpdate)
    }
  }, [storeId, userId, category])

  return {
    badge,
    unreadCount: badge?.unread_count || 0,
  }
}
