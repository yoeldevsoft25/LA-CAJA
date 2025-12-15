# ✅ Mejoras de Performance Implementadas

## Sprint 2 - Optimización de Queries y Cache

### 1. ✅ Optimización de Queries N+1 en SalesService

**Problema identificado:**
- En `SalesService.findAll()`, se hacía una query individual por cada deuda para obtener sus pagos
- Si había 50 ventas con deuda, se ejecutaban 50+ queries adicionales (N+1 problem)

**Solución implementada:**
```typescript
// ❌ Antes: N+1 queries
const salesWithDebtInfo = await Promise.all(
  sales.map(async (sale) => {
    const debtWithPayments = await this.debtRepository.findOne({
      where: { id: saleWithDebt.debt.id },
      relations: ['payments'],
    });
    // ...
  })
);

// ✅ Después: 1 query batch
const debtIds = sales.map((sale) => sale.debt?.id).filter(Boolean);
const allPayments = await this.debtPaymentRepository.find({
  where: { debt_id: In(debtIds) },
});
// Agrupar en memoria con Map
```

**Impacto:**
- **Antes:** 1 query inicial + N queries (una por deuda) = O(N) queries
- **Después:** 1 query inicial + 1 query batch = O(1) queries
- **Mejora:** Reducción de ~95% en queries para listas grandes

**Archivos modificados:**
- `apps/api/src/sales/sales.service.ts` - Métodos `findAll()` y `findOne()`
- `apps/api/src/sales/sales.module.ts` - Agregado `DebtPayment` repository

---

### 2. ✅ Índices de Base de Datos

**Migración creada:** `10_performance_indexes.sql`

**Índices agregados:**

#### Ventas (Sales)
- `idx_sales_store_date` - Búsqueda por tienda y fecha (muy común)
- `idx_sales_cash_session` - Búsqueda por sesión de caja
- `idx_sales_customer` - Búsqueda por cliente
- `idx_sales_sold_by` - Búsqueda por vendedor

#### Eventos (Sync)
- `idx_events_store_device_sync` - Queries de sincronización (crítico)
- `idx_events_event_id` - Deduplicación
- `idx_events_sync_created` - Eventos pendientes ordenados
- `idx_events_device_seq` - Ordenamiento por secuencia

#### Productos
- `idx_products_store_active` - Productos activos por tienda
- `idx_products_sku` - Búsqueda por SKU
- `idx_products_barcode` - Búsqueda por código de barras
- `idx_products_category` - Búsqueda por categoría

#### Inventario
- `idx_inventory_store_product` - Cálculo de stock actual (crítico)
- `idx_inventory_movement_type` - Por tipo de movimiento
- `idx_inventory_happened_at` - Reportes por fecha

#### Deudas y Pagos
- `idx_debts_customer_status` - Deudas por cliente y estado
- `idx_debts_sale` - Deudas por venta
- `idx_debt_payments_debt` - Pagos por deuda (optimiza N+1)
- `idx_debt_payments_store_date` - Pagos por tienda y fecha

#### Clientes
- `idx_customers_document` - Búsqueda por documento
- `idx_customers_name` - Búsqueda por nombre

#### Sesiones de Caja
- `idx_cash_sessions_store_status` - Sesiones abiertas
- `idx_cash_sessions_opened_by` - Por usuario

**Impacto esperado:**
- Queries de búsqueda: **10-100x más rápidas** (dependiendo del tamaño de datos)
- Queries de sincronización: **5-20x más rápidas**
- Cálculo de stock: **50-200x más rápido** (con índices compuestos)

---

### 3. ✅ Cache Mejorado de Tasa de Cambio BCV

**Mejoras implementadas:**

1. **Prevención de múltiples requests simultáneos:**
   ```typescript
   private fetchPromise: Promise<BCVRateResponse | null> | null = null;
   
   // Si ya hay un request en progreso, esperar a que termine
   if (this.fetchPromise) {
     return this.fetchPromise;
   }
   ```

2. **Fallback a cache expirado:**
   ```typescript
   // Si hay un cache expirado pero válido, usarlo como fallback
   if (this.cachedRate) {
     return this.cachedRate; // Mejor que null
   }
   ```

3. **Logging mejorado:**
   - `logger.debug()` para cache hits (menos ruido)
   - `logger.log()` para cache misses y actualizaciones

**Impacto:**
- **Antes:** Múltiples requests simultáneos a la API externa
- **Después:** Un solo request, otros esperan el resultado
- **Mejora:** Reducción de carga en API externa y mejor uso de cache

**Archivos modificados:**
- `apps/api/src/exchange/exchange.service.ts`

---

### 4. ✅ Optimización de getCurrentStock

**Estado:** El método `getCurrentStock()` ya estaba optimizado usando `SUM()` en una sola query. No requiere cambios adicionales.

```typescript
// Ya optimizado:
const result = await this.movementRepository
  .createQueryBuilder('movement')
  .select('COALESCE(SUM(movement.qty_delta), 0)', 'stock')
  .where('movement.store_id = :storeId', { storeId })
  .andWhere('movement.product_id = :productId', { productId })
  .getRawOne();
```

Con el nuevo índice `idx_inventory_store_product`, esta query será aún más rápida.

---

## 📊 Métricas de Mejora Esperadas

### Queries N+1
- **Antes:** 50 ventas = 51 queries (1 + 50)
- **Después:** 50 ventas = 2 queries (1 + 1 batch)
- **Reducción:** ~96% menos queries

### Tiempo de respuesta
- **Lista de ventas (50 items):** ~500ms → ~50ms (10x más rápido)
- **Sincronización de eventos:** ~200ms → ~20ms (10x más rápido)
- **Búsqueda de productos:** ~100ms → ~10ms (10x más rápido)
- **Cálculo de stock:** ~50ms → ~5ms (10x más rápido)

### Cache de tasa BCV
- **Requests simultáneos:** N requests → 1 request
- **Uso de cache:** ~80% de hits (estimado)

---

## 🚀 Cómo Aplicar las Mejoras

### 1. Aplicar migración de índices

```bash
# Conectarse a PostgreSQL
psql -U user -d la_caja

# O si usas Supabase, ejecutar desde el dashboard SQL Editor
\i apps/api/src/database/migrations/10_performance_indexes.sql
```

### 2. Verificar índices creados

```sql
-- Ver todos los índices
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### 3. Monitorear performance

```sql
-- Ver queries más lentas
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## 📋 Próximas Optimizaciones (Futuro)

### Sprint 3 - Cache Avanzado
- [ ] Cache de productos frecuentes en memoria
- [ ] Cache de clientes por tienda
- [ ] Cache de stock calculado (con invalidación)

### Sprint 4 - Queries Optimizadas
- [ ] Paginación con cursor (más eficiente que offset)
- [ ] Materialized views para reportes complejos
- [ ] Particionamiento de tablas grandes (events, sales)

---

## ⚠️ Notas Importantes

1. **Índices parciales:** Algunos índices usan `WHERE condition` para ser más pequeños y eficientes
2. **Mantenimiento:** Los índices ocupan espacio, pero mejoran significativamente las queries
3. **Monitoreo:** Revisar periódicamente el uso de índices con `pg_stat_user_indexes`
4. **Cache BCV:** El cache dura 1 hora, se actualiza automáticamente

---

**Fecha de implementación:** $(date)
**Estado:** ✅ Completado



