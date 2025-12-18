-- Migración 30: TimescaleDB Hypertables
-- Convierte tablas críticas a hypertables para optimización de time-series
-- Requiere: PostgreSQL con extensión TimescaleDB instalada

-- 1. Verificar que TimescaleDB está instalado
-- NOTA: Si TimescaleDB no está disponible, ejecuta primero la migración 29_install_timescaledb.sql
-- O si estás en un servicio cloud sin TimescaleDB, usa 30_timescale_hypertables_optional.sql
DO $$
DECLARE
  timescaledb_installed BOOLEAN;
BEGIN
  -- Verificar si TimescaleDB está instalado
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
  ) INTO timescaledb_installed;
  
  IF NOT timescaledb_installed THEN
    RAISE EXCEPTION 
      'TimescaleDB no está instalado. '
      'Opciones: '
      '1. Ejecuta primero: apps/api/src/database/migrations/29_install_timescaledb.sql '
      '2. O instala manualmente: CREATE EXTENSION IF NOT EXISTS timescaledb; '
      '3. Si TimescaleDB no está disponible en tu entorno, usa: 30_timescale_hypertables_optional.sql '
      'Ver documentación: docs/analytics/INSTALACION_TIMESCALEDB.md';
  ELSE
    RAISE NOTICE 'TimescaleDB está instalado. Versión: %', 
      (SELECT extversion FROM pg_extension WHERE extname = 'timescaledb');
  END IF;
END $$;

-- 2. Convertir events a hypertable (event sourcing)
-- Particionamiento por día para eventos
SELECT create_hypertable(
  'events',
  'created_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

COMMENT ON TABLE events IS 'Hypertable de eventos - Particionado por día para optimización de queries de tiempo';

-- 3. Convertir sales a hypertable
-- Particionamiento por día para ventas
SELECT create_hypertable(
  'sales',
  'sold_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

COMMENT ON TABLE sales IS 'Hypertable de ventas - Particionado por día para analytics rápidas';

-- 4. Convertir inventory_movements a hypertable
SELECT create_hypertable(
  'inventory_movements',
  'happened_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

COMMENT ON TABLE inventory_movements IS 'Hypertable de movimientos de inventario - Particionado por día';

-- 5. Convertir real_time_metrics a hypertable
-- Particionamiento por hora (más granular para métricas)
SELECT create_hypertable(
  'real_time_metrics',
  'created_at',
  chunk_time_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

COMMENT ON TABLE real_time_metrics IS 'Hypertable de métricas en tiempo real - Particionado por hora';

-- 6. Política de compresión para datos antiguos (opcional)
-- Comprimir chunks de más de 30 días
SELECT add_compression_policy(
  'events',
  INTERVAL '30 days',
  if_not_exists => TRUE
);

SELECT add_compression_policy(
  'sales',
  INTERVAL '30 days',
  if_not_exists => TRUE
);

-- 7. Política de retención (opcional - descomentar si se necesita)
-- Mantener eventos por 2 años, luego eliminar
-- SELECT add_retention_policy('events', INTERVAL '2 years', if_not_exists => TRUE);
-- SELECT add_retention_policy('sales', INTERVAL '2 years', if_not_exists => TRUE);

-- 8. Índices adicionales optimizados para hypertables
CREATE INDEX IF NOT EXISTS idx_events_store_type_created_hypertable 
  ON events(store_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_store_date_status_hypertable 
  ON sales(store_id, sold_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_store_product_time 
  ON inventory_movements(store_id, product_id, happened_at DESC);

-- 9. Verificar que las hypertables se crearon correctamente
DO $$
DECLARE
  hypertable_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO hypertable_count
  FROM timescaledb_information.hypertables
  WHERE hypertable_name IN ('events', 'sales', 'inventory_movements', 'real_time_metrics');
  
  IF hypertable_count < 4 THEN
    RAISE WARNING 'No todas las hypertables se crearon correctamente. Verifica los logs.';
  ELSE
    RAISE NOTICE 'Migración completada: % hypertables creadas exitosamente', hypertable_count;
  END IF;
END $$;

