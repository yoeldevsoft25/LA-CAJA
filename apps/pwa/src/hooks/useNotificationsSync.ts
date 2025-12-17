import { useEffect } from 'react'
import { useServerNotifications } from './useNotifications'
import { useNotifications as useLocalNotifications } from '@/stores/notifications.store'
import type { Notification } from '@/types/notifications.types'

/**
 * Hook para sincronizar notificaciones del servidor con el store local
 */
export function useNotificationsSync() {
  const { notifications: serverNotifications } = useServerNotifications()
  const { items: localNotifications, add, markAsRead: markLocalAsRead } = useLocalNotifications()

  // Mapear tipo de notificación del servidor al tipo local
  const mapServerTypeToLocal = (type: string): 'info' | 'warning' | 'error' | 'success' => {
    switch (type) {
      case 'alert':
      case 'warning':
        return 'warning'
      case 'success':
        return 'success'
      case 'system':
        return 'info'
      default:
        return 'info'
    }
  }

  // Sincronizar notificaciones del servidor al store local
  useEffect(() => {
    serverNotifications.forEach((serverNotif: Notification) => {
      // Buscar si ya existe en el store local
      const exists = localNotifications.some((localNotif) => localNotif.id === `server-${serverNotif.id}`)

      // Si no existe, agregarla al store local
      if (!exists) {
        add({
          title: serverNotif.title,
          description: serverNotif.message,
          type: mapServerTypeToLocal(serverNotif.notification_type),
        })
      }

      // Si la notificación del servidor está marcada como leída pero no en local, sincronizar
      if (serverNotif.is_read) {
        const localNotif = localNotifications.find((n) => n.id === `server-${serverNotif.id}`)
        if (localNotif && !localNotif.read) {
          markLocalAsRead(`server-${serverNotif.id}`)
        }
      }
    })
  }, [serverNotifications, localNotifications, add, markLocalAsRead])

  // Retornar las notificaciones combinadas
  const allNotifications = [
    ...localNotifications,
    ...serverNotifications.map((serverNotif: Notification) => ({
      id: `server-${serverNotif.id}`,
      title: serverNotif.title,
      description: serverNotif.message,
      type: mapServerTypeToLocal(serverNotif.notification_type) as 'info' | 'warning' | 'error' | 'success',
      created_at: new Date(serverNotif.created_at).getTime(),
      read: serverNotif.is_read,
    })),
  ].sort((a, b) => b.created_at - a.created_at)

  // Eliminar duplicados (mantener solo las del servidor si ambas existen)
  const uniqueNotifications = allNotifications.filter(
    (notif, index, self) => index === self.findIndex((n) => n.id === notif.id)
  )

  return {
    notifications: uniqueNotifications,
    unreadCount: uniqueNotifications.filter((n) => !n.read).length,
  }
}
