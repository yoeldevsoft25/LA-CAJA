-- =====================================================
-- OFFLINE-FIRST WORLD-CLASS MIGRATION
-- =====================================================
-- Agrega soporte para:
-- 1. Vector Clocks (ordenamiento causal)
-- 2. Device Sync State (salud y circuit breaker)
-- 3. Conflict Resolution (automática y manual)
-- 4. Sync Metrics (observabilidad)
-- 5. Delta Compression (optimización)
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

COMMENT ON COLUMN events.vector_clock IS 'Vector clock del evento: {device_id: seq, ...}';
COMMENT ON COLUMN events.causal_dependencies IS 'Array de event_ids que causalmente preceden a este evento';
COMMENT ON COLUMN events.conflict_status IS 'Estado del conflicto: resolved/pending/merged';
COMMENT ON COLUMN events.delta_payload IS 'Payload comprimido (solo campos modificados)';
COMMENT ON COLUMN events.full_payload_hash IS 'Hash SHA-256 del payload completo para validación';

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
  health_status TEXT DEFAULT 'healthy', -- healthy/degraded/critical

  -- Circuit Breaker
  circuit_breaker_state TEXT DEFAULT 'CLOSED', -- CLOSED/OPEN/HALF_OPEN
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
  device_metadata JSONB DEFAULT '{}', -- OS, app version, etc
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

COMMENT ON TABLE device_sync_state IS 'Estado de sincronización por dispositivo (vector clocks, health, circuit breaker)';
COMMENT ON COLUMN device_sync_state.vector_clock IS 'Vector clock actual del dispositivo: {device_id: last_seq, ...}';
COMMENT ON COLUMN device_sync_state.health_status IS 'healthy: sync OK | degraded: errores ocasionales | critical: múltiples fallos';
COMMENT ON COLUMN device_sync_state.circuit_breaker_state IS 'CLOSED: normal | OPEN: rechazar | HALF_OPEN: probar';

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
  conflict_type TEXT NOT NULL, -- concurrent_update/split_brain/causal_violation
  entity_type TEXT NOT NULL, -- product/sale/customer/debt/cash_session/etc
  entity_id UUID NOT NULL,
  field_name TEXT, -- Campo específico en conflicto (ej: "price_bs")

  -- Valores en conflicto
  value_a JSONB NOT NULL,
  value_b JSONB NOT NULL,

  -- Resolución
  resolution_strategy TEXT, -- lww/awset/mvr/ot/manual
  resolution_status TEXT DEFAULT 'pending', -- pending/auto_resolved/manual_resolved/escalated
  resolution_value JSONB,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID, -- user_id que resolvió manualmente

  -- Prioridad
  priority TEXT DEFAULT 'medium', -- critical/high/medium/low

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

COMMENT ON TABLE sync_conflicts IS 'Conflictos de sincronización pendientes o resueltos';
COMMENT ON COLUMN sync_conflicts.conflict_type IS 'concurrent_update: edición simultánea | split_brain: múltiples dispositivos offline | causal_violation: orden incorrecto';
COMMENT ON COLUMN sync_conflicts.resolution_strategy IS 'lww: Last-Write-Wins | awset: Add-Wins-Set | mvr: Multi-Value-Register | ot: Operational Transform | manual: usuario decide';

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
  compression_ratio DECIMAL(5,2), -- 0.54 = 54% reducción

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
  WHERE total_duration_ms > 5000; -- Syncs > 5s

COMMENT ON TABLE sync_metrics IS 'Métricas de rendimiento de sincronización para observabilidad';
COMMENT ON COLUMN sync_metrics.compression_ratio IS 'Ratio de compresión: compressed_size / original_size';

-- =====================================================
-- 5. CONFLICT RESOLUTION RULES (Reglas de resolución)
-- =====================================================

CREATE TABLE IF NOT EXISTS conflict_resolution_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Scope de la regla
  entity_type TEXT NOT NULL, -- product/sale/customer/etc
  field_name TEXT, -- NULL = toda la entidad
  conflict_type TEXT, -- NULL = todos los tipos

  -- Estrategia
  strategy TEXT NOT NULL, -- lww/awset/mvr/ot/manual

  -- Configuración específica
  config JSONB DEFAULT '{}', -- ej: {"tie_breaker": "device_id"}

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

COMMENT ON TABLE conflict_resolution_rules IS 'Reglas configurables de resolución de conflictos por tienda';

-- Insertar reglas por defecto
INSERT INTO conflict_resolution_rules (id, store_id, entity_type, field_name, conflict_type, strategy, priority, active)
SELECT
  gen_random_uuid(),
  id AS store_id,
  'product' AS entity_type,
  NULL AS field_name,
  'concurrent_update' AS conflict_type,
  'lww' AS strategy,
  100 AS priority,
  TRUE AS active
FROM stores
ON CONFLICT DO NOTHING;

-- Más reglas por defecto
INSERT INTO conflict_resolution_rules (id, store_id, entity_type, field_name, conflict_type, strategy, config, priority, active)
SELECT
  gen_random_uuid(),
  id AS store_id,
  'inventory_movement' AS entity_type,
  NULL AS field_name,
  'concurrent_update' AS conflict_type,
  'awset' AS strategy,
  '{"merge_strategy": "sum"}' AS config,
  100 AS priority,
  TRUE AS active
FROM stores
ON CONFLICT DO NOTHING;

-- =====================================================
-- 6. FUNCIONES AUXILIARES
-- =====================================================

-- Función para actualizar device_sync_state.updated_at
CREATE OR REPLACE FUNCTION update_device_sync_state_timestamp()
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

-- Función para actualizar sync_conflicts.updated_at
CREATE OR REPLACE FUNCTION update_sync_conflicts_timestamp()
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
-- 7. VISTAS ÚTILES
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

COMMENT ON VIEW v_unhealthy_devices IS 'Dispositivos con problemas de sincronización';

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

COMMENT ON VIEW v_pending_conflicts IS 'Conflictos pendientes ordenados por prioridad';

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

COMMENT ON VIEW v_sync_stats_by_store IS 'Estadísticas de sincronización agregadas por tienda';

-- =====================================================
-- 8. POLÍTICAS DE RETENCIÓN
-- =====================================================

-- Comentar esta política de retención para evitar pérdida de datos históricos
-- Se puede habilitar en producción con un cron job controlado

-- DELETE FROM sync_metrics WHERE created_at < NOW() - INTERVAL '90 days';
-- DELETE FROM sync_conflicts WHERE resolution_status IN ('auto_resolved', 'manual_resolved') AND resolved_at < NOW() - INTERVAL '30 days';

COMMENT ON TABLE sync_metrics IS 'RETENCIÓN: Considerar archivar métricas > 90 días';
COMMENT ON TABLE sync_conflicts IS 'RETENCIÓN: Considerar archivar conflictos resueltos > 30 días';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
