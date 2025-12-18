-- Migración 31: Vistas Materializadas para Analytics
-- Crea vistas materializadas pre-agregadas para queries rápidas

-- 1. Vista materializada de ventas diarias
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_sales_daily AS
SELECT 
  store_id,
  DATE(sold_at) as sale_date,
  COUNT(*) as sales_count,
  SUM((totals->>'total_bs')::numeric) as total_bs,
  SUM((totals->>'total_usd')::numeric) as total_usd,
  AVG((totals->>'total_bs')::numeric) as avg_ticket_bs,
  AVG((totals->>'total_usd')::numeric) as avg_ticket_usd,
  COUNT(DISTINCT customer_id) FILTER (WHERE customer_id IS NOT NULL) as unique_customers,
  -- Agregación por método de pago (simplificada)
  COUNT(*) FILTER (WHERE payment->>'method' = 'cash') as cash_count,
  COUNT(*) FILTER (WHERE payment->>'method' = 'card') as card_count,
  COUNT(*) FILTER (WHERE payment->>'method' = 'transfer') as transfer_count,
  SUM((totals->>'total_bs')::numeric) FILTER (WHERE payment->>'method' = 'cash') as cash_amount_bs,
  SUM((totals->>'total_bs')::numeric) FILTER (WHERE payment->>'method' = 'card') as card_amount_bs,
  SUM((totals->>'total_usd')::numeric) FILTER (WHERE payment->>'method' = 'cash') as cash_amount_usd,
  SUM((totals->>'total_usd')::numeric) FILTER (WHERE payment->>'method' = 'card') as card_amount_usd
FROM sales
GROUP BY store_id, DATE(sold_at);

-- Índice único para búsquedas rápidas
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_sales_daily_unique 
  ON mv_sales_daily(store_id, sale_date);

-- Índice para queries por rango de fechas
CREATE INDEX IF NOT EXISTS idx_mv_sales_daily_date 
  ON mv_sales_daily(sale_date DESC);

COMMENT ON MATERIALIZED VIEW mv_sales_daily IS 'Agregación diaria de ventas para queries rápidas de reportes';

-- 2. Vista materializada de productos más vendidos (últimos 30 días)
-- NOTA: sale_items NO tiene store_id, se obtiene de sales
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_products_30d AS
SELECT 
  si.product_id,
  p.name as product_name,
  p.category,
  s.store_id,
  SUM(si.qty) as total_qty_sold,
  SUM(si.unit_price_bs * si.qty) as revenue_bs,
  SUM(si.unit_price_usd * si.qty) as revenue_usd,
  COUNT(DISTINCT si.sale_id) as times_sold,
  AVG(si.unit_price_bs) as avg_price_bs,
  AVG(si.unit_price_usd) as avg_price_usd
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
JOIN products p ON si.product_id = p.id
WHERE s.sold_at >= NOW() - INTERVAL '30 days'
GROUP BY si.product_id, p.name, p.category, s.store_id;

-- Índices para búsquedas y ordenamiento
CREATE INDEX IF NOT EXISTS idx_mv_top_products_store_qty 
  ON mv_top_products_30d(store_id, total_qty_sold DESC);

CREATE INDEX IF NOT EXISTS idx_mv_top_products_store_revenue 
  ON mv_top_products_30d(store_id, revenue_bs DESC);

CREATE INDEX IF NOT EXISTS idx_mv_top_products_category 
  ON mv_top_products_30d(store_id, category, total_qty_sold DESC);

COMMENT ON MATERIALIZED VIEW mv_top_products_30d IS 'Top productos vendidos en los últimos 30 días';

-- 3. Vista materializada de métricas de inventario
-- NOTA: current_stock se calcula desde inventory_movements (no existe como columna en products)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_inventory_metrics AS
SELECT 
  p.store_id,
  COUNT(*) FILTER (WHERE p.is_active = true) as total_products,
  COUNT(*) FILTER (
    WHERE COALESCE(stock.current_stock, 0) <= p.low_stock_threshold 
      AND p.low_stock_threshold > 0 
      AND p.is_active = true
  ) as low_stock_count,
  COUNT(*) FILTER (
    WHERE COALESCE(stock.current_stock, 0) = 0 
      AND p.is_active = true
  ) as out_of_stock_count,
  SUM(COALESCE(stock.current_stock, 0) * p.cost_bs) FILTER (WHERE p.is_active = true) as total_stock_value_bs,
  SUM(COALESCE(stock.current_stock, 0) * p.cost_usd) FILTER (WHERE p.is_active = true) as total_stock_value_usd,
  AVG(COALESCE(stock.current_stock, 0)) FILTER (WHERE p.is_active = true) as avg_stock_level,
  COUNT(DISTINCT p.category) FILTER (WHERE p.is_active = true) as categories_count
FROM products p
LEFT JOIN LATERAL (
  SELECT SUM(qty_delta) as current_stock
  FROM inventory_movements
  WHERE product_id = p.id AND store_id = p.store_id
) stock ON true
GROUP BY p.store_id;

-- Índice único por store
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_inventory_metrics_store 
  ON mv_inventory_metrics(store_id);

