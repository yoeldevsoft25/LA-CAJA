import { api } from '@/lib/api'
import type {
  Notification,
  NotificationPreference,
  NotificationBadge,
  PushSubscription,
} from '@/types/notifications.types'

/**
 * API service para notificaciones
 */
export const notificationsService = {
  // Notificaciones
  getNotifications: async (params: {
    notification_type?: string
    category?: string
    is_read?: boolean
    start_date?: string
    end_date?: string
    limit?: number
  }): Promise<Notification[]> => {
    const response = await api.get<Notification[]>('/notifications', { params })
    return response.data
  },

  createNotification: async (data: any): Promise<Notification> => {
    const response = await api.post<Notification>('/notifications', data)
    return response.data
  },

  markAsRead: async (id: string): Promise<Notification> => {
    const response = await api.post<Notification>(`/notifications/${id}/read`)
    return response.data
  },

  markAllAsRead: async (category?: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>(
      '/notifications/read-all',
      null,
      {
        params: category ? { category } : {},
      }
    )
    return response.data
  },

  // Push subscriptions
  subscribePush: async (data: PushSubscription): Promise<any> => {
    const response = await api.post('/notifications/push/subscribe', data)
    return response.data
  },

  unsubscribePush: async (deviceId: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>(
      '/notifications/push/unsubscribe',
      { device_id: deviceId }
    )
    return response.data
  },

  // Preferencias
  getPreferences: async (): Promise<NotificationPreference[]> => {
    const response = await api.get<NotificationPreference[]>(
      '/notifications/preferences'
    )
    return response.data
  },

  updatePreference: async (
    category: string,
    data: Partial<NotificationPreference>
  ): Promise<NotificationPreference> => {
    const response = await api.put<NotificationPreference>(
      `/notifications/preferences/${category}`,
      data
    )
    return response.data
  },

  // Badge
  getBadge: async (category?: string): Promise<NotificationBadge> => {
    const response = await api.get<NotificationBadge>('/notifications/badge', {
      params: category ? { category } : {},
    })
    return response.data
  },
}
