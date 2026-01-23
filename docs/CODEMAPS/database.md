# Database Codemap - LA-CAJA

**Última Actualización:** 2026-01-22  
**Sistema de Base de Datos:** PostgreSQL  
**ORM:** TypeORM  
**Migraciones:** 83+ migraciones SQL

---

## Arquitectura de Datos

### Event Sourcing

```
events (Event Store)
  ↓
Projections Service
  ↓
Read Models (Tablas optimizadas)
```

---

## Tablas Principales

### Autenticación y Tenancy

| Tabla | Propósito | Entidad |
|-------|-----------|---------|
| `stores` | Tiendas | `Store` |
| `profiles` | Perfiles de usuario | `Profile` |
| `store_members` | Relación usuarios-tiendas | `StoreMember` |

### Event Store

| Tabla | Propósito | Entidad |
|-------|-----------|---------|
| `events` | Almacenamiento de eventos | `Event` |

### Read Models (Proyecciones)

#### Productos

| Tabla | Propósito | Entidad |
|-------|-----------|---------|
| `products` | Productos | `Product` |
| `product_variants` | Variantes | `ProductVariant` |
| `product_lots` | Lotes | `ProductLot` |
| `product_serials` | Series | `ProductSerial` |
| `inventory_movements` | Movimientos | `InventoryMovement` |
| `warehouse_stock` | Stock por bodega | `WarehouseStock` |

#### Ventas

| Tabla | Propósito | Entidad |
|-------|-----------|---------|
| `sales` | Ventas | `Sale` |
| `sale_items` | Items de venta | `SaleItem` |
| `sale_returns` | Devoluciones | `SaleReturn` |
| `sale_payments` | Pagos | `SalePayment` |

#### Caja y Turnos

| Tabla | Propósito | Entidad |
|-------|-----------|---------|
| `cash_sessions` | Sesiones de caja | `CashSession` |
| `cash_movements` | Movimientos de caja | `CashMovement` |
| `shifts` | Turnos | `Shift` |
| `shift_cuts` | Cortes de turno | `ShiftCut` |

#### Clientes y Deudas

| Tabla | Propósito | Entidad |
|-------|-----------|---------|
| `customers` | Clientes | `Customer` |
| `debts` | Deudas | `Debt` |
| `debt_payments` | Pagos de deudas | `DebtPayment` |

#### Contabilidad

| Tabla | Propósito | Entidad |
|-------|-----------|---------|
| `chart_of_accounts` | Plan de cuentas | `ChartOfAccount` |
| `journal_entries` | Asientos contables | `JournalEntry` |
| `journal_entry_lines` | Líneas de asiento | `JournalEntryLine` |
| `account_balances` | Balances de cuentas | `AccountBalance` |
| `accounting_periods` | Períodos contables | `AccountingPeriod` |

#### Fiscal

| Tabla | Propósito | Entidad |
|-------|-----------|---------|
| `fiscal_invoices` | Facturas fiscales | `FiscalInvoice` |
| `fiscal_invoice_items` | Items de factura | `FiscalInvoiceItem` |
| `fiscal_configs` | Configuración fiscal | `FiscalConfig` |
| `invoice_series` | Series de facturas | `InvoiceSeries` |

#### Logística

| Tabla | Propósito | Entidad |
|-------|-----------|---------|
| `warehouses` | Bodegas | `Warehouse` |
| `transfers` | Transferencias | `Transfers` |
| `suppliers` | Proveedores | `Supplier` |
| `purchase_orders` | Órdenes de compra | `PurchaseOrder` |

#### Analytics y ML

| Tabla | Propósito | Entidad |
|-------|-----------|---------|
| `demand_predictions` | Predicciones de demanda | `DemandPrediction` |
| `product_recommendations` | Recomendaciones | `ProductRecommendation` |
| `detected_anomalies` | Anomalías detectadas | `DetectedAnomaly` |
| `realtime_metrics` | Métricas en tiempo real | `RealTimeMetric` |

#### Notificaciones

| Tabla | Propósito | Entidad |
|-------|-----------|---------|
| `notifications` | Notificaciones | `Notification` |
| `notification_preferences` | Preferencias | `NotificationPreference` |
| `ml_insights` | Insights ML | `MLInsight` |

---

## Migraciones

**Total:** 83+ migraciones SQL

**Ubicación:** `apps/api/src/database/migrations/`

**Formato:** `NN_description.sql`

**Ejemplos:**
- `01_stores_and_users.sql`
- `02_events.sql`
- `03_products.sql`
- `35_offline_first_world_class.sql`
- `83_final_verification_and_cache_fix.sql`

---

## Vistas Materializadas

Vistas pre-agregadas para analytics:

1. `mv_daily_sales` - Ventas diarias
2. `mv_product_sales` - Ventas por producto
3. `mv_customer_purchases` - Compras por cliente
4. `mv_inventory_turnover` - Rotación de inventario

---

## Índices

### Principales

- `events`: `(store_id, device_id, seq)` - Búsqueda de eventos
- `products`: `(store_id, barcode)`, `(store_id, name)` - Búsqueda de productos
- `sales`: `(store_id, sale_date)`, `(store_id, customer_id)` - Búsqueda de ventas

### Optimizaciones

- Índices BRIN para time-series
- Índices GIN para JSONB
- Índices parciales para queries comunes

---

## Row Level Security (RLS)

Todas las tablas tienen RLS habilitado con políticas que filtran por `store_id` para aislamiento multi-tenant.

---

## Relaciones

### Principales

- `Store` → `StoreMember` → `Profile`
- `Sale` → `SaleItem` → `Product`
- `Sale` → `SalePayment`
- `JournalEntry` → `JournalEntryLine` → `ChartOfAccount`
- `Debt` → `DebtPayment` → `Customer`

---

**Ver también:**
- [Backend Codemap](./backend.md)
- Migraciones en `apps/api/src/database/migrations/`
