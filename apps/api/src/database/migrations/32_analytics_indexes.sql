-- Migración 32: Índices Optimizados para Analytics
-- Crea índices adicionales específicos para queries de analytics

-- 1. Índices compuestos para queries de ventas por rango de tiempo
-- NOTA: La tabla sales no tiene columna 'status', todas las ventas están completadas
CREATE INDEX IF NOT EXISTS idx_sales_store_date_status 
  ON sales(store_id, sold_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_store_customer_date 
  ON sales(store_id, customer_id, sold_at DESC) 
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_store_date_currency 
  ON sales(store_id, sold_at DESC, currency);

-- 2. Índices GIN para búsquedas en campos JSONB
-- Permite búsquedas rápidas dentro de objetos JSON
CREATE INDEX IF NOT EXISTS idx_sales_totals_gin 
  ON sales USING GIN(totals);

CREATE INDEX IF NOT EXISTS idx_sales_payment_gin 
  ON sales USING GIN(payment);

-- 3. Índice para sale_items con INCLUDE para evitar lookups adicionales
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_product 
  ON sale_items(sale_id, product_id) 
  INCLUDE (qty, unit_price_bs, unit_price_usd, discount_bs, discount_usd);

-- Índice para queries de productos más vendidos
CREATE INDEX IF NOT EXISTS idx_sale_items_product_qty 
  ON sale_items(product_id, qty DESC);

-- 4. Índices para eventos por tipo y tiempo (event sourcing)
CREATE INDEX IF NOT EXISTS idx_events_store_type_created 
  ON events(store_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_store_device_seq 
  ON events(store_id, device_id, seq DESC);

-- Índice GIN para búsquedas en payload JSONB de eventos
CREATE INDEX IF NOT EXISTS idx_events_payload_gin 
  ON events USING GIN(payload);

-- 5. Índices parciales para productos activos
-- NOTA: current_stock NO existe como columna en products (se calcula desde inventory_movements)
-- No se puede crear índice parcial basado en stock calculado, solo en columnas existentes
CREATE INDEX IF NOT EXISTS idx_products_active_category 
  ON products(store_id, category, name)
  WHERE is_active = true;

-- Índice para productos con umbral de stock bajo configurado (útil para queries de alertas)
CREATE INDEX IF NOT EXISTS idx_products_low_stock_threshold 
  ON products(store_id, low_stock_threshold)
  WHERE is_active = true 
    AND low_stock_threshold > 0;

-- 6. Índices para heatmap queries
CREATE INDEX IF NOT EXISTS idx_sales_heatmap_store_date_hour 
  ON sales_heatmap(store_id, date DESC, hour) 
  WHERE sales_count > 0;

CREATE INDEX IF NOT EXISTS idx_sales_heatmap_store_day_hour 
  ON sales_heatmap(store_id, day_of_week, hour);

-- 7. Índices para métricas en tiempo real
CREATE INDEX IF NOT EXISTS idx_realtime_metrics_store_name_created 
  ON real_time_metrics(store_id, metric_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_realtime_metrics_store_type_period 
  ON real_time_metrics(store_id, metric_type, period_type, period_start DESC);

-- 8. Índices para movimientos de inventario
CREATE INDEX IF NOT EXISTS idx_inventory_movements_store_product_time 
  ON inventory_movements(store_id, product_id, happened_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_store_type_time 
  ON inventory_movements(store_id, movement_type, happened_at DESC);

-- 9. Índices para deudas (FIAO)
-- NOTA: debts NO tiene columna due_date, solo created_at
-- NOTA: debts.status es 'open' | 'partial' | 'paid' (no 'pending')
CREATE INDEX IF NOT EXISTS idx_debts_store_customer_status 
  ON debts(store_id, customer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_debts_store_status_open 
  ON debts(store_id, status, created_at DESC)
  WHERE status IN ('open', 'partial');

-- 10. Índices para órdenes de compra
CREATE INDEX IF NOT EXISTS idx_purchase_orders_store_status_date 
  ON purchase_orders(store_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_store_supplier 
  ON purchase_orders(store_id, supplier_id, created_at DESC);

-- 11. Índices para facturas fiscales
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_store_date 
  ON fiscal_invoices(store_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_store_number 
  ON fiscal_invoices(store_id, invoice_number);

-- 12. Índices para métricas comparativas
CREATE INDEX IF NOT EXISTS idx_comparative_metrics_store_type_period 
  ON comparative_metrics(store_id, metric_type, current_period_start DESC);

-- 13. Análisis de tablas para optimizar el planificador de queries
ANALYZE sales;
ANALYZE sale_items;
ANALYZE events;
ANALYZE products;
ANALYZE inventory_movements;
ANALYZE real_time_metrics;

-- Comentarios
COMMENT ON INDEX idx_sales_store_date_status IS 'Optimiza queries de ventas por rango de tiempo';
COMMENT ON INDEX idx_sales_totals_gin IS 'Índice GIN para búsquedas rápidas en campo JSONB totals';
COMMENT ON INDEX idx_products_low_stock_threshold IS 'Índice para productos con umbral de stock bajo configurado';
COMMENT ON INDEX idx_sale_items_sale_product IS 'Índice con INCLUDE para evitar lookups adicionales en queries de items';

