# Optimizaciones Críticas para Queries Lentas Detectadas

## Análisis de Queries Lentas (pg_stat_statements)

### Problemas Críticos Identificados

1. **InvoiceSeries FOR UPDATE** - 51,956ms promedio (52 segundos!)
   - Máximo: 119,895ms (2 minutos!)
   - 67.8% del tiempo total de queries
   - **CRÍTICO**: Bloquea todas las ventas en cola

2. **UPDATE warehouse_stock** - 444ms promedio
   - Máximo: 108,870ms (108 segundos!)
   - 4.18% del tiempo total
   - **ALTO**: Bloquea actualizaciones de stock

3. **InvoiceSeries individual FOR UPDATE** - 742ms promedio
   - Máximo: 70,380ms (70 segundos!)
   - 5.07% del tiempo total

## Soluciones Propuestas

### 1. Optimizar InvoiceSeries usando PostgreSQL Sequence (CRÍTICO)

**Problema Actual:**
- Usa `pessimistic_write` lock que bloquea la fila durante toda la transacción
- Múltiples ventas esperan en cola para obtener número de factura
- 52 segundos promedio es inaceptable

**Solución (Práctica 2025-2026):**
Usar PostgreSQL SEQUENCE nativo en lugar de locks pesimistas. Las sequences son atómicas y no bloquean.

```sql
-- Crear sequence por serie
CREATE SEQUENCE IF NOT EXISTS invoice_series_A_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_series_B_seq START 1;
-- etc.

-- O mejor: sequence dinámico basado en serie_id
```

**Alternativa más simple (sin cambiar schema):**
Usar `SELECT FOR UPDATE NOWAIT` o `SKIP LOCKED` para evitar bloqueos largos.

### 2. Optimizar UPDATE warehouse_stock

**Problema Actual:**
- UPDATE directo sin índice optimizado para la condición WHERE
- Puede estar causando table scans

**Solución:**
- Agregar índice único compuesto para la condición WHERE exacta
- Usar UPDATE con RETURNING para evitar query adicional
- Considerar mover actualización fuera de transacción crítica (usar eventos)

### 3. Índices Faltantes Críticos

- Índice único en `warehouse_stock(warehouse_id, product_id, variant_id)` para UPDATEs rápidos
- Índice en `invoice_series(store_id, is_active)` para búsqueda rápida

## Implementación Prioritaria

### P0 (URGENTE - Implementar Ahora)
1. Optimizar InvoiceSeries usando NOWAIT o sequence
2. Agregar índice único en warehouse_stock
3. Optimizar UPDATE warehouse_stock

### P1 (Esta Semana)
4. Mover actualización de warehouse_stock a evento asíncrono
5. Cachear series activas para evitar queries repetidas
