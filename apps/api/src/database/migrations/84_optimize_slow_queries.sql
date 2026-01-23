-- ============================================
-- Migración 84: Optimización de Queries Lentas
-- Fecha: 2026-01-23
-- Descripción: Optimiza queries críticas identificadas en logs de Supabase
-- ============================================

-- ============================================
-- PARTE 1: ÍNDICES PARA warehouse_stock
-- ============================================

-- ⚡ CRÍTICO: Índice funcional para UPDATEs rápidos de warehouse_stock
-- Este índice cubre exactamente la condición WHERE del UPDATE optimizado
-- que usa CASE para manejar variant_id NULL vs no-NULL
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_update_fast 
  ON warehouse_stock(warehouse_id, product_id, variant_id NULLS LAST);

-- Índice parcial adicional para productos sin variantes (caso más común)
-- Esto acelera queries cuando variant_id IS NULL
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_no_variant_fast 
  ON warehouse_stock(warehouse_id, product_id) 
  WHERE variant_id IS NULL;

-- ============================================
-- PARTE 2: ÍNDICES PARA invoice_series
-- ============================================

-- ⚡ CRÍTICO: Índice compuesto optimizado para búsqueda de serie activa
-- Usado en generateNextInvoiceNumber cuando no se especifica seriesId
CREATE INDEX IF NOT EXISTS idx_invoice_series_store_active_created 
  ON invoice_series(store_id, created_at ASC) 
  WHERE is_active = true;

-- ============================================
-- PARTE 3: COMENTARIOS Y VERIFICACIÓN
-- ============================================

COMMENT ON INDEX idx_warehouse_stock_update_fast IS 
  'Índice optimizado para UPDATEs rápidos de warehouse_stock - cubre condición CASE exacta';

COMMENT ON INDEX idx_warehouse_stock_no_variant_fast IS 
  'Índice parcial para productos sin variantes - caso más común en ventas';

COMMENT ON INDEX idx_invoice_series_store_active_created IS 
  'Índice optimizado para obtener primera serie activa ordenada por created_at';

-- ============================================
-- PARTE 4: ÍNDICES PARA events (sync)
-- ============================================

-- ⚡ CRÍTICO: Índice GIN para búsquedas rápidas en payload JSONB
-- Optimiza findEventsForEntity que busca por payload->>'sale_id', etc.
-- Este índice ya debería existir, pero lo verificamos
CREATE INDEX IF NOT EXISTS idx_events_payload_gin 
  ON events USING GIN(payload);

-- Índice compuesto para queries de sync más rápidas
-- Optimiza búsquedas por store_id + type + payload fields
CREATE INDEX IF NOT EXISTS idx_events_store_type_created_fast 
  ON events(store_id, type, created_at DESC);

-- ============================================
-- PARTE 5: COMENTARIOS Y VERIFICACIÓN
-- ============================================

COMMENT ON INDEX idx_events_payload_gin IS 
  'Índice GIN para búsquedas rápidas en campos JSONB del payload (sale_id, product_id, etc.)';

COMMENT ON INDEX idx_events_store_type_created_fast IS 
  'Índice compuesto optimizado para queries de sync por store_id, type y created_at';

-- Verificar que los índices se crearon correctamente
DO $$
DECLARE
  idx_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE indexname IN (
    'idx_warehouse_stock_update_fast',
    'idx_warehouse_stock_no_variant_fast',
    'idx_invoice_series_store_active_created',
    'idx_events_payload_gin',
    'idx_events_store_type_created_fast'
  );
  
  IF idx_count = 5 THEN
    RAISE NOTICE '✅ Todos los índices optimizados se crearon correctamente';
  ELSE
    RAISE WARNING '⚠️ Solo se crearon % de 5 índices esperados', idx_count;
  END IF;
END $$;
