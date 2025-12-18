# Guía de Migración para Supabase

## ⚠️ Importante: Supabase NO soporta TimescaleDB

Supabase usa PostgreSQL estándar y **no incluye TimescaleDB**. Sin embargo, puedes aplicar las optimizaciones de analytics usando las versiones alternativas de las migraciones.

## 🚀 Pasos para Migrar en Supabase

### Opción 1: Script Simplificado (Recomendado)

```sql
-- 1. Saltar migración 29 (TimescaleDB no disponible)
-- Ejecutar directamente:

-- 2. Usar versión alternativa sin hypertables
\i apps/api/src/database/migrations/30_timescale_hypertables_optional.sql

-- 3. Crear vistas materializadas (funciona sin TimescaleDB)
\i apps/api/src/database/migrations/31_materialized_views.sql

-- 4. Crear índices optimizados
\i apps/api/src/database/migrations/32_analytics_indexes.sql
```

### Opción 2: Script Específico para Supabase

```sql
-- 1. Ejecutar script de skip (opcional, solo informa)
\i apps/api/src/database/migrations/29_skip_timescaledb_supabase.sql

-- 2. Continuar con las demás migraciones
\i apps/api/src/database/migrations/30_timescale_hypertables_optional.sql
\i apps/api/src/database/migrations/31_materialized_views.sql
\i apps/api/src/database/migrations/32_analytics_indexes.sql
```

## 📋 Orden de Ejecución en Supabase

1. ✅ **Saltar:** `29_install_timescaledb.sql` (no funciona en Supabase)
2. ✅ **Usar:** `30_timescale_hypertables_optional.sql` (NO `30_timescale_hypertables.sql`)
3. ✅ **Ejecutar:** `31_materialized_views.sql`
4. ✅ **Ejecutar:** `32_analytics_indexes.sql`

## 🎯 Resultados Esperados

Aunque no tengas TimescaleDB, obtendrás:

- ✅ **Índices BRIN** optimizados para queries de tiempo
- ✅ **Vistas materializadas** pre-agregadas
- ✅ **Índices compuestos** para queries comunes
- ✅ **Mejora de 5-10x** en rendimiento de queries

## ⚠️ Limitaciones en Supabase

- ❌ No hay hypertables (particionamiento automático)
- ❌ No hay compresión automática de datos antiguos
- ❌ No hay continuous aggregates de TimescaleDB
- ✅ Pero sí tienes todas las demás optimizaciones

## 🔍 Verificar Migración

Después de ejecutar las migraciones, verifica:

```sql
-- Verificar vistas materializadas
SELECT schemaname, matviewname 
FROM pg_matviews 
WHERE matviewname LIKE 'mv_%';

-- Verificar índices nuevos
SELECT indexname, tablename 
FROM pg_indexes 
WHERE indexname LIKE 'idx_%' 
  AND schemaname = 'public'
ORDER BY tablename, indexname;

-- Verificar que TimescaleDB NO está instalado (normal en Supabase)
SELECT * FROM pg_extension WHERE extname = 'timescaledb';
-- Debe retornar 0 filas
```

## 💡 Alternativas Futuras

Si necesitas TimescaleDB en el futuro:

1. **Migrar a DigitalOcean Managed Database** (soporta TimescaleDB)
2. **Usar Timescale Cloud** (servicio separado)
3. **AWS RDS con TimescaleDB** (disponible como extensión)
4. **PostgreSQL self-hosted** con TimescaleDB instalado

## 📚 Referencias

- [Supabase Extensions](https://supabase.com/docs/guides/database/extensions)
- [TimescaleDB Alternatives](docs/analytics/INSTALACION_TIMESCALEDB.md)

