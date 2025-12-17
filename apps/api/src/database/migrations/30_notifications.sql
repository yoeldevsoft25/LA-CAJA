-- Migración 30: Sistema de Notificaciones Push Inteligentes
-- Sistema completo de notificaciones con soporte PWA, WebSocket y preferencias

-- Tabla para almacenar notificaciones
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES profiles(id) ON DELETE CASCADE, -- NULL = notificación global del store
  notification_type VARCHAR(50) NOT NULL, -- alert, info, warning, success, system
  category VARCHAR(50) NOT NULL, -- stock_low, sale_completed, debt_overdue, etc.
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  icon VARCHAR(100) NULL, -- Nombre del icono o URL
  action_url VARCHAR(500) NULL, -- URL de acción (ej: /products/123)
  action_label VARCHAR(100) NULL, -- Texto del botón de acción
  priority VARCHAR(20) NOT NULL DEFAULT 'normal', -- low, normal, high, urgent
  severity VARCHAR(20) NULL, -- low, medium, high, critical (heredado de alertas)
  entity_type VARCHAR(50) NULL, -- sale, product, inventory, etc.
  entity_id UUID NULL,
  metadata JSONB NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ NULL,
  is_delivered BOOLEAN NOT NULL DEFAULT false,
  delivered_at TIMESTAMPTZ NULL,
  delivery_channels JSONB NULL, -- ['push', 'websocket', 'in_app', 'email']
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_store ON notifications(store_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_category ON notifications(category);
CREATE INDEX idx_notifications_read ON notifications(is_read, created_at DESC);
CREATE INDEX idx_notifications_delivered ON notifications(is_delivered);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_entity ON notifications(entity_type, entity_id);

-- Tabla para preferencias de notificaciones por usuario
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  channels JSONB NOT NULL DEFAULT '["in_app"]', -- ['push', 'websocket', 'in_app', 'email']
  quiet_hours_start TIME NULL, -- Hora inicio de silencio (ej: 22:00)
  quiet_hours_end TIME NULL, -- Hora fin de silencio (ej: 08:00)
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, user_id, category)
);

CREATE INDEX idx_notification_preferences_store_user ON notification_preferences(store_id, user_id);
CREATE INDEX idx_notification_preferences_category ON notification_preferences(category);

-- Tabla para suscripciones push de PWA
CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL, -- Identificador único del dispositivo
  endpoint TEXT NOT NULL, -- URL del endpoint de push service
  p256dh_key TEXT NOT NULL, -- Clave pública P256DH
  auth_key TEXT NOT NULL, -- Clave de autenticación
  user_agent TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, user_id, device_id)
);

CREATE INDEX idx_notification_subscriptions_store_user ON notification_subscriptions(store_id, user_id);
CREATE INDEX idx_notification_subscriptions_active ON notification_subscriptions(is_active) WHERE is_active = true;

-- Tabla para historial de entregas de notificaciones
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  subscription_id UUID NULL REFERENCES notification_subscriptions(id) ON DELETE SET NULL,
  channel VARCHAR(50) NOT NULL, -- push, websocket, in_app, email
  status VARCHAR(20) NOT NULL, -- pending, sent, delivered, failed
  error_message TEXT NULL,
  delivered_at TIMESTAMPTZ NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_deliveries_notification ON notification_deliveries(notification_id);
CREATE INDEX idx_notification_deliveries_subscription ON notification_deliveries(subscription_id);
CREATE INDEX idx_notification_deliveries_status ON notification_deliveries(status);
CREATE INDEX idx_notification_deliveries_channel ON notification_deliveries(channel);

-- Tabla para badges/contadores de notificaciones no leídas
CREATE TABLE IF NOT EXISTS notification_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category VARCHAR(50) NULL, -- NULL = total general
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_notification_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, user_id, category)
);

CREATE INDEX idx_notification_badges_store_user ON notification_badges(store_id, user_id);

COMMENT ON TABLE notifications IS 'Notificaciones del sistema (alertas, información, advertencias)';
COMMENT ON TABLE notification_preferences IS 'Preferencias de notificación por usuario y categoría';
COMMENT ON TABLE notification_subscriptions IS 'Suscripciones push de PWA para notificaciones fuera de la app';
COMMENT ON TABLE notification_deliveries IS 'Historial de entregas de notificaciones por canal';
COMMENT ON TABLE notification_badges IS 'Contadores de notificaciones no leídas por usuario y categoría';

