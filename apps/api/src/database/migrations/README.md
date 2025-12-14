# Scripts SQL - Migraciones de Base de Datos

Estos scripts SQL deben ejecutarse **en orden** para crear el esquema completo de la base de datos.

## Orden de Ejecución

### 1. Tiendas y Usuarios
```sql
-- Ejecuta: 01_stores_and_users.sql
```
Crea:
- `stores` - Tiendas
- `profiles` - Perfiles de usuario
- `store_role` - Enum para roles (owner/cashier)
- `store_members` - Relación usuarios-tiendas

### 2. Event Store
```sql
-- Ejecuta: 02_events.sql
```
Crea:
- `events` - Tabla principal del event store (Event Sourcing)

### 3. Productos
```sql
-- Ejecuta: 03_products.sql
```
Crea:
- `products` - Read model de productos

### 4. Inventario
```sql
-- Ejecuta: 04_inventory.sql
```
Crea:
- `inventory_movements` - Movimientos de inventario
- `product_stock` - Vista para stock actual

### 5. Caja
```sql
-- Ejecuta: 05_cash_sessions.sql
```
Crea:
- `cash_sessions` - Sesiones de caja (apertura/cierre)

### 6. Ventas
```sql
-- Ejecuta: 06_sales.sql
```
Crea:
- `sales` - Read model de ventas
- `sale_items` - Ítems de cada venta

### 7. Clientes y Fiao
```sql
-- Ejecuta: 07_customers_and_debts.sql
```
Crea:
- `customers` - Read model de clientes
- `debts` - Deudas (fiao)
- `debt_payments` - Pagos de deudas
- `customer_debt_balance` - Vista para saldos

## Ejecución en pgAdmin

1. Conéctate a tu servidor PostgreSQL
2. Selecciona o crea la base de datos `la_caja`
3. Ejecuta cada script en orden usando el Query Tool (F5)
4. Verifica que no hay errores

## Ejecución desde línea de comandos

```bash
# Windows (PowerShell)
psql -U postgres -d la_caja -f apps/api/src/database/migrations/01_stores_and_users.sql
psql -U postgres -d la_caja -f apps/api/src/database/migrations/02_events.sql
psql -U postgres -d la_caja -f apps/api/src/database/migrations/03_products.sql
psql -U postgres -d la_caja -f apps/api/src/database/migrations/04_inventory.sql
psql -U postgres -d la_caja -f apps/api/src/database/migrations/05_cash_sessions.sql
psql -U postgres -d la_caja -f apps/api/src/database/migrations/06_sales.sql
psql -U postgres -d la_caja -f apps/api/src/database/migrations/07_customers_and_debts.sql
```

## Notas Importantes

- Todos los scripts incluyen comentarios explicativos
- Los índices están optimizados para consultas rápidas
- Las vistas opcionales ayudan con cálculos comunes
- Todos los IDs son UUIDs generados desde eventos (no se usan DEFAULT en la mayoría)
- El event store (`events`) es la fuente de verdad
- Las demás tablas son read models proyectados desde eventos

