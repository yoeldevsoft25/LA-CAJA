# Estructura de Tablas - Referencia para Analytics

**Última actualización:** 2024  
**Propósito:** Documentación de referencia de la estructura real de tablas para evitar errores en migraciones

---

## 📊 Tabla: `sales` (Ventas)

### Columnas Principales
```sql
id UUID PRIMARY KEY
store_id UUID NOT NULL
cash_session_id UUID NULL
sold_at TIMESTAMPTZ NOT NULL
exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 0
currency VARCHAR(20) NOT NULL CHECK (currency IN ('BS', 'USD', 'MIXED'))
totals JSONB NOT NULL  -- {subtotal_bs, subtotal_usd, discount_bs, discount_usd, total_bs, total_usd}
payment JSONB NOT NULL  -- {method, split?, cash_payment?, cash_payment_bs?}
customer_id UUID NULL
sold_by_user_id UUID NULL  -- Agregado en migración 09
invoice_series_id UUID NULL  -- Agregado en migración 20
invoice_number VARCHAR(50) NULL  -- Agregado en migración 20
invoice_full_number VARCHAR(100) NULL  -- Agregado en migración 20
note TEXT NULL
created_at TIMESTAMPTZ DEFAULT NOW()
```

### ⚠️ IMPORTANTE
- **NO tiene columna `status`** - Todas las ventas en esta tabla están completadas
- Si una venta está en `sales`, significa que se completó exitosamente
- No usar filtros `WHERE status = 'completed'` en índices o queries

### Índices Existentes
- `idx_sales_store_id` - store_id
- `idx_sales_sold_at` - sold_at DESC
- `idx_sales_cash_session_id` - cash_session_id (WHERE cash_session_id IS NOT NULL)
- `idx_sales_customer_id` - customer_id (WHERE customer_id IS NOT NULL)
- `idx_sales_sold_by_user_id` - sold_by_user_id (WHERE sold_by_user_id IS NOT NULL)
- `idx_sales_invoice_series` - invoice_series_id (WHERE invoice_series_id IS NOT NULL)
- `idx_sales_invoice_number` - invoice_full_number (WHERE invoice_full_number IS NOT NULL)
- `idx_sales_store_invoice` - (store_id, invoice_full_number) (WHERE invoice_full_number IS NOT NULL)

---

## 📦 Tabla: `sale_items` (Items de Venta)

### Columnas
```sql
id UUID PRIMARY KEY
sale_id UUID NOT NULL REFERENCES sales(id)
product_id UUID NOT NULL REFERENCES products(id)
qty INTEGER NOT NULL CHECK (qty > 0)
unit_price_bs NUMERIC(18, 2) NOT NULL DEFAULT 0
unit_price_usd NUMERIC(18, 2) NOT NULL DEFAULT 0
discount_bs NUMERIC(18, 2) NOT NULL DEFAULT 0
discount_usd NUMERIC(18, 2) NOT NULL DEFAULT 0
created_at TIMESTAMPTZ DEFAULT NOW()
```

### Índices Existentes
- `idx_sale_items_sale_id` - sale_id
- `idx_sale_items_product_id` - product_id

---

## 📝 Tabla: `events` (Event Store)

### Columnas
```sql
event_id UUID PRIMARY KEY  -- Generado en cliente, NO DEFAULT
store_id UUID NOT NULL
device_id UUID NOT NULL
seq BIGINT NOT NULL
type TEXT NOT NULL  -- SaleCreated, ProductCreated, etc.
version INT NOT NULL
created_at TIMESTAMPTZ NOT NULL  -- Timestamp del cliente
actor_user_id UUID NULL
actor_role TEXT NULL
payload JSONB NOT NULL
received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- Timestamp del servidor
```

### Índices Existentes
- `idx_events_store_seq` - (store_id, seq)
- `idx_events_store_type` - (store_id, type)
- `idx_events_store_created` - (store_id, created_at)
- `idx_events_device` - device_id

### ⚠️ IMPORTANTE
- Usar `created_at` para queries de tiempo (timestamp del evento)
- `received_at` es cuando el servidor recibió el evento (puede diferir en offline-first)

---

## 📦 Tabla: `inventory_movements` (Movimientos de Inventario)

### Columnas
```sql
id UUID PRIMARY KEY
store_id UUID NOT NULL
product_id UUID NOT NULL
variant_id UUID NULL  -- Para variantes de producto
movement_type VARCHAR(20) NOT NULL  -- 'received' | 'adjust' | 'sold'
qty_delta INT NOT NULL  -- Positivo=entrada, Negativo=salida
approved BOOLEAN NOT NULL DEFAULT true  -- Agregado en migración 12
requested_by UUID NULL  -- Agregado en migración 12
approved_by UUID NULL  -- Agregado en migración 12
approved_at TIMESTAMPTZ NULL  -- Agregado en migración 12
unit_cost_bs NUMERIC(18, 2) NOT NULL DEFAULT 0
unit_cost_usd NUMERIC(18, 2) NOT NULL DEFAULT 0
note TEXT NULL
ref JSONB NULL  -- Referencias adicionales
warehouse_id UUID NULL  -- Agregado para soporte de múltiples almacenes
happened_at TIMESTAMPTZ NOT NULL
```

