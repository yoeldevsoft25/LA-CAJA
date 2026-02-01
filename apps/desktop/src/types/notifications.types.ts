/**
 * Tipos TypeScript para el sistema de notificaciones
 */

export enum NotificationType {
  ALERT = 'alert',
  INFO = 'info',
  WARNING = 'warning',
  SUCCESS = 'success',
  SYSTEM = 'system',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum NotificationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface Notification {
  id: string
  store_id: string
  user_id: string | null
  notification_type: NotificationType
  category: string
  title: string
  message: string
  icon: string | null
  action_url: string | null
  action_label: string | null
  priority: NotificationPriority
  severity: NotificationSeverity | null
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, any> | null
  is_read: boolean
  read_at: string | null
  is_delivered: boolean
  delivered_at: string | null
  delivery_channels: string[] | null
  expires_at: string | null
  created_at: string
}

export interface NotificationPreference {
  id: string
  store_id: string
  user_id: string
  category: string
  enabled: boolean
  channels: string[]
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  metadata: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface NotificationBadge {
  id: string
  store_id: string
  user_id: string
  category: string | null
  unread_count: number
  last_notification_at: string | null
  updated_at: string
}

export interface PushSubscription {
  device_id: string
  endpoint: string
  p256dh_key: string
  auth_key: string
  user_agent?: string
}

