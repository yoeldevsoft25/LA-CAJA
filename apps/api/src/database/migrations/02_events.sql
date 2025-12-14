-- ============================================
-- 2. EVENT STORE (Event Log)
-- ============================================
-- Tabla principal para almacenar todos los eventos del sistema
-- Implementa deduplicación por event_id

CREATE TABLE IF NOT EXISTS events (
  event_id UUID PRIMARY KEY, -- No DEFAULT, se genera en el cliente
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  device_id UUID NOT NULL,
  seq BIGINT NOT NULL,
  type TEXT NOT NULL,
  version INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  actor_user_id UUID,
  actor_role TEXT,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE events IS 'Event store - Todos los eventos del sistema (Event Sourcing)';
COMMENT ON COLUMN events.event_id IS 'ID único del evento (UUID generado en cliente) - Clave primaria para deduplicación';
COMMENT ON COLUMN events.store_id IS 'ID de la tienda que generó el evento';
COMMENT ON COLUMN events.device_id IS 'ID del dispositivo que generó el evento';
COMMENT ON COLUMN events.seq IS 'Secuencia local del dispositivo';
COMMENT ON COLUMN events.type IS 'Tipo de evento (ej: SaleCreated, ProductCreated)';
COMMENT ON COLUMN events.version IS 'Versión del schema del evento (para evolucionar sin romper)';
COMMENT ON COLUMN events.created_at IS 'Timestamp de cuando se creó el evento (epoch ms desde cliente)';
COMMENT ON COLUMN events.actor_user_id IS 'ID del usuario que generó el evento';
COMMENT ON COLUMN events.actor_role IS 'Rol del usuario (owner/cashier)';
COMMENT ON COLUMN events.payload IS 'Payload JSON del evento';
COMMENT ON COLUMN events.received_at IS 'Timestamp de cuando el servidor recibió el evento';

-- Índices para mejor rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_events_store_seq ON events(store_id, seq);
CREATE INDEX IF NOT EXISTS idx_events_store_type ON events(store_id, type);
CREATE INDEX IF NOT EXISTS idx_events_store_created ON events(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_device ON events(device_id);

-- Verificar que se creó correctamente
SELECT 'Tabla de eventos creada correctamente' AS status;

