# Guía Rápida - Migraciones de Analytics

## 🚀 Opciones de Migración

Tienes **3 opciones** dependiendo de tu entorno:

### Opción 1: Con TimescaleDB (Recomendado) ⚡

**Para:** PostgreSQL local, DigitalOcean, AWS RDS, Timescale Cloud

```sql
-- 1. Instalar TimescaleDB (requiere superusuario)
\i apps/api/src/database/migrations/29_install_timescaledb.sql

-- 2. Crear hypertables
\i apps/api/src/database/migrations/30_timescale_hypertables.sql

-- 3. Crear vistas materializadas
\i apps/api/src/database/migrations/31_materialized_views.sql

-- 4. Crear índices optimizados
\i apps/api/src/database/migrations/32_analytics_indexes.sql
```

**Resultado:** Máximo rendimiento (10-100x más rápido)

---

### Opción 2: Sin TimescaleDB (Alternativa) 📊

**Para:** Supabase, Render estándar, o cualquier PostgreSQL sin TimescaleDB

```sql
-- 1. Saltar migración 29 y 30
-- Usar versión alternativa sin hypertables:
\i apps/api/src/database/migrations/30_timescale_hypertables_optional.sql

-- 2. Crear vistas materializadas (funciona sin TimescaleDB)
\i apps/api/src/database/migrations/31_materialized_views.sql

-- 3. Crear índices optimizados
\i apps/api/src/database/migrations/32_analytics_indexes.sql
```

**Resultado:** Buen rendimiento (5-10x más rápido, sin optimizaciones de hypertables)

---

### Opción 3: Solo Índices y Vistas (Mínimo) 🔍

**Para:** Si no puedes instalar nada o quieres mejoras mínimas

```sql
-- Saltar migraciones 29 y 30
-- Solo ejecutar:
\i apps/api/src/database/migrations/31_materialized_views.sql
\i apps/api/src/database/migrations/32_analytics_indexes.sql
```

**Resultado:** Mejoras moderadas (2-5x más rápido)

---

## ⚠️ Errores Comunes

### Error: "TimescaleDB extension no está instalada"

**Solución:**
1. Si tienes acceso de superusuario:
   ```sql
   CREATE EXTENSION IF NOT EXISTS timescaledb;
   ```

2. Si NO tienes acceso (servicio cloud):
   - Usa `30_timescale_hypertables_optional.sql` en lugar de `30_timescale_hypertables.sql`
   - O salta las migraciones 29 y 30, ejecuta solo 31 y 32

### Error: "insufficient_privilege"

**Solución:**
- Necesitas permisos de superusuario para instalar TimescaleDB
- Contacta al administrador de la base de datos
- O usa la Opción 2 (sin TimescaleDB)

### Error: "undefined_file" o "extension not found"

**Solución:**
- TimescaleDB no está instalado en el servidor PostgreSQL
- Instala TimescaleDB primero (ver `INSTALACION_TIMESCALEDB.md`)
- O usa la Opción 2 (sin TimescaleDB)

---

## 📋 Checklist de Migración

- [ ] Verificar versión de PostgreSQL (14+ recomendado)
- [ ] Hacer backup de la base de datos
- [ ] Verificar si TimescaleDB está disponible
- [ ] Elegir opción de migración (1, 2 o 3)
- [ ] Ejecutar migraciones en orden
- [ ] Verificar que no hay errores
- [ ] Probar queries de analytics

---

## 🔍 Verificar Instalación

```sql
-- Verificar TimescaleDB
SELECT * FROM pg_extension WHERE extname = 'timescaledb';

-- Verificar hypertables (si usaste TimescaleDB)
SELECT * FROM timescaledb_information.hypertables;

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
```

---

## 📚 Documentación Adicional

- **Instalación de TimescaleDB:** `docs/analytics/INSTALACION_TIMESCALEDB.md`
- **Mejoras Detalladas:** `docs/analytics/MEJORAS_PRIORITARIAS_DATA.md`
- **Resumen Ejecutivo:** `docs/analytics/RESUMEN_EJECUTIVO_MEJORAS.md`

---

## 💡 Recomendación

**Si no estás seguro qué opción usar:**

1. Intenta la **Opción 1** primero (con TimescaleDB)
2. Si falla, usa la **Opción 2** (sin TimescaleDB)
3. Como último recurso, usa la **Opción 3** (solo índices y vistas)

Todas las opciones mejorarán el rendimiento, solo que en diferentes grados.

