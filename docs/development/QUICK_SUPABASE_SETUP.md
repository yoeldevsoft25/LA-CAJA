# 🚀 Configuración Rápida con Supabase

## Paso 1: Crear Proyecto en Supabase

1. Ve a https://supabase.com
2. Crea una cuenta (gratis)
3. Crea un nuevo proyecto:
   - Nombre: `la-caja-dev`
   - Región: La más cercana a ti
   - Contraseña: Anota esta contraseña, la necesitarás

## Paso 2: Obtener Connection String

1. En tu proyecto de Supabase, ve a **Settings** → **Database**
2. Busca la sección **Connection string**
3. Copia la **URI connection string** (la que tiene `postgresql://`)
4. Reemplaza `[YOUR-PASSWORD]` con la contraseña que creaste

Ejemplo:
```
postgresql://postgres:[TU_CONTRASEÑA]@db.xxxxx.supabase.co:5432/postgres
```

## Paso 3: Configurar .env

Edita `apps/api/.env` y actualiza `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres:TU_CONTRASEÑA@db.xxxxx.supabase.co:5432/postgres
JWT_SECRET=tu-secret-key-super-seguro-minimo-32-caracteres
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

## Paso 4: Ejecutar Migraciones

1. En Supabase, ve a **SQL Editor**
2. Crea una nueva query
3. Copia y ejecuta el contenido de: `apps/api/src/database/migrations/001_initial_schema.sql`

O ejecuta cada migración individualmente:
- `01_stores_and_users.sql`
- `02_events.sql`
- `03_products.sql`
- `04_inventory.sql`
- `05_cash_sessions.sql`
- `06_sales.sql`
- `07_customers_and_debts.sql`

## Paso 5: Probar Conexión

```powershell
cd C:\Users\Yoel-PC\Documents\GitHub\LA-CAJA
npm run dev:api
```

Deberías ver:
```
[Nest] ... LOG [InstanceLoader] TypeOrmModule dependencies initialized
```

✅ ¡Listo! Tu backend debería conectarse a Supabase sin problemas.