### Índices Existentes
- `idx_inv_mov_store_product` - (store_id, product_id)
- `idx_inv_mov_store_happened` - (store_id, happened_at)
- `idx_inv_mov_product_type` - (product_id, movement_type)
- `idx_inventory_movements_approved` - approved
- Índice en `warehouse_id` (definido en entidad)

---

## 🏪 Tabla: `products` (Productos)

### Columnas Principales
```sql
id UUID PRIMARY KEY
store_id UUID NOT NULL
name TEXT NOT NULL
category TEXT NULL
sku TEXT NULL
barcode TEXT NULL
price_bs NUMERIC(18, 2) NOT NULL DEFAULT 0
price_usd NUMERIC(18, 2) NOT NULL DEFAULT 0
cost_bs NUMERIC(18, 2) NOT NULL DEFAULT 0
cost_usd NUMERIC(18, 2) NOT NULL DEFAULT 0
low_stock_threshold INT NOT NULL DEFAULT 0
is_active BOOLEAN NOT NULL DEFAULT true
is_weight_product BOOLEAN NOT NULL DEFAULT false
weight_unit VARCHAR(10) NULL  -- 'kg' | 'g' | 'lb' | 'oz'
price_per_weight_bs NUMERIC(18, 2) NULL
price_per_weight_usd NUMERIC(18, 2) NULL
min_weight NUMERIC(10, 3) NULL
max_weight NUMERIC(10, 3) NULL
scale_plu VARCHAR(50) NULL
scale_department INT NULL
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### ⚠️ IMPORTANTE
- **NO tiene columna `current_stock`** - El stock se calcula desde `inventory_movements`
- Usar la vista `product_stock` o calcular con `SUM(qty_delta)` de `inventory_movements`

### Índices Existentes
- `idx_products_store_name` - (store_id, name)
- `idx_products_store_category` - (store_id, category)
- `idx_products_store_active` - (store_id, is_active)
- `idx_products_barcode` - barcode (WHERE barcode IS NOT NULL)

---

## 📊 Tabla: `real_time_metrics` (Métricas en Tiempo Real)

### Columnas
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
store_id UUID NOT NULL
metric_type VARCHAR(50) NOT NULL  -- 'revenue' | 'sales' | 'inventory' | etc.
metric_name VARCHAR(100) NOT NULL  -- 'daily_revenue_bs', 'low_stock_products_count', etc.
metric_value NUMERIC(18, 6) NOT NULL
previous_value NUMERIC(18, 6) NULL
change_percentage NUMERIC(5, 2) NULL
period_type VARCHAR(20) NOT NULL DEFAULT 'current'  -- 'current' | 'hour' | 'day' | 'week' | 'month'
period_start TIMESTAMPTZ NOT NULL
period_end TIMESTAMPTZ NOT NULL
metadata JSONB NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### Índices Existentes
- `idx_realtime_metrics_store` - store_id
- `idx_realtime_metrics_type` - metric_type
- `idx_realtime_metrics_period` - (period_start, period_end)
- `idx_realtime_metrics_created` - created_at DESC

---

## 🔍 Reglas Generales para Índices y Queries

### ✅ HACER
- Usar `sold_at` para queries de tiempo en `sales`
- Usar `created_at` para queries de tiempo en `events`
- Usar `happened_at` para queries de tiempo en `inventory_movements`
- Filtrar por `store_id` siempre que sea posible (multi-tenant)
- Usar índices parciales con `WHERE column IS NOT NULL` cuando sea apropiado

### ❌ NO HACER
- **NO usar `status = 'completed'` en `sales`** - No existe esa columna
- **NO usar `current_stock` en `products`** - Se calcula desde `inventory_movements`
- **NO usar `NOW()` en predicados de índices** - No es IMMUTABLE
- **NO asumir columnas sin verificar** - Siempre revisar entidades/migraciones

---

## 📚 Referencias

- Entidades TypeORM: `apps/api/src/database/entities/`
- Migraciones SQL: `apps/api/src/database/migrations/`
- Orden de migraciones: Ver `apps/api/src/database/migrations/README.md`

---

## 🔄 Historial de Cambios en Tablas

### `sales`
- Migración 06: Creación inicial
- Migración 09: Agregado `sold_by_user_id`
- Migración 20: Agregado `invoice_series_id`, `invoice_number`, `invoice_full_number`

### `inventory_movements`
- Migración 04: Creación inicial
- Migración 12: Agregado `approved`, `requested_by`, `approved_by`, `approved_at`
- Migración 25: Agregado `warehouse_id`, `variant_id` (para variantes y almacenes)

### `products`
- Migración 03: Creación inicial
- Varias migraciones: Agregado soporte para productos por peso, variantes, lotes, etc.

---

**Nota:** Este documento debe actualizarse cuando se agreguen nuevas columnas o tablas relacionadas con analytics.

