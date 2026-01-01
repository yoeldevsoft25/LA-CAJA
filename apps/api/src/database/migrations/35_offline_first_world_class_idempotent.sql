-- =====================================================
-- OFFLINE-FIRST WORLD-CLASS MIGRATION (IDEMPOTENTE)
-- =====================================================
-- Versión idempotente que puede ejecutarse múltiples veces
-- =====================================================

-- =====================================================
-- 1. MEJORAR TABLA DE EVENTOS CON VECTOR CLOCKS
-- =====================================================

-- Agregar campos para vector clocks y resolución de conflictos
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS vector_clock JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS causal_dependencies TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS conflict_status TEXT DEFAULT 'resolved',
  ADD COLUMN IF NOT EXISTS delta_payload JSONB,
  ADD COLUMN IF NOT EXISTS full_payload_hash TEXT;

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_events_conflict_status
  ON events(store_id, conflict_status)
  WHERE conflict_status != 'resolved';

CREATE INDEX IF NOT EXISTS idx_events_vector_clock
  ON events USING GIN(vector_clock);

-- =====================================================
-- 2. DEVICE SYNC STATE (Estado de sincronización)
-- =====================================================

CREATE TABLE IF NOT EXISTS device_sync_state (
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  device_id UUID NOT NULL,

  -- Sincronización
  last_synced_at TIMESTAMPTZ,
  last_synced_seq BIGINT DEFAULT 0,
  vector_clock JSONB DEFAULT '{}',

  -- Salud y conflictos
  pending_conflicts_count INT DEFAULT 0,
  health_status TEXT DEFAULT 'healthy',

  -- Circuit Breaker
  circuit_breaker_state TEXT DEFAULT 'CLOSED',
  circuit_breaker_failure_count INT DEFAULT 0,
  circuit_breaker_last_failure_at TIMESTAMPTZ,
  circuit_breaker_success_count INT DEFAULT 0,

  -- Métricas
  total_events_synced BIGINT DEFAULT 0,
  total_bytes_synced BIGINT DEFAULT 0,
  avg_sync_duration_ms INT,
  last_sync_duration_ms INT,
  last_sync_error TEXT,

  -- Metadata
  device_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (store_id, device_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_device_sync_state_health
  ON device_sync_state(store_id, health_status);

CREATE INDEX IF NOT EXISTS idx_device_sync_state_conflicts
  ON device_sync_state(store_id, pending_conflicts_count)
  WHERE pending_conflicts_count > 0;

CREATE INDEX IF NOT EXISTS idx_device_sync_state_circuit
  ON device_sync_state(store_id, circuit_breaker_state)
  WHERE circuit_breaker_state != 'CLOSED';

-- =====================================================
-- 3. SYNC CONFLICTS (Conflictos de sincronización)
-- =====================================================

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Eventos en conflicto
  event_id_a UUID NOT NULL REFERENCES events(event_id),
  event_id_b UUID NOT NULL REFERENCES events(event_id),

  -- Clasificación del conflicto
  conflict_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  field_name TEXT,

  -- Valores en conflicto
  value_a JSONB NOT NULL,
  value_b JSONB NOT NULL,

  -- Resolución
  resolution_strategy TEXT,
  resolution_status TEXT DEFAULT 'pending',
  resolution_value JSONB,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,

  -- Prioridad
  priority TEXT DEFAULT 'medium',

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_pending
  ON sync_conflicts(store_id, resolution_status, created_at DESC)
  WHERE resolution_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_priority
  ON sync_conflicts(store_id, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_entity
  ON sync_conflicts(store_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_events
  ON sync_conflicts(event_id_a, event_id_b);

-- =====================================================
-- 4. SYNC METRICS (Métricas de sincronización)
-- =====================================================

CREATE TABLE IF NOT EXISTS sync_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  device_id UUID NOT NULL,

  -- Timing
  sync_started_at TIMESTAMPTZ NOT NULL,
  sync_completed_at TIMESTAMPTZ,

  -- Contadores
  events_pushed INT DEFAULT 0,
  events_accepted INT DEFAULT 0,
  events_rejected INT DEFAULT 0,
  events_conflicted INT DEFAULT 0,

  -- Compresión
  payload_size_bytes INT DEFAULT 0,
  compressed_size_bytes INT DEFAULT 0,
  compression_ratio DECIMAL(5,2),

  -- Performance
  network_latency_ms INT,
  server_processing_ms INT,
  client_processing_ms INT,
  total_duration_ms INT,

  -- Resultado
  success BOOLEAN DEFAULT TRUE,
  error_code TEXT,
  error_message TEXT,

  -- Contexto
  retry_attempt INT DEFAULT 0,
  circuit_breaker_state TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sync_metrics_store_device
  ON sync_metrics(store_id, device_id, sync_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_metrics_failed
  ON sync_metrics(store_id, success, sync_started_at DESC)
  WHERE success = FALSE;

CREATE INDEX IF NOT EXISTS idx_sync_metrics_slow
  ON sync_metrics(store_id, total_duration_ms DESC, sync_started_at DESC)
  WHERE total_duration_ms > 5000;

-- =====================================================
-- 5. CONFLICT RESOLUTION RULES (Reglas de resolución)
-- =====================================================

CREATE TABLE IF NOT EXISTS conflict_resolution_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Scope de la regla
  entity_type TEXT NOT NULL,
  field_name TEXT,
  conflict_type TEXT,

  -- Estrategia
  strategy TEXT NOT NULL,

  -- Configuración específica
  config JSONB DEFAULT '{}',

  -- Prioridad (mayor = se aplica primero)
  priority INT DEFAULT 100,

  -- Activación
  active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_conflict_rules_lookup
  ON conflict_resolution_rules(store_id, entity_type, field_name, active)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_conflict_rules_priority
  ON conflict_resolution_rules(store_id, priority DESC, created_at DESC);

-- =====================================================
-- 6. FUNCIONES AUXILIARES (IDEMPOTENTES)
-- =====================================================

-- Drop y recrear para que sea idempotente
DROP TRIGGER IF EXISTS trigger_device_sync_state_updated_at ON device_sync_state;
DROP FUNCTION IF EXISTS update_device_sync_state_timestamp();

CREATE FUNCTION update_device_sync_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_device_sync_state_updated_at
BEFORE UPDATE ON device_sync_state
FOR EACH ROW
EXECUTE FUNCTION update_device_sync_state_timestamp();

-- Drop y recrear para que sea idempotente
DROP TRIGGER IF EXISTS trigger_sync_conflicts_updated_at ON sync_conflicts;
DROP FUNCTION IF EXISTS update_sync_conflicts_timestamp();

CREATE FUNCTION update_sync_conflicts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_conflicts_updated_at
BEFORE UPDATE ON sync_conflicts
FOR EACH ROW
EXECUTE FUNCTION update_sync_conflicts_timestamp();

-- =====================================================
-- 7. VISTAS ÚTILES (IDEMPOTENTES)
-- =====================================================

-- Vista: Dispositivos con problemas de salud
CREATE OR REPLACE VIEW v_unhealthy_devices AS
SELECT
  dss.store_id,
  dss.device_id,
  dss.health_status,
  dss.circuit_breaker_state,
  dss.pending_conflicts_count,
  dss.last_synced_at,
  dss.last_sync_error,
  s.name AS store_name
FROM device_sync_state dss
JOIN stores s ON s.id = dss.store_id
WHERE dss.health_status IN ('degraded', 'critical')
   OR dss.circuit_breaker_state != 'CLOSED'
   OR dss.pending_conflicts_count > 0
ORDER BY dss.health_status DESC, dss.pending_conflicts_count DESC;

-- Vista: Conflictos pendientes por prioridad
CREATE OR REPLACE VIEW v_pending_conflicts AS
SELECT
  sc.id,
  sc.store_id,
  sc.entity_type,
  sc.entity_id,
  sc.conflict_type,
  sc.priority,
  sc.created_at,
  s.name AS store_name,
  EXTRACT(EPOCH FROM (NOW() - sc.created_at)) / 3600 AS hours_pending
FROM sync_conflicts sc
JOIN stores s ON s.id = sc.store_id
WHERE sc.resolution_status = 'pending'
ORDER BY
  CASE sc.priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  sc.created_at ASC;

-- Vista: Estadísticas de sincronización por tienda
CREATE OR REPLACE VIEW v_sync_stats_by_store AS
SELECT
  s.id AS store_id,
  s.name AS store_name,
  COUNT(DISTINCT dss.device_id) AS total_devices,
  COUNT(DISTINCT dss.device_id) FILTER (WHERE dss.health_status = 'healthy') AS healthy_devices,
  COUNT(DISTINCT dss.device_id) FILTER (WHERE dss.health_status = 'degraded') AS degraded_devices,
  COUNT(DISTINCT dss.device_id) FILTER (WHERE dss.health_status = 'critical') AS critical_devices,
  SUM(dss.pending_conflicts_count) AS total_pending_conflicts,
  MAX(dss.last_synced_at) AS most_recent_sync,
  AVG(dss.avg_sync_duration_ms) AS avg_sync_duration_ms,
  SUM(dss.total_events_synced) AS total_events_synced,
  SUM(dss.total_bytes_synced) AS total_bytes_synced
FROM stores s
LEFT JOIN device_sync_state dss ON dss.store_id = s.id
GROUP BY s.id, s.name
ORDER BY total_pending_conflicts DESC;

-- =====================================================
-- 8. INSERTAR REGLAS POR DEFECTO (IDEMPOTENTE)
-- =====================================================

-- Insertar solo si no existen (basado en store_id + entity_type)
DO $$
DECLARE
  store_record RECORD;
BEGIN
  FOR store_record IN SELECT id FROM stores LOOP
    -- Regla para productos (LWW)
    INSERT INTO conflict_resolution_rules (
      id,
      store_id,
      entity_type,
      field_name,
      conflict_type,
      strategy,
      priority,
      active
    )
    SELECT
      gen_random_uuid(),
      store_record.id,
      'product',
      NULL,
      'concurrent_update',
      'lww',
      100,
      TRUE
    WHERE NOT EXISTS (
      SELECT 1 FROM conflict_resolution_rules
      WHERE store_id = store_record.id
        AND entity_type = 'product'
        AND field_name IS NULL
    );

    -- Regla para movimientos de inventario (AWSet)
    INSERT INTO conflict_resolution_rules (
      id,
      store_id,
      entity_type,
      field_name,
      conflict_type,
      strategy,
      config,
      priority,
      active
    )
    SELECT
      gen_random_uuid(),
      store_record.id,
      'inventory_movement',
      NULL,
      'concurrent_update',
      'awset',
      '{"merge_strategy": "sum"}',
      100,
      TRUE
    WHERE NOT EXISTS (
      SELECT 1 FROM conflict_resolution_rules
      WHERE store_id = store_record.id
        AND entity_type = 'inventory_movement'
        AND field_name IS NULL
    );
  END LOOP;
END $$;

-- =====================================================
-- 9. VERIFICACIÓN FINAL
-- =====================================================

-- Verificar que todo se creó correctamente
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'device_sync_state',
      'sync_conflicts',
      'sync_metrics',
      'conflict_resolution_rules'
    );

  IF table_count = 4 THEN
    RAISE NOTICE '✅ Migración completada exitosamente! 4/4 tablas creadas';
  ELSE
    RAISE WARNING '⚠️  Solo se crearon % de 4 tablas', table_count;
  END IF;
END $$;

-- =====================================================
-- FIN DE LA MIGRACIÓN IDEMPOTENTE
-- =====================================================
