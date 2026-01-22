-- Migración 68: Corrección de Seguridad - RLS y Vistas
-- Fecha: 2025-01-XX
-- Descripción: 
--   1. Cambia vistas de SECURITY DEFINER a SECURITY INVOKER
--   2. Habilita RLS en todas las tablas públicas que lo necesitan
--   3. Crea políticas RLS básicas siguiendo el patrón del proyecto
-- Ver: https://supabase.com/docs/guides/database/database-linter

-- ============================================
-- PARTE 1: CORRECCIÓN DE VISTAS (SECURITY DEFINER -> SECURITY INVOKER)
-- ============================================
-- Las vistas con SECURITY DEFINER ejecutan con permisos del creador, no del usuario
-- Esto puede ser un riesgo de seguridad. Cambiamos a SECURITY INVOKER

-- v_pending_conflicts
CREATE OR REPLACE VIEW v_pending_conflicts
WITH (security_invoker = true) AS
SELECT
  sc.id,
  sc.store_id,
  sc.entity_type,
  sc.entity_id,
  sc.conflict_type,
  sc.priority,
  sc.created_at,
  s.name AS store_name,
  EXTRACT(EPOCH FROM (NOW() - sc.created_at)) / 3600 AS hours_pending
FROM sync_conflicts sc
JOIN stores s ON s.id = sc.store_id
WHERE sc.resolution_status = 'pending'
ORDER BY
  CASE sc.priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  sc.created_at ASC;

-- v_store_rates_summary
CREATE OR REPLACE VIEW v_store_rates_summary
WITH (security_invoker = true) AS
SELECT
    s.id AS store_id,
    s.name AS store_name,
    (SELECT rate FROM exchange_rates WHERE store_id = s.id AND rate_type = 'BCV' AND is_active = true ORDER BY is_preferred DESC, effective_from DESC LIMIT 1) AS bcv_rate,
    (SELECT rate FROM exchange_rates WHERE store_id = s.id AND rate_type = 'PARALLEL' AND is_active = true ORDER BY is_preferred DESC, effective_from DESC LIMIT 1) AS parallel_rate,
    (SELECT rate FROM exchange_rates WHERE store_id = s.id AND rate_type = 'CASH' AND is_active = true ORDER BY is_preferred DESC, effective_from DESC LIMIT 1) AS cash_rate,
    (SELECT rate FROM exchange_rates WHERE store_id = s.id AND rate_type = 'ZELLE' AND is_active = true ORDER BY is_preferred DESC, effective_from DESC LIMIT 1) AS zelle_rate,
    (SELECT effective_from FROM exchange_rates WHERE store_id = s.id AND rate_type = 'BCV' AND is_active = true ORDER BY is_preferred DESC, effective_from DESC LIMIT 1) AS bcv_updated_at
FROM stores s;

-- ml_insights_summary
CREATE OR REPLACE VIEW ml_insights_summary
WITH (security_invoker = true) AS
SELECT
  store_id,
  insight_type,
  insight_category,
  severity,
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_insights,
  COUNT(*) FILTER (WHERE notification_sent = true) as notifications_sent,
  COUNT(*) FILTER (WHERE is_actionable = true) as actionable_insights,
  COUNT(*) FILTER (WHERE is_resolved = true) as resolved_insights,
  AVG(confidence_score) as avg_confidence,
  AVG(priority) as avg_priority
FROM ml_insights
GROUP BY store_id, insight_type, insight_category, severity, DATE_TRUNC('day', created_at);

-- v_unhealthy_devices
CREATE OR REPLACE VIEW v_unhealthy_devices
WITH (security_invoker = true) AS
SELECT
  dss.store_id,
  dss.device_id,
  dss.health_status,
  dss.circuit_breaker_state,
  dss.pending_conflicts_count,
  dss.last_synced_at,
  dss.last_sync_error,
  s.name AS store_name
FROM device_sync_state dss
JOIN stores s ON s.id = dss.store_id
WHERE dss.health_status IN ('degraded', 'critical')
   OR dss.circuit_breaker_state != 'CLOSED'
   OR dss.pending_conflicts_count > 0
ORDER BY dss.health_status DESC, dss.pending_conflicts_count DESC;

-- notification_engagement_metrics
CREATE OR REPLACE VIEW notification_engagement_metrics
WITH (security_invoker = true) AS
SELECT
  n.store_id,
  n.notification_type,
  n.category,
  n.priority,
  DATE_TRUNC('day', n.created_at) as date,
  COUNT(DISTINCT n.id) as total_sent,
  COUNT(DISTINCT na.id) FILTER (WHERE na.opened_at IS NOT NULL) as total_opened,
  COUNT(DISTINCT na.id) FILTER (WHERE na.clicked_at IS NOT NULL) as total_clicked,
  COUNT(DISTINCT na.id) FILTER (WHERE na.action_taken IS NOT NULL) as total_actions,
  ROUND(
    COUNT(DISTINCT na.id) FILTER (WHERE na.opened_at IS NOT NULL)::NUMERIC /
    NULLIF(COUNT(DISTINCT n.id), 0) * 100,
    2
  ) as open_rate,
  ROUND(
    COUNT(DISTINCT na.id) FILTER (WHERE na.clicked_at IS NOT NULL)::NUMERIC /
    NULLIF(COUNT(DISTINCT n.id), 0) * 100,
    2
  ) as click_rate,
  AVG(na.time_to_open_seconds) FILTER (WHERE na.time_to_open_seconds IS NOT NULL) as avg_time_to_open,
  AVG(na.time_to_action_seconds) FILTER (WHERE na.time_to_action_seconds IS NOT NULL) as avg_time_to_action