COMMENT ON MATERIALIZED VIEW mv_inventory_metrics IS 'Métricas agregadas de inventario por tienda';

-- 4. Vista materializada de métricas de clientes
-- NOTA: debts tiene amount_bs/amount_usd (no total_amount_bs/total_amount_usd)
-- NOTA: debts.status es 'open' | 'partial' | 'paid' (no 'pending')
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_customer_metrics AS
SELECT 
  c.store_id,
  COUNT(DISTINCT c.id) as total_customers,
  COUNT(DISTINCT c.id) FILTER (WHERE EXISTS (
    SELECT 1 FROM debts d 
    WHERE d.customer_id = c.id 
    AND d.status IN ('open', 'partial')
  )) as customers_with_debt,
  SUM(COALESCE(d.amount_bs, 0)) FILTER (WHERE d.status IN ('open', 'partial')) as total_debt_bs,
  SUM(COALESCE(d.amount_usd, 0)) FILTER (WHERE d.status IN ('open', 'partial')) as total_debt_usd,
  COUNT(DISTINCT s.customer_id) FILTER (
    WHERE s.sold_at >= NOW() - INTERVAL '30 days'
  ) as active_customers_30d
FROM customers c
LEFT JOIN debts d ON c.id = d.customer_id AND d.status IN ('open', 'partial')
LEFT JOIN sales s ON c.id = s.customer_id
GROUP BY c.store_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_customer_metrics_store 
  ON mv_customer_metrics(store_id);

COMMENT ON MATERIALIZED VIEW mv_customer_metrics IS 'Métricas agregadas de clientes por tienda';

-- 5. Función para refrescar todas las vistas materializadas
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  -- Refrescar vistas (CONCURRENTLY para no bloquear lecturas)
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_daily;
    RAISE NOTICE 'Vista mv_sales_daily refrescada exitosamente';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error refrescando mv_sales_daily: %', SQLERRM;
  END;
  
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_products_30d;
    RAISE NOTICE 'Vista mv_top_products_30d refrescada exitosamente';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error refrescando mv_top_products_30d: %', SQLERRM;
  END;
  
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_metrics;
    RAISE NOTICE 'Vista mv_inventory_metrics refrescada exitosamente';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error refrescando mv_inventory_metrics: %', SQLERRM;
  END;
  
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_metrics;
    RAISE NOTICE 'Vista mv_customer_metrics refrescada exitosamente';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error refrescando mv_customer_metrics: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql;

-- 6. Función para refrescar vista específica de forma incremental
CREATE OR REPLACE FUNCTION refresh_sales_daily_incremental(store_id_param UUID, sale_date DATE)
RETURNS void AS $$
BEGIN
  -- Eliminar registro existente para el día/tienda
  DELETE FROM mv_sales_daily 
  WHERE store_id = store_id_param AND sale_date = sale_date;
  
  -- Recalcular e insertar
  INSERT INTO mv_sales_daily
  SELECT 
    store_id,
    DATE(sold_at) as sale_date,
    COUNT(*) as sales_count,
    SUM((totals->>'total_bs')::numeric) as total_bs,
    SUM((totals->>'total_usd')::numeric) as total_usd,
    AVG((totals->>'total_bs')::numeric) as avg_ticket_bs,
    AVG((totals->>'total_usd')::numeric) as avg_ticket_usd,
    COUNT(DISTINCT customer_id) FILTER (WHERE customer_id IS NOT NULL) as unique_customers,
    COUNT(*) FILTER (WHERE payment->>'method' = 'cash') as cash_count,
    COUNT(*) FILTER (WHERE payment->>'method' = 'card') as card_count,
    COUNT(*) FILTER (WHERE payment->>'method' = 'transfer') as transfer_count,
    SUM((totals->>'total_bs')::numeric) FILTER (WHERE payment->>'method' = 'cash') as cash_amount_bs,
    SUM((totals->>'total_bs')::numeric) FILTER (WHERE payment->>'method' = 'card') as card_amount_bs,
    SUM((totals->>'total_usd')::numeric) FILTER (WHERE payment->>'method' = 'cash') as cash_amount_usd,
    SUM((totals->>'total_usd')::numeric) FILTER (WHERE payment->>'method' = 'card') as card_amount_usd
  FROM sales
  WHERE store_id = store_id_param
    AND DATE(sold_at) = sale_date
  GROUP BY store_id, DATE(sold_at);
END;
$$ LANGUAGE plpgsql;

-- 7. Poblar vistas iniciales
-- NOTA: Esto puede tardar si hay muchos datos. Ejecutar fuera de horas pico.
-- REFRESH MATERIALIZED VIEW mv_sales_daily;
-- REFRESH MATERIALIZED VIEW mv_top_products_30d;
-- REFRESH MATERIALIZED VIEW mv_inventory_metrics;
-- REFRESH MATERIALIZED VIEW mv_customer_metrics;

COMMENT ON FUNCTION refresh_analytics_views() IS 'Refresca todas las vistas materializadas de analytics';
COMMENT ON FUNCTION refresh_sales_daily_incremental(UUID, DATE) IS 'Refresca incrementalmente la vista de ventas diarias para un día específico';

