-- Migración 30 (Alternativa): Optimizaciones sin TimescaleDB
-- Usa este script si TimescaleDB NO está disponible en tu entorno
-- Este script crea particiones manuales y optimizaciones básicas

-- NOTA: Este script es una alternativa a 30_timescale_hypertables.sql
-- Si TimescaleDB está disponible, usa 30_timescale_hypertables.sql en su lugar

-- 1. Verificar si TimescaleDB está disponible
DO $$
DECLARE
  has_timescaledb BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
  ) INTO has_timescaledb;
  
  IF has_timescaledb THEN
    RAISE NOTICE 'TimescaleDB está disponible. Considera usar 30_timescale_hypertables.sql en su lugar.';
  ELSE
    RAISE NOTICE 'TimescaleDB no está disponible. Usando optimizaciones alternativas.';
  END IF;
END $$;

-- 2. Crear índices optimizados para queries de tiempo (sin hypertables)
-- Estos índices mejoran significativamente las queries de rangos de tiempo

-- Índices para events por tiempo
-- BRIN es eficiente para datos ordenados por tiempo (sin predicado WHERE con NOW())
CREATE INDEX IF NOT EXISTS idx_events_created_at_brin 
  ON events USING BRIN(created_at);

CREATE INDEX IF NOT EXISTS idx_events_store_created_btree 
  ON events(store_id, created_at DESC);

-- Índices para sales por tiempo
-- BRIN es eficiente para datos ordenados por tiempo
-- NOTA: La tabla sales no tiene columna 'status', todas las ventas están completadas
CREATE INDEX IF NOT EXISTS idx_sales_sold_at_brin 
  ON sales USING BRIN(sold_at);

CREATE INDEX IF NOT EXISTS idx_sales_store_sold_at_btree 
  ON sales(store_id, sold_at DESC);

-- Índices para inventory_movements por tiempo
CREATE INDEX IF NOT EXISTS idx_inventory_movements_happened_at_brin 
  ON inventory_movements USING BRIN(happened_at);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_store_happened_btree 
  ON inventory_movements(store_id, happened_at DESC);

-- 3. Comentarios
COMMENT ON INDEX idx_events_created_at_brin IS 
  'Índice BRIN para queries de eventos. BRIN es muy eficiente para datos ordenados por tiempo (time-series).';

COMMENT ON INDEX idx_sales_sold_at_brin IS 
  'Índice BRIN para queries de ventas. BRIN es muy eficiente para datos ordenados por tiempo.';

COMMENT ON INDEX idx_inventory_movements_happened_at_brin IS 
  'Índice BRIN para queries de movimientos de inventario. BRIN es muy eficiente para datos ordenados por tiempo.';

-- 4. Función para limpiar datos antiguos (opcional)
-- Descomentar si necesitas limpiar datos antiguos automáticamente
/*
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS void AS $$
BEGIN
  -- Eliminar eventos de más de 2 años
  DELETE FROM events 
  WHERE created_at < NOW() - INTERVAL '2 years';
  
  RAISE NOTICE 'Eventos antiguos eliminados';
END;
$$ LANGUAGE plpgsql;
*/

-- 5. Nota sobre particionamiento manual
-- Si necesitas particionamiento manual (sin TimescaleDB), puedes crear particiones por rango:
-- CREATE TABLE events_2024_01 PARTITION OF events
--   FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
-- 
-- Esto requiere modificar la estructura de la tabla, así que se deja como referencia.

-- 6. Mensaje final
DO $$
BEGIN
  RAISE NOTICE 'Migración completada: Optimizaciones aplicadas sin TimescaleDB';
  RAISE NOTICE 'Para mejor rendimiento, considera instalar TimescaleDB y usar 30_timescale_hypertables.sql';
END $$;

