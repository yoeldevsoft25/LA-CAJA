# 🔌 Conectar pgAdmin4 a Supabase

## Paso 1: Obtener información de conexión desde Supabase

1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto `la-caja-dev`
3. Ve a **Settings** → **Database**
4. En la sección **Connection string**, encontrarás:
   - **Host:** `db.xxxxx.supabase.co` (el host de "Connection string" sin pooler)
   - **Database:** `postgres`
   - **Port:** `5432`
   - **User:** `postgres`
   - **Password:** La contraseña que configuraste al crear el proyecto

## Paso 2: Crear conexión en pgAdmin4

1. Abre pgAdmin4
2. En el panel izquierdo, haz clic derecho en **Servers** → **Create** → **Server...**
3. En la pestaña **General:**
   - **Name:** `Supabase - LA CAJA`
4. En la pestaña **Connection:**
   - **Host name/address:** `db.xxxxx.supabase.co` (tu host de Supabase)
   - **Port:** `5432`
   - **Maintenance database:** `postgres`
   - **Username:** `postgres`
   - **Password:** (tu contraseña de Supabase - puedes guardarla)
5. En la pestaña **SSL:**
   - **SSL mode:** `Require` o `Prefer` (Supabase requiere SSL)
6. Haz clic en **Save**

## Paso 3: Verificar conexión

Si la conexión es exitosa, deberías ver:
- ✅ La conexión aparece en el panel izquierdo
- ✅ Puedes expandirla y ver las bases de datos
- ✅ Puedes ejecutar queries en el SQL Editor

## Paso 4: Ejecutar migraciones

1. En pgAdmin4, expande tu conexión de Supabase
2. Expande **Databases** → **postgres** → **Schemas** → **public**
3. Haz clic derecho en **postgres** → **Query Tool**
4. Abre y ejecuta cada migración SQL desde:
   - `apps/api/src/database/migrations/001_initial_schema.sql`

O ejecuta las migraciones individuales en orden:
1. `01_stores_and_users.sql`
2. `02_events.sql`
3. `03_products.sql`
4. `04_inventory.sql`
5. `05_cash_sessions.sql`
6. `06_sales.sql`
7. `07_customers_and_debts.sql`

## Paso 5: Actualizar .env del backend

Usa el script creado:

```powershell
.\update-env-supabase.ps1 "postgresql://postgres:TU_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
```

O edita manualmente `apps/api/.env`:

```env
DATABASE_URL=postgresql://postgres:TU_PASSWORD@db.xxxxx.supabase.co:5432/postgres
JWT_SECRET=tu-secret-key-super-seguro-minimo-32-caracteres
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

**⚠️ Importante:** Reemplaza:
- `TU_PASSWORD` con tu contraseña real de Supabase
- `xxxxx` con el ID de tu proyecto de Supabase

## Paso 6: Probar conexión del backend

```powershell
cd C:\Users\Yoel-PC\Documents\GitHub\LA-CAJA
npm run dev:api
```

Deberías ver:
```
[Nest] ... LOG [InstanceLoader] TypeOrmModule dependencies initialized
```

✅ ¡Listo! Ahora tienes PostgreSQL funcionando en la nube y puedes usar pgAdmin4 para administrarlo.
