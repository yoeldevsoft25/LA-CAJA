# Instalación de TimescaleDB

## ⚠️ Requisito Previo

La migración 30 (`30_timescale_hypertables.sql`) requiere que TimescaleDB esté instalado en PostgreSQL.

## 🔧 Opciones de Instalación

### Opción 1: PostgreSQL Local (Desarrollo)

#### macOS (Homebrew)
```bash
# Instalar PostgreSQL con TimescaleDB
brew install timescaledb

# O si ya tienes PostgreSQL instalado:
brew install timescaledb

# Configurar PostgreSQL para cargar TimescaleDB
timescaledb-tune --quiet --yes
```

#### Linux (Ubuntu/Debian)
```bash
# Agregar repositorio de TimescaleDB
sudo sh -c "echo 'deb https://packagecloud.io/timescale/timescaledb/ubuntu/ $(lsb_release -c -s) main' > /etc/apt/sources.list.d/timescaledb.list"
wget --quiet -O - https://packagecloud.io/timescale/timescaledb/gpgkey | sudo apt-key add -
sudo apt-get update

# Instalar TimescaleDB
sudo apt-get install timescaledb-2-postgresql-14  # Ajusta la versión según tu PostgreSQL

# Configurar PostgreSQL
sudo timescaledb-tune --quiet --yes
sudo systemctl restart postgresql
```

#### Windows
1. Descargar TimescaleDB desde: https://docs.timescale.com/install/latest/self-hosted/
2. Ejecutar el instalador
3. Reiniciar PostgreSQL

### Opción 2: Instalación Manual en PostgreSQL

Si tienes acceso como superusuario:

```sql
-- Conectarse como superusuario (postgres)
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

### Opción 3: Servicios Cloud

#### Supabase
- TimescaleDB **NO está disponible** en Supabase estándar
- Opciones:
  1. Usar Supabase Pro (si está disponible)
  2. Usar PostgreSQL estándar sin hypertables (las migraciones funcionarán pero sin optimización)
  3. Migrar a otro proveedor que soporte TimescaleDB

#### Render
- TimescaleDB **NO está disponible** en Render PostgreSQL estándar
- Opciones:
  1. Usar Timescale Cloud (servicio separado de TimescaleDB)
  2. Usar PostgreSQL estándar sin hypertables

#### Railway
- TimescaleDB puede estar disponible dependiendo del plan
- Verificar en la documentación de Railway

#### DigitalOcean
- TimescaleDB está disponible en Managed Databases
- Seleccionar "TimescaleDB" al crear la base de datos

#### AWS RDS
- TimescaleDB está disponible como extensión en RDS PostgreSQL
- Habilitar en configuración de parámetros

## ✅ Verificar Instalación

Después de instalar, verifica que TimescaleDB está disponible:

```sql
-- Verificar extensión
SELECT * FROM pg_extension WHERE extname = 'timescaledb';

-- Ver versión
SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';
```

## 🚀 Ejecutar Migración

Una vez instalado TimescaleDB:

```sql
-- Ejecutar migración 30
\i apps/api/src/database/migrations/30_timescale_hypertables.sql
```

O desde línea de comandos:

```bash
psql -U postgres -d la_caja -f apps/api/src/database/migrations/30_timescale_hypertables.sql
```

## ⚠️ Si TimescaleDB No Está Disponible

Si estás usando un servicio cloud que no soporta TimescaleDB (como Supabase o Render estándar):

1. **Opción A:** Saltar la migración 30 y usar solo las migraciones 31 y 32
   - Las vistas materializadas (31) y índices (32) funcionarán sin TimescaleDB
   - Perderás las optimizaciones de hypertables pero tendrás mejoras significativas

2. **Opción B:** Usar PostgreSQL estándar con particionamiento manual
   - Crear particiones manuales por rango de tiempo
   - Más trabajo pero similar funcionalidad

3. **Opción C:** Migrar a un proveedor que soporte TimescaleDB
   - DigitalOcean Managed Databases
   - AWS RDS con TimescaleDB
   - Timescale Cloud

## 📝 Notas Importantes

- TimescaleDB requiere permisos de superusuario para instalarse
- En servicios cloud, verifica si TimescaleDB está disponible antes de migrar
- Las migraciones 31 y 32 (vistas materializadas e índices) funcionan sin TimescaleDB
- TimescaleDB es una extensión de PostgreSQL, no un servicio separado

## 🔗 Referencias

- [Documentación Oficial de TimescaleDB](https://docs.timescale.com/)
- [Guía de Instalación](https://docs.timescale.com/install/latest/)
- [TimescaleDB en Cloud](https://www.timescale.com/cloud)