FROM notifications n
LEFT JOIN notification_analytics na ON n.id = na.notification_id
GROUP BY n.store_id, n.notification_type, n.category, n.priority, DATE_TRUNC('day', n.created_at);

-- v_sales_with_payments
CREATE OR REPLACE VIEW v_sales_with_payments
WITH (security_invoker = true) AS
SELECT
    s.id AS sale_id,
    s.store_id,
    s.sold_at,
    s.exchange_rate AS sale_rate,
    (s.totals->>'total_usd')::NUMERIC AS total_usd,
    (s.totals->>'total_bs')::NUMERIC AS total_bs,
    COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
            'method', sp.method,
            'amount_usd', from_cents(sp.amount_cents_usd),
            'amount_bs', from_cents(sp.amount_cents_bs),
            'rate_type', sp.rate_type,
            'applied_rate', sp.applied_rate,
            'reference', sp.reference
        ) ORDER BY sp.payment_order)
        FROM sale_payments sp
        WHERE sp.sale_id = s.id AND sp.status = 'CONFIRMED'),
        '[]'::JSONB
    ) AS payments,
    (SELECT COUNT(*) FROM sale_payments WHERE sale_id = s.id AND status = 'CONFIRMED') AS payment_count,
    CASE
        WHEN (SELECT COUNT(*) FROM sale_payments WHERE sale_id = s.id AND status = 'CONFIRMED') > 1 THEN 'SPLIT'
        ELSE COALESCE((SELECT method FROM sale_payments WHERE sale_id = s.id AND status = 'CONFIRMED' LIMIT 1), s.payment->>'method')
    END AS payment_type
FROM sales s;

-- v_sync_stats_by_store
CREATE OR REPLACE VIEW v_sync_stats_by_store
WITH (security_invoker = true) AS
SELECT
  s.id AS store_id,
  s.name AS store_name,
  COUNT(DISTINCT dss.device_id) AS total_devices,
  COUNT(DISTINCT dss.device_id) FILTER (WHERE dss.health_status = 'healthy') AS healthy_devices,
  COUNT(DISTINCT dss.device_id) FILTER (WHERE dss.health_status = 'degraded') AS degraded_devices,
  COUNT(DISTINCT dss.device_id) FILTER (WHERE dss.health_status = 'critical') AS critical_devices,
  SUM(dss.pending_conflicts_count) AS total_pending_conflicts,
  MAX(dss.last_synced_at) AS most_recent_sync,
  AVG(dss.avg_sync_duration_ms) AS avg_sync_duration_ms,
  SUM(dss.total_events_synced) AS total_events_synced,
  SUM(dss.total_bytes_synced) AS total_bytes_synced
FROM stores s
LEFT JOIN device_sync_state dss ON dss.store_id = s.id
GROUP BY s.id, s.name
ORDER BY total_pending_conflicts DESC;

-- product_stock
CREATE OR REPLACE VIEW product_stock
WITH (security_invoker = true) AS
SELECT 
  store_id,
  product_id,
  SUM(qty_delta) AS current_stock
FROM inventory_movements
GROUP BY store_id, product_id;

-- customer_debt_balance
CREATE OR REPLACE VIEW customer_debt_balance
WITH (security_invoker = true) AS
SELECT 
  d.store_id,
  d.customer_id,
  d.id AS debt_id,
  d.amount_bs AS debt_amount_bs,
  d.amount_usd AS debt_amount_usd,
  COALESCE(SUM(dp.amount_bs), 0) AS paid_amount_bs,
  COALESCE(SUM(dp.amount_usd), 0) AS paid_amount_usd,
  (d.amount_bs - COALESCE(SUM(dp.amount_bs), 0)) AS balance_bs,
  (d.amount_usd - COALESCE(SUM(dp.amount_usd), 0)) AS balance_usd
FROM debts d
LEFT JOIN debt_payments dp ON dp.debt_id = d.id
WHERE d.status IN ('open', 'partial')
GROUP BY d.id, d.store_id, d.customer_id, d.amount_bs, d.amount_usd;

-- ============================================
-- PARTE 2: HABILITAR RLS EN TABLAS PÚBLICAS
-- ============================================
-- Patrón: Usuarios solo pueden acceder a datos de tiendas donde son miembros
-- Usamos (select auth.uid()) para mejor performance

