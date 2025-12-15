# 🚀 Ejecutar Migraciones en Supabase

## Opción 1: Usar el archivo completo (Más rápido) ⚡

### Paso 1: Abrir SQL Editor en Supabase

1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. En el menú izquierdo, haz clic en **SQL Editor**
4. Haz clic en **New query**

### Paso 2: Copiar y ejecutar el SQL

1. Abre el archivo: `apps/api/src/database/migrations/001_initial_schema.sql`
2. Copia **todo** el contenido (Ctrl+A, Ctrl+C)
3. Pega el contenido en el SQL Editor de Supabase (Ctrl+V)
4. Haz clic en **Run** (o presiona Ctrl+Enter)

### Paso 3: Verificar

Deberías ver un mensaje de éxito. Verifica que las tablas se crearon:

En Supabase, ve a **Table Editor** y deberías ver estas tablas:
- ✅ stores
- ✅ profiles
- ✅ store_members
- ✅ events
- ✅ products
- ✅ inventory_movements
- ✅ cash_sessions
- ✅ sales
- ✅ sale_items
- ✅ customers
- ✅ debts
- ✅ debt_payments

---

## Opción 2: Ejecutar migraciones individuales (Si prefieres más control)

Si prefieres ejecutar cada migración por separado, ejecuta en este orden:

1. `01_stores_and_users.sql`
2. `02_events.sql`
3. `03_products.sql`
4. `04_inventory.sql`
5. `05_cash_sessions.sql`
6. `06_sales.sql`
7. `07_customers_and_debts.sql`

Cada una en una nueva query en el SQL Editor de Supabase.

---

## ⚠️ Si ya ejecutaste las migraciones antes

Si intentas ejecutar las migraciones dos veces, verás errores como "relation already exists". Esto es normal. Si quieres empezar de nuevo:

1. Ve a **Database** → **Tables**
2. Elimina todas las tablas manualmente, O
3. Usa el comando DROP en el SQL Editor (con cuidado)

---

## ✅ Después de ejecutar las migraciones

Una vez que las migraciones estén ejecutadas:

1. **Verifica** que el backend esté conectado correctamente
2. **Prueba** el endpoint `/health` del backend
3. **Continúa** con el desarrollo

¡Listo! 🎉
