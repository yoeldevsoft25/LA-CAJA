-- Migración 29: Instalación de TimescaleDB
-- Este script intenta instalar la extensión TimescaleDB si no está instalada
-- REQUIERE: Permisos de superusuario (postgres)

-- ⚠️ IMPORTANTE: Supabase NO soporta TimescaleDB
-- Si estás usando Supabase, salta esta migración y usa:
-- 30_timescale_hypertables_optional.sql en lugar de 30_timescale_hypertables.sql
--
-- Las migraciones 31 (vistas materializadas) y 32 (índices) funcionan sin TimescaleDB.

-- Verificar si TimescaleDB ya está instalado
DO $$
DECLARE
  extension_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') INTO extension_exists;
  
  IF extension_exists THEN
    RAISE NOTICE 'TimescaleDB ya está instalado. Versión: %', 
      (SELECT extversion FROM pg_extension WHERE extname = 'timescaledb');
  ELSE
    RAISE NOTICE 'TimescaleDB no está instalado. Intentando instalar...';
  END IF;
END $$;

-- Intentar instalar TimescaleDB
-- NOTA: Esto puede fallar si:
-- 1. No tienes permisos de superusuario
-- 2. TimescaleDB no está disponible en el servidor (como en Supabase)
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS timescaledb;
    RAISE NOTICE 'TimescaleDB instalado exitosamente';
  EXCEPTION 
    WHEN OTHERS THEN
      -- No lanzar excepción, solo advertir
      RAISE WARNING 'No se pudo instalar TimescaleDB: %', SQLERRM;
      RAISE WARNING 'Si estás en Supabase, esto es normal. Usa 30_timescale_hypertables_optional.sql';
  END;
END $$;

-- Verificar instalación
DO $$
DECLARE
  extension_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') INTO extension_exists;
  
  IF extension_exists THEN
    RAISE NOTICE '✅ TimescaleDB instalado correctamente';
    RAISE NOTICE 'Versión: %', (SELECT extversion FROM pg_extension WHERE extname = 'timescaledb');
  ELSE
    RAISE WARNING '⚠️ TimescaleDB NO se pudo instalar';
    RAISE WARNING 'Si estás en Supabase o Render estándar, esto es normal.';
    RAISE WARNING 'Usa 30_timescale_hypertables_optional.sql en lugar de 30_timescale_hypertables.sql';
  END IF;
END $$;

-- Mostrar información de la extensión si está instalada
SELECT 
  extname as extension_name,
  extversion as version,
  CASE 
    WHEN extname = 'timescaledb' THEN 'TimescaleDB instalado correctamente'
    ELSE 'TimescaleDB no está disponible'
  END as status
FROM pg_extension 
WHERE extname = 'timescaledb';

