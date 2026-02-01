import { useEffect, useMemo } from 'react'
import { useServerNotifications } from './useNotifications'
import { useNotifications as useLocalNotifications } from '@/stores/notifications.store'
import { notificationsService } from '@/services/notifications.service'
import type { Notification } from '@/types/notifications.types'

/**
 * Hook para sincronizar notificaciones del servidor con el store local
 */
export function useNotificationsSync() {
  const { notifications: serverNotifications, markAsRead: markServerAsRead } = useServerNotifications()
  const { items: localNotifications, markAsRead: markLocalAsRead, markAllAsRead: markLocalAllAsRead } = useLocalNotifications()

  // Mapear tipo de notificación del servidor al tipo local
  const mapServerTypeToLocal = (type: string): 'info' | 'warning' | 'error' | 'success' => {
    switch (type) {
      case 'alert':
        return 'error'
      case 'warning':
        return 'warning'
      case 'success':
        return 'success'
      case 'system':
      case 'info':
      default:
        return 'info'
    }
  }

  // Sincronizar estado de lectura del servidor al local cuando cambia
  useEffect(() => {
    serverNotifications.forEach((serverNotif: Notification) => {
      const serverNotifId = `server-${serverNotif.id}`
      const existingLocalNotif = localNotifications.find((n) => n.id === serverNotifId)
      
      // Si la notificación del servidor está marcada como leída pero no en local, sincronizar
      if (serverNotif.is_read && existingLocalNotif && !existingLocalNotif.read) {
        markLocalAsRead(serverNotifId)
      }
    })
  }, [serverNotifications, localNotifications, markLocalAsRead])

  // Combinar notificaciones: local + servidor (sin duplicados)
  const combinedNotifications = useMemo(() => {
    // Notificaciones del servidor convertidas al formato local
    const serverNotificationsLocal = serverNotifications.map((serverNotif) => ({
      id: `server-${serverNotif.id}`,
      title: serverNotif.title,
      description: serverNotif.message,
      type: mapServerTypeToLocal(serverNotif.notification_type) as 'info' | 'warning' | 'error' | 'success',
      created_at: new Date(serverNotif.created_at).getTime(),
      read: serverNotif.is_read,
    }))

    // Notificaciones locales que NO vienen del servidor (son notificaciones puramente locales)
    const pureLocalNotifications = localNotifications.filter(
      (n) => !n.id.startsWith('server-')
    )

    // Combinar: notificaciones locales puras + notificaciones del servidor
    // Si hay una notificación local que viene del servidor, usar la del servidor (más actualizada)
    const all = [...pureLocalNotifications, ...serverNotificationsLocal]
    
    // Eliminar duplicados (mantener la del servidor si ambas existen)
    const unique = all.filter((notif, index, self) => 
      index === self.findIndex((n) => n.id === notif.id)
    )

    // Ordenar por fecha (más recientes primero)
    return unique.sort((a, b) => b.created_at - a.created_at)
  }, [localNotifications, serverNotifications])

  // Función para marcar como leída que sincroniza ambos sistemas
  const handleMarkAsRead = (id: string) => {
    // Marcar en local
    markLocalAsRead(id)

    // Si es una notificación del servidor, también marcarla ahí
    if (id.startsWith('server-')) {
      const serverId = id.replace('server-', '')
      markServerAsRead(serverId)
      // También hacer la llamada al API para persistir
      notificationsService.markAsRead(serverId).catch((error) => {
        console.error('[NotificationsSync] Error marcando como leída en servidor:', error)
      })
    }
  }

  // Función para marcar todas como leídas
  const handleMarkAllAsRead = () => {
    // Marcar todas las locales
    markLocalAllAsRead()

    // Marcar todas las del servidor que no estén leídas
    const unreadServer = serverNotifications.filter((n) => !n.is_read)
    unreadServer.forEach((serverNotif) => {
      markServerAsRead(serverNotif.id)
      notificationsService.markAsRead(serverNotif.id).catch((error) => {
        console.error('[NotificationsSync] Error marcando como leída en servidor:', error)
      })
    })

    // También marcar todas en el servidor con una sola llamada
    notificationsService.markAllAsRead().catch((error) => {
      console.error('[NotificationsSync] Error marcando todas como leídas en servidor:', error)
    })
  }

  const unreadCount = useMemo(() => 
    combinedNotifications.filter((n) => !n.read).length,
    [combinedNotifications]
  )

  return {
    notifications: combinedNotifications,
    unreadCount,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
  }
}