-- Tablas principales con store_id
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_method_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fast_checkout_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE peripheral_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_model_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_time_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_time_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_heatmap ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparative_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_account_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_erp_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_payment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_payment_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_factor_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE uptime_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_resolution_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_recovery_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_cuts ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_price_list_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PARTE 3: POLÍTICAS RLS PARA TABLAS CON store_id
-- ============================================
-- Patrón estándar: Usuarios solo pueden acceder a datos de sus tiendas

-- stores: Solo pueden ver tiendas donde son miembros
DROP POLICY IF EXISTS "Users can view their stores" ON stores;
CREATE POLICY "Users can view their stores" ON stores
    FOR SELECT USING (
        id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- store_members: Solo pueden ver miembros de sus tiendas
DROP POLICY IF EXISTS "Users can view store members" ON store_members;
CREATE POLICY "Users can view store members" ON store_members
    FOR SELECT USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- products: Solo pueden acceder a productos de sus tiendas
DROP POLICY IF EXISTS "Users can manage products" ON products;
CREATE POLICY "Users can manage products" ON products
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- customers: Solo pueden acceder a clientes de sus tiendas
DROP POLICY IF EXISTS "Users can manage customers" ON customers;
CREATE POLICY "Users can manage customers" ON customers
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- sales: Solo pueden acceder a ventas de sus tiendas
DROP POLICY IF EXISTS "Users can manage sales" ON sales;
CREATE POLICY "Users can manage sales" ON sales
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- sale_items: Solo pueden acceder a items de ventas de sus tiendas
DROP POLICY IF EXISTS "Users can manage sale items" ON sale_items;
CREATE POLICY "Users can manage sale items" ON sale_items
    FOR ALL USING (
        sale_id IN (
            SELECT s.id FROM sales s
            JOIN store_members sm ON sm.store_id = s.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- debts: Solo pueden acceder a deudas de sus tiendas
DROP POLICY IF EXISTS "Users can manage debts" ON debts;
CREATE POLICY "Users can manage debts" ON debts
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- debt_payments: Solo pueden acceder a pagos de deudas de sus tiendas
DROP POLICY IF EXISTS "Users can manage debt payments" ON debt_payments;
CREATE POLICY "Users can manage debt payments" ON debt_payments
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- cash_sessions: Solo pueden acceder a sesiones de caja de sus tiendas
DROP POLICY IF EXISTS "Users can manage cash sessions" ON cash_sessions;
CREATE POLICY "Users can manage cash sessions" ON cash_sessions
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- inventory_movements: Solo pueden acceder a movimientos de inventario de sus tiendas
DROP POLICY IF EXISTS "Users can manage inventory movements" ON inventory_movements;
CREATE POLICY "Users can manage inventory movements" ON inventory_movements
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- cash_movements: Solo pueden acceder a movimientos de caja de sus tiendas
DROP POLICY IF EXISTS "Users can manage cash movements" ON cash_movements;
CREATE POLICY "Users can manage cash movements" ON cash_movements
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- events: Solo pueden acceder a eventos de sus tiendas
DROP POLICY IF EXISTS "Users can view events" ON events;
CREATE POLICY "Users can view events" ON events
    FOR SELECT USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- payment_method_configs: Solo pueden acceder a configuraciones de métodos de pago de sus tiendas
DROP POLICY IF EXISTS "Users can manage payment method configs" ON payment_method_configs;
CREATE POLICY "Users can manage payment method configs" ON payment_method_configs
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- discount_configs: Solo pueden acceder a configuraciones de descuentos de sus tiendas
DROP POLICY IF EXISTS "Users can manage discount configs" ON discount_configs;
CREATE POLICY "Users can manage discount configs" ON discount_configs
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- discount_authorizations: Solo pueden acceder a autorizaciones de descuentos de sus tiendas
DROP POLICY IF EXISTS "Users can manage discount authorizations" ON discount_authorizations;
CREATE POLICY "Users can manage discount authorizations" ON discount_authorizations
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- fast_checkout_configs: Solo pueden acceder a configuraciones de checkout rápido de sus tiendas
DROP POLICY IF EXISTS "Users can manage fast checkout configs" ON fast_checkout_configs;
CREATE POLICY "Users can manage fast checkout configs" ON fast_checkout_configs
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- quick_products: Solo pueden acceder a productos rápidos de sus tiendas
DROP POLICY IF EXISTS "Users can manage quick products" ON quick_products;
CREATE POLICY "Users can manage quick products" ON quick_products
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- product_variants: Solo pueden acceder a variantes de productos de sus tiendas
DROP POLICY IF EXISTS "Users can manage product variants" ON product_variants;
CREATE POLICY "Users can manage product variants" ON product_variants
    FOR ALL USING (
        product_id IN (
            SELECT p.id FROM products p
            JOIN store_members sm ON sm.store_id = p.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- product_lots: Solo pueden acceder a lotes de productos de sus tiendas
DROP POLICY IF EXISTS "Users can manage product lots" ON product_lots;
CREATE POLICY "Users can manage product lots" ON product_lots
    FOR ALL USING (
        product_id IN (
            SELECT p.id FROM products p
            JOIN store_members sm ON sm.store_id = p.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- lot_movements: Solo pueden acceder a movimientos de lotes de sus tiendas
DROP POLICY IF EXISTS "Users can manage lot movements" ON lot_movements;
CREATE POLICY "Users can manage lot movements" ON lot_movements
    FOR ALL USING (
        lot_id IN (
            SELECT pl.id FROM product_lots pl
            JOIN products p ON p.id = pl.product_id
            JOIN store_members sm ON sm.store_id = p.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- product_serials: Solo pueden acceder a seriales de productos de sus tiendas
DROP POLICY IF EXISTS "Users can manage product serials" ON product_serials;
CREATE POLICY "Users can manage product serials" ON product_serials
    FOR ALL USING (
        product_id IN (
            SELECT p.id FROM products p
            JOIN store_members sm ON sm.store_id = p.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- invoice_series: Solo pueden acceder a series de facturas de sus tiendas
DROP POLICY IF EXISTS "Users can manage invoice series" ON invoice_series;
CREATE POLICY "Users can manage invoice series" ON invoice_series
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- orders: Solo pueden acceder a órdenes de sus tiendas
DROP POLICY IF EXISTS "Users can manage orders" ON orders;
CREATE POLICY "Users can manage orders" ON orders
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- order_items: Solo pueden acceder a items de órdenes de sus tiendas
DROP POLICY IF EXISTS "Users can manage order items" ON order_items;
CREATE POLICY "Users can manage order items" ON order_items
    FOR ALL USING (
        order_id IN (
            SELECT o.id FROM orders o
            JOIN store_members sm ON sm.store_id = o.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- order_payments: Solo pueden acceder a pagos de órdenes de sus tiendas
DROP POLICY IF EXISTS "Users can manage order payments" ON order_payments;
CREATE POLICY "Users can manage order payments" ON order_payments
    FOR ALL USING (
        order_id IN (
            SELECT o.id FROM orders o
            JOIN store_members sm ON sm.store_id = o.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- peripheral_configs: Solo pueden acceder a configuraciones de periféricos de sus tiendas
DROP POLICY IF EXISTS "Users can manage peripheral configs" ON peripheral_configs;
CREATE POLICY "Users can manage peripheral configs" ON peripheral_configs
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- promotions: Solo pueden acceder a promociones de sus tiendas
DROP POLICY IF EXISTS "Users can manage promotions" ON promotions;
CREATE POLICY "Users can manage promotions" ON promotions
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- promotion_products: Solo pueden acceder a productos de promociones de sus tiendas
DROP POLICY IF EXISTS "Users can manage promotion products" ON promotion_products;
CREATE POLICY "Users can manage promotion products" ON promotion_products
    FOR ALL USING (
        promotion_id IN (
            SELECT pr.id FROM promotions pr
            JOIN store_members sm ON sm.store_id = pr.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- promotion_usages: Solo pueden acceder a usos de promociones de sus tiendas
DROP POLICY IF EXISTS "Users can manage promotion usages" ON promotion_usages;
CREATE POLICY "Users can manage promotion usages" ON promotion_usages
    FOR ALL USING (
        promotion_id IN (
            SELECT pr.id FROM promotions pr
            JOIN store_members sm ON sm.store_id = pr.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- price_lists: Solo pueden acceder a listas de precios de sus tiendas
DROP POLICY IF EXISTS "Users can manage price lists" ON price_lists;
CREATE POLICY "Users can manage price lists" ON price_lists
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- price_list_items: Solo pueden acceder a items de listas de precios de sus tiendas
DROP POLICY IF EXISTS "Users can manage price list items" ON price_list_items;
CREATE POLICY "Users can manage price list items" ON price_list_items
    FOR ALL USING (
        price_list_id IN (
            SELECT pl.id FROM price_lists pl
            JOIN store_members sm ON sm.store_id = pl.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- license_payments: Solo pueden acceder a pagos de licencias de sus tiendas
DROP POLICY IF EXISTS "Users can manage license payments" ON license_payments;
CREATE POLICY "Users can manage license payments" ON license_payments
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- warehouses: Solo pueden acceder a bodegas de sus tiendas
DROP POLICY IF EXISTS "Users can manage warehouses" ON warehouses;
CREATE POLICY "Users can manage warehouses" ON warehouses
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- transfers: Solo pueden acceder a transferencias de sus tiendas
DROP POLICY IF EXISTS "Users can manage transfers" ON transfers;
CREATE POLICY "Users can manage transfers" ON transfers
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- warehouse_stock: Solo pueden acceder a stock de bodegas de sus tiendas
DROP POLICY IF EXISTS "Users can manage warehouse stock" ON warehouse_stock;
CREATE POLICY "Users can manage warehouse stock" ON warehouse_stock
    FOR ALL USING (
        warehouse_id IN (
            SELECT w.id FROM warehouses w
            JOIN store_members sm ON sm.store_id = w.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- transfer_items: Solo pueden acceder a items de transferencias de sus tiendas
DROP POLICY IF EXISTS "Users can manage transfer items" ON transfer_items;
CREATE POLICY "Users can manage transfer items" ON transfer_items
    FOR ALL USING (
        transfer_id IN (
            SELECT t.id FROM transfers t
            JOIN store_members sm ON sm.store_id = t.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- fiscal_invoices: Solo pueden acceder a facturas fiscales de sus tiendas
DROP POLICY IF EXISTS "Users can manage fiscal invoices" ON fiscal_invoices;
CREATE POLICY "Users can manage fiscal invoices" ON fiscal_invoices
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- fiscal_invoice_items: Solo pueden acceder a items de facturas fiscales de sus tiendas
DROP POLICY IF EXISTS "Users can manage fiscal invoice items" ON fiscal_invoice_items;
CREATE POLICY "Users can manage fiscal invoice items" ON fiscal_invoice_items
    FOR ALL USING (
        fiscal_invoice_id IN (
            SELECT fi.id FROM fiscal_invoices fi
            JOIN store_members sm ON sm.store_id = fi.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- suppliers: Solo pueden acceder a proveedores de sus tiendas
DROP POLICY IF EXISTS "Users can manage suppliers" ON suppliers;
CREATE POLICY "Users can manage suppliers" ON suppliers
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- fiscal_configs: Solo pueden acceder a configuraciones fiscales de sus tiendas
DROP POLICY IF EXISTS "Users can manage fiscal configs" ON fiscal_configs;
CREATE POLICY "Users can manage fiscal configs" ON fiscal_configs
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- detected_anomalies: Solo pueden acceder a anomalías detectadas de sus tiendas
DROP POLICY IF EXISTS "Users can manage detected anomalies" ON detected_anomalies;
CREATE POLICY "Users can manage detected anomalies" ON detected_anomalies
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- purchase_orders: Solo pueden acceder a órdenes de compra de sus tiendas
DROP POLICY IF EXISTS "Users can manage purchase orders" ON purchase_orders;
CREATE POLICY "Users can manage purchase orders" ON purchase_orders
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- purchase_order_items: Solo pueden acceder a items de órdenes de compra de sus tiendas
DROP POLICY IF EXISTS "Users can manage purchase order items" ON purchase_order_items;
CREATE POLICY "Users can manage purchase order items" ON purchase_order_items
    FOR ALL USING (
        purchase_order_id IN (
            SELECT po.id FROM purchase_orders po
            JOIN store_members sm ON sm.store_id = po.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- demand_predictions: Solo pueden acceder a predicciones de demanda de sus tiendas
DROP POLICY IF EXISTS "Users can manage demand predictions" ON demand_predictions;
CREATE POLICY "Users can manage demand predictions" ON demand_predictions
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- product_recommendations: Solo pueden acceder a recomendaciones de productos de sus tiendas
DROP POLICY IF EXISTS "Users can manage product recommendations" ON product_recommendations;
CREATE POLICY "Users can manage product recommendations" ON product_recommendations
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- notification_templates: Solo pueden acceder a plantillas de notificaciones de sus tiendas
DROP POLICY IF EXISTS "Users can manage notification templates" ON notification_templates;
CREATE POLICY "Users can manage notification templates" ON notification_templates
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- ml_model_metrics: Solo pueden acceder a métricas de modelos ML de sus tiendas
DROP POLICY IF EXISTS "Users can manage ml model metrics" ON ml_model_metrics;
CREATE POLICY "Users can manage ml model metrics" ON ml_model_metrics
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- alert_thresholds: Solo pueden acceder a umbrales de alertas de sus tiendas
DROP POLICY IF EXISTS "Users can manage alert thresholds" ON alert_thresholds;
CREATE POLICY "Users can manage alert thresholds" ON alert_thresholds
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- sale_returns: Solo pueden acceder a devoluciones de ventas de sus tiendas
DROP POLICY IF EXISTS "Users can manage sale returns" ON sale_returns;
CREATE POLICY "Users can manage sale returns" ON sale_returns
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- sale_return_items: Solo pueden acceder a items de devoluciones de sus tiendas
DROP POLICY IF EXISTS "Users can manage sale return items" ON sale_return_items;
CREATE POLICY "Users can manage sale return items" ON sale_return_items
    FOR ALL USING (
        return_id IN (
            SELECT sr.id FROM sale_returns sr
            JOIN store_members sm ON sm.store_id = sr.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- real_time_metrics: Solo pueden acceder a métricas en tiempo real de sus tiendas
DROP POLICY IF EXISTS "Users can view real time metrics" ON real_time_metrics;
CREATE POLICY "Users can view real time metrics" ON real_time_metrics
    FOR SELECT USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- real_time_alerts: Solo pueden acceder a alertas en tiempo real de sus tiendas
DROP POLICY IF EXISTS "Users can manage real time alerts" ON real_time_alerts;
CREATE POLICY "Users can manage real time alerts" ON real_time_alerts
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- sales_heatmap: Solo pueden acceder a heatmap de ventas de sus tiendas
DROP POLICY IF EXISTS "Users can view sales heatmap" ON sales_heatmap;
CREATE POLICY "Users can view sales heatmap" ON sales_heatmap
    FOR SELECT USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- comparative_metrics: Solo pueden acceder a métricas comparativas de sus tiendas
DROP POLICY IF EXISTS "Users can view comparative metrics" ON comparative_metrics;
CREATE POLICY "Users can view comparative metrics" ON comparative_metrics
    FOR SELECT USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- notification_preferences: Solo pueden acceder a preferencias de notificaciones de sus tiendas
DROP POLICY IF EXISTS "Users can manage their notification preferences" ON notification_preferences;
CREATE POLICY "Users can manage their notification preferences" ON notification_preferences
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
        AND user_id = (select auth.uid())
    );

-- notifications: Solo pueden acceder a notificaciones de sus tiendas
DROP POLICY IF EXISTS "Users can manage notifications" ON notifications;
CREATE POLICY "Users can manage notifications" ON notifications
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- notification_subscriptions: Solo pueden acceder a suscripciones de notificaciones de sus tiendas
DROP POLICY IF EXISTS "Users can manage their notification subscriptions" ON notification_subscriptions;
CREATE POLICY "Users can manage their notification subscriptions" ON notification_subscriptions
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
        AND user_id = (select auth.uid())
    );

-- notification_deliveries: Solo pueden acceder a entregas de notificaciones de sus tiendas
DROP POLICY IF EXISTS "Users can view notification deliveries" ON notification_deliveries;
CREATE POLICY "Users can view notification deliveries" ON notification_deliveries
    FOR SELECT USING (
        notification_id IN (
            SELECT n.id FROM notifications n
            JOIN store_members sm ON sm.store_id = n.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- notification_badges: Solo pueden acceder a badges de notificaciones de sus tiendas
DROP POLICY IF EXISTS "Users can manage their notification badges" ON notification_badges;
CREATE POLICY "Users can manage their notification badges" ON notification_badges
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
        AND user_id = (select auth.uid())
    );

-- chart_of_accounts: Solo pueden acceder a plan de cuentas de sus tiendas
DROP POLICY IF EXISTS "Users can manage chart of accounts" ON chart_of_accounts;
CREATE POLICY "Users can manage chart of accounts" ON chart_of_accounts
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- journal_entries: Solo pueden acceder a asientos contables de sus tiendas
DROP POLICY IF EXISTS "Users can manage journal entries" ON journal_entries;
CREATE POLICY "Users can manage journal entries" ON journal_entries
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- journal_entry_lines: Solo pueden acceder a líneas de asientos contables de sus tiendas
DROP POLICY IF EXISTS "Users can manage journal entry lines" ON journal_entry_lines;
CREATE POLICY "Users can manage journal entry lines" ON journal_entry_lines
    FOR ALL USING (
        entry_id IN (
            SELECT je.id FROM journal_entries je
            JOIN store_members sm ON sm.store_id = je.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- account_balances: Solo pueden acceder a balances de cuentas de sus tiendas
DROP POLICY IF EXISTS "Users can view account balances" ON account_balances;
CREATE POLICY "Users can view account balances" ON account_balances
    FOR SELECT USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- accounting_account_mappings: Solo pueden acceder a mapeos de cuentas de sus tiendas
DROP POLICY IF EXISTS "Users can manage accounting account mappings" ON accounting_account_mappings;
CREATE POLICY "Users can manage accounting account mappings" ON accounting_account_mappings
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- accounting_exports: Solo pueden acceder a exportaciones contables de sus tiendas
DROP POLICY IF EXISTS "Users can manage accounting exports" ON accounting_exports;
CREATE POLICY "Users can manage accounting exports" ON accounting_exports
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- accounting_erp_syncs: Solo pueden acceder a sincronizaciones ERP de sus tiendas
DROP POLICY IF EXISTS "Users can manage accounting erp syncs" ON accounting_erp_syncs;
CREATE POLICY "Users can manage accounting erp syncs" ON accounting_erp_syncs
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- accounting_periods: Solo pueden acceder a períodos contables de sus tiendas
DROP POLICY IF EXISTS "Users can manage accounting periods" ON accounting_periods;
CREATE POLICY "Users can manage accounting periods" ON accounting_periods
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- sale_sequences: Solo pueden acceder a secuencias de ventas de sus tiendas
DROP POLICY IF EXISTS "Users can manage sale sequences" ON sale_sequences;
CREATE POLICY "Users can manage sale sequences" ON sale_sequences
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- license_payment_documents: Solo pueden acceder a documentos de pago de licencias de sus tiendas
DROP POLICY IF EXISTS "Users can manage license payment documents" ON license_payment_documents;
CREATE POLICY "Users can manage license payment documents" ON license_payment_documents
    FOR ALL USING (
        payment_id IN (
            SELECT lp.id FROM license_payments lp
            JOIN store_members sm ON sm.store_id = lp.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- security_audit_log: Solo pueden acceder a logs de auditoría de seguridad de sus tiendas
-- Nota: store_id es nullable, así que también permitimos logs sin store_id si el user_id coincide
DROP POLICY IF EXISTS "Users can view security audit log" ON security_audit_log;
CREATE POLICY "Users can view security audit log" ON security_audit_log
    FOR SELECT USING (
        (store_id IS NULL AND user_id = (select auth.uid()))
        OR
        (store_id IS NOT NULL AND store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        ))
    );

-- license_payment_verifications: Solo pueden acceder a verificaciones de pagos de licencias de sus tiendas
DROP POLICY IF EXISTS "Users can manage license payment verifications" ON license_payment_verifications;
CREATE POLICY "Users can manage license payment verifications" ON license_payment_verifications
    FOR ALL USING (
        payment_id IN (
            SELECT lp.id FROM license_payments lp
            JOIN store_members sm ON sm.store_id = lp.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- two_factor_auth: Solo pueden acceder a configuraciones 2FA de sus tiendas
DROP POLICY IF EXISTS "Users can manage two factor auth" ON two_factor_auth;
CREATE POLICY "Users can manage two factor auth" ON two_factor_auth
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- reservations: Solo pueden acceder a reservas de sus tiendas
DROP POLICY IF EXISTS "Users can manage reservations" ON reservations;
CREATE POLICY "Users can manage reservations" ON reservations
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- whatsapp_message_queue: Solo pueden acceder a cola de mensajes WhatsApp de sus tiendas
DROP POLICY IF EXISTS "Users can manage whatsapp message queue" ON whatsapp_message_queue;
CREATE POLICY "Users can manage whatsapp message queue" ON whatsapp_message_queue
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- whatsapp_configs: Solo pueden acceder a configuraciones WhatsApp de sus tiendas
DROP POLICY IF EXISTS "Users can manage whatsapp configs" ON whatsapp_configs;
CREATE POLICY "Users can manage whatsapp configs" ON whatsapp_configs
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- alerts: Tabla de observabilidad del sistema (no tiene store_id)
-- Permitir acceso a todos los usuarios autenticados (pueden ser administradores)
DROP POLICY IF EXISTS "Users can view alerts" ON alerts;
CREATE POLICY "Users can view alerts" ON alerts
    FOR SELECT USING (
        (select auth.uid()) IS NOT NULL
    );

-- uptime_records: Tabla de observabilidad del sistema (no tiene store_id)
-- Permitir acceso a todos los usuarios autenticados (pueden ser administradores)
DROP POLICY IF EXISTS "Users can view uptime records" ON uptime_records;
CREATE POLICY "Users can view uptime records" ON uptime_records
    FOR SELECT USING (
        (select auth.uid()) IS NOT NULL
    );

-- ml_insights: Solo pueden acceder a insights ML de sus tiendas
DROP POLICY IF EXISTS "Users can manage ml insights" ON ml_insights;
CREATE POLICY "Users can manage ml insights" ON ml_insights
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- notification_analytics: Solo pueden acceder a analytics de notificaciones de sus tiendas
DROP POLICY IF EXISTS "Users can view notification analytics" ON notification_analytics;
CREATE POLICY "Users can view notification analytics" ON notification_analytics
    FOR SELECT USING (
        notification_id IN (
            SELECT n.id FROM notifications n
            JOIN store_members sm ON sm.store_id = n.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- device_sync_state: Solo pueden acceder a estado de sincronización de dispositivos de sus tiendas
DROP POLICY IF EXISTS "Users can manage device sync state" ON device_sync_state;
CREATE POLICY "Users can manage device sync state" ON device_sync_state
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- sync_conflicts: Solo pueden acceder a conflictos de sincronización de sus tiendas
DROP POLICY IF EXISTS "Users can manage sync conflicts" ON sync_conflicts;
CREATE POLICY "Users can manage sync conflicts" ON sync_conflicts
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- profiles: Solo pueden ver su propio perfil
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (
        id = (select auth.uid())
    );

-- email_verification_tokens: Solo pueden acceder a sus propios tokens de verificación
DROP POLICY IF EXISTS "Users can manage their email verification tokens" ON email_verification_tokens;
CREATE POLICY "Users can manage their email verification tokens" ON email_verification_tokens
    FOR ALL USING (
        user_id = (select auth.uid())
    );

-- sync_metrics: Solo pueden acceder a métricas de sincronización de sus tiendas
DROP POLICY IF EXISTS "Users can view sync metrics" ON sync_metrics;
CREATE POLICY "Users can view sync metrics" ON sync_metrics
    FOR SELECT USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- conflict_resolution_rules: Solo pueden acceder a reglas de resolución de conflictos de sus tiendas
DROP POLICY IF EXISTS "Users can manage conflict resolution rules" ON conflict_resolution_rules;
CREATE POLICY "Users can manage conflict resolution rules" ON conflict_resolution_rules
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- ml_notification_rules: Solo pueden acceder a reglas de notificaciones ML de sus tiendas
DROP POLICY IF EXISTS "Users can manage ml notification rules" ON ml_notification_rules;
CREATE POLICY "Users can manage ml notification rules" ON ml_notification_rules
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- notification_rate_limits: Solo pueden acceder a límites de tasa de notificaciones de sus tiendas
DROP POLICY IF EXISTS "Users can manage their notification rate limits" ON notification_rate_limits;
CREATE POLICY "Users can manage their notification rate limits" ON notification_rate_limits
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
        AND (user_id = (select auth.uid()) OR user_id IS NULL)
    );

-- email_queue: Solo pueden acceder a cola de emails de sus tiendas
DROP POLICY IF EXISTS "Users can manage email queue" ON email_queue;
CREATE POLICY "Users can manage email queue" ON email_queue
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- exchange_rates: Solo pueden acceder a tasas de cambio de sus tiendas
DROP POLICY IF EXISTS "Users can manage exchange rates" ON exchange_rates;
CREATE POLICY "Users can manage exchange rates" ON exchange_rates
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- pin_recovery_tokens: Solo pueden acceder a sus propios tokens de recuperación de PIN
DROP POLICY IF EXISTS "Users can manage their pin recovery tokens" ON pin_recovery_tokens;
CREATE POLICY "Users can manage their pin recovery tokens" ON pin_recovery_tokens
    FOR ALL USING (
        user_id = (select auth.uid())
    );

-- qr_codes: Solo pueden acceder a códigos QR de sus tiendas
DROP POLICY IF EXISTS "Users can manage qr codes" ON qr_codes;
CREATE POLICY "Users can manage qr codes" ON qr_codes
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- tables: Solo pueden acceder a mesas de sus tiendas
DROP POLICY IF EXISTS "Users can manage tables" ON tables;
CREATE POLICY "Users can manage tables" ON tables
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- shifts: Solo pueden acceder a turnos de sus tiendas
DROP POLICY IF EXISTS "Users can manage shifts" ON shifts;
CREATE POLICY "Users can manage shifts" ON shifts
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- shift_cuts: Solo pueden acceder a cortes de turno de sus tiendas
DROP POLICY IF EXISTS "Users can manage shift cuts" ON shift_cuts;
CREATE POLICY "Users can manage shift cuts" ON shift_cuts
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- supplier_price_lists: Solo pueden acceder a listas de precios de proveedores de sus tiendas
DROP POLICY IF EXISTS "Users can manage supplier price lists" ON supplier_price_lists;
CREATE POLICY "Users can manage supplier price lists" ON supplier_price_lists
    FOR ALL USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- supplier_price_list_items: Solo pueden acceder a items de listas de precios de proveedores de sus tiendas
DROP POLICY IF EXISTS "Users can manage supplier price list items" ON supplier_price_list_items;
CREATE POLICY "Users can manage supplier price list items" ON supplier_price_list_items
    FOR ALL USING (
        price_list_id IN (
            SELECT spl.id FROM supplier_price_lists spl
            JOIN store_members sm ON sm.store_id = spl.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- refresh_tokens: Solo pueden acceder a sus propios refresh tokens
DROP POLICY IF EXISTS "Users can manage their refresh tokens" ON refresh_tokens;
CREATE POLICY "Users can manage their refresh tokens" ON refresh_tokens
    FOR ALL USING (
        user_id = (select auth.uid())
    );

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON VIEW v_pending_conflicts IS 'Vista de conflictos pendientes - SECURITY INVOKER para seguridad';
COMMENT ON VIEW v_store_rates_summary IS 'Vista de resumen de tasas - SECURITY INVOKER para seguridad';
COMMENT ON VIEW ml_insights_summary IS 'Vista de resumen de insights ML - SECURITY INVOKER para seguridad';
COMMENT ON VIEW v_unhealthy_devices IS 'Vista de dispositivos con problemas - SECURITY INVOKER para seguridad';
COMMENT ON VIEW notification_engagement_metrics IS 'Vista de métricas de engagement - SECURITY INVOKER para seguridad';
COMMENT ON VIEW v_sales_with_payments IS 'Vista de ventas con pagos - SECURITY INVOKER para seguridad';
COMMENT ON VIEW v_sync_stats_by_store IS 'Vista de estadísticas de sincronización - SECURITY INVOKER para seguridad';
COMMENT ON VIEW product_stock IS 'Vista de stock de productos - SECURITY INVOKER para seguridad';
COMMENT ON VIEW customer_debt_balance IS 'Vista de balance de deudas - SECURITY INVOKER para seguridad';
