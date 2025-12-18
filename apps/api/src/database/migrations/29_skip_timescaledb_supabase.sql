-- Migración 29 (Supabase): Skip TimescaleDB
-- Este script es para Supabase y otros servicios que NO soportan TimescaleDB
-- 
-- ⚠️ IMPORTANTE: Supabase NO soporta TimescaleDB
-- Usa este script si estás en Supabase, luego ejecuta:
-- 30_timescale_hypertables_optional.sql (NO 30_timescale_hypertables.sql)

-- Verificar si TimescaleDB está disponible (no debería estarlo en Supabase)
DO $$
DECLARE
  extension_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') INTO extension_exists;
  
  IF extension_exists THEN
    RAISE NOTICE 'TimescaleDB está disponible. Puedes usar 30_timescale_hypertables.sql';
  ELSE
    RAISE NOTICE 'TimescaleDB NO está disponible (normal en Supabase)';
    RAISE NOTICE 'Usa 30_timescale_hypertables_optional.sql para optimizaciones alternativas';
    RAISE NOTICE 'Las migraciones 31 y 32 funcionarán correctamente sin TimescaleDB';
  END IF;
END $$;

-- Este script no hace nada más, solo informa
-- Las optimizaciones se aplicarán en las siguientes migraciones

