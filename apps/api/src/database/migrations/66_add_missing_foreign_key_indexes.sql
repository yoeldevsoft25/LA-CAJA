-- Migración 66: Agregar Índices para Claves Foráneas Sin Índice
-- Fecha: 2025-01-XX
-- Descripción: Agrega índices para todas las claves foráneas que no tienen un índice cubriendo
-- Esto mejora el rendimiento de las operaciones de JOIN, DELETE y UPDATE en tablas relacionadas
-- Ver: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

-- ============================================
-- PARTE 1: ÍNDICES PARA CLAVES FORÁNEAS
-- ============================================

-- accounting_account_mappings
CREATE INDEX IF NOT EXISTS idx_accounting_account_mappings_account_id 
    ON accounting_account_mappings(account_id);
CREATE INDEX IF NOT EXISTS idx_accounting_account_mappings_created_by 
    ON accounting_account_mappings(created_by) 
    WHERE created_by IS NOT NULL;

-- accounting_exports
CREATE INDEX IF NOT EXISTS idx_accounting_exports_exported_by 
    ON accounting_exports(exported_by) 
    WHERE exported_by IS NOT NULL;

-- accounting_periods
CREATE INDEX IF NOT EXISTS idx_accounting_periods_closed_by 
    ON accounting_periods(closed_by) 
    WHERE closed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounting_periods_closing_entry_id 
    ON accounting_periods(closing_entry_id) 
    WHERE closing_entry_id IS NOT NULL;

-- alert_thresholds
CREATE INDEX IF NOT EXISTS idx_alert_thresholds_created_by 
    ON alert_thresholds(created_by) 
    WHERE created_by IS NOT NULL;

-- chart_of_accounts
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_created_by 
    ON chart_of_accounts(created_by) 
    WHERE created_by IS NOT NULL;

-- detected_anomalies
CREATE INDEX IF NOT EXISTS idx_detected_anomalies_resolved_by 
    ON detected_anomalies(resolved_by) 
    WHERE resolved_by IS NOT NULL;

-- email_queue
CREATE INDEX IF NOT EXISTS idx_email_queue_template_id 
    ON email_queue(template_id) 
    WHERE template_id IS NOT NULL;

-- exchange_rates
CREATE INDEX IF NOT EXISTS idx_exchange_rates_created_by 
    ON exchange_rates(created_by) 
    WHERE created_by IS NOT NULL;

-- fiscal_invoice_items
CREATE INDEX IF NOT EXISTS idx_fiscal_invoice_items_variant_id 
    ON fiscal_invoice_items(variant_id) 
    WHERE variant_id IS NOT NULL;

-- fiscal_invoices
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_created_by 
    ON fiscal_invoices(created_by) 
    WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_invoice_series_id 
    ON fiscal_invoices(invoice_series_id) 
    WHERE invoice_series_id IS NOT NULL;

-- journal_entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_cancelled_by 
    ON journal_entries(cancelled_by) 
    WHERE cancelled_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_posted_by 
    ON journal_entries(posted_by) 
    WHERE posted_by IS NOT NULL;

-- license_payment_documents
CREATE INDEX IF NOT EXISTS idx_license_payment_documents_uploaded_by 
    ON license_payment_documents(uploaded_by) 
    WHERE uploaded_by IS NOT NULL;

-- license_payments
CREATE INDEX IF NOT EXISTS idx_license_payments_approved_by 
    ON license_payments(approved_by) 
    WHERE approved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_license_payments_rejected_by 
    ON license_payments(rejected_by) 
    WHERE rejected_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_license_payments_verified_by 
    ON license_payments(verified_by) 
    WHERE verified_by IS NOT NULL;

-- ml_insights
CREATE INDEX IF NOT EXISTS idx_ml_insights_notification_id 
    ON ml_insights(notification_id) 
    WHERE notification_id IS NOT NULL;

-- ml_notification_rules
CREATE INDEX IF NOT EXISTS idx_ml_notification_rules_template_id 
    ON ml_notification_rules(template_id) 
    WHERE template_id IS NOT NULL;

-- notification_badges
CREATE INDEX IF NOT EXISTS idx_notification_badges_user_id 
    ON notification_badges(user_id);

-- notification_preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id 
    ON notification_preferences(user_id);

-- notification_subscriptions
CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_user_id 
    ON notification_subscriptions(user_id);

-- order_items
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id 
    ON order_items(variant_id) 
    WHERE variant_id IS NOT NULL;

-- order_payments
CREATE INDEX IF NOT EXISTS idx_order_payments_paid_by_user_id 
    ON order_payments(paid_by_user_id) 
    WHERE paid_by_user_id IS NOT NULL;

-- orders
CREATE INDEX IF NOT EXISTS idx_orders_closed_by_user_id 
    ON orders(closed_by_user_id) 
    WHERE closed_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer_id 
    ON orders(customer_id) 
    WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_opened_by_user_id 
    ON orders(opened_by_user_id) 
    WHERE opened_by_user_id IS NOT NULL;

-- promotion_products
CREATE INDEX IF NOT EXISTS idx_promotion_products_variant_id 
    ON promotion_products(variant_id) 
    WHERE variant_id IS NOT NULL;

-- purchase_orders
CREATE INDEX IF NOT EXISTS idx_purchase_orders_received_by 
    ON purchase_orders(received_by) 
    WHERE received_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_requested_by 
    ON purchase_orders(requested_by) 
    WHERE requested_by IS NOT NULL;

-- real_time_alerts
CREATE INDEX IF NOT EXISTS idx_real_time_alerts_read_by 
    ON real_time_alerts(read_by) 
    WHERE read_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_real_time_alerts_threshold_id 
    ON real_time_alerts(threshold_id) 
    WHERE threshold_id IS NOT NULL;

-- refresh_tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_store_id 
    ON refresh_tokens(store_id);

-- sale_payments
CREATE INDEX IF NOT EXISTS idx_sale_payments_confirmed_by 
    ON sale_payments(confirmed_by) 
    WHERE confirmed_by IS NOT NULL;

-- sale_return_items
CREATE INDEX IF NOT EXISTS idx_sale_return_items_lot_id 
    ON sale_return_items(lot_id) 
    WHERE lot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sale_return_items_product_id 
    ON sale_return_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_return_items_variant_id 
    ON sale_return_items(variant_id) 
    WHERE variant_id IS NOT NULL;

-- sale_returns
CREATE INDEX IF NOT EXISTS idx_sale_returns_created_by 
    ON sale_returns(created_by) 
    WHERE created_by IS NOT NULL;

-- shift_cuts
CREATE INDEX IF NOT EXISTS idx_shift_cuts_created_by 
    ON shift_cuts(created_by) 
    WHERE created_by IS NOT NULL;

-- store_rate_configs
CREATE INDEX IF NOT EXISTS idx_store_rate_configs_created_by 
    ON store_rate_configs(created_by) 
    WHERE created_by IS NOT NULL;

-- supplier_price_lists
CREATE INDEX IF NOT EXISTS idx_supplier_price_lists_supplier_id 
    ON supplier_price_lists(supplier_id);

-- sync_conflicts
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_event_id_b 
    ON sync_conflicts(event_id_b) 
    WHERE event_id_b IS NOT NULL;

-- transfers
CREATE INDEX IF NOT EXISTS idx_transfers_received_by 
    ON transfers(received_by) 
    WHERE received_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transfers_requested_by 
    ON transfers(requested_by) 
    WHERE requested_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transfers_shipped_by 
    ON transfers(shipped_by) 
    WHERE shipped_by IS NOT NULL;

-- two_factor_auth
CREATE INDEX IF NOT EXISTS idx_two_factor_auth_store_id 
    ON two_factor_auth(store_id);

-- ============================================
-- PARTE 2: AGREGAR CLAVE PRIMARIA FALTANTE
-- ============================================

-- warehouse_stock: Verificar y agregar clave primaria si no existe
-- La tabla debería tener una columna id como PRIMARY KEY según las migraciones anteriores
DO $$
DECLARE
    has_pk BOOLEAN;
    has_id_column BOOLEAN;
BEGIN
    -- Verificar si existe una PRIMARY KEY
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conrelid = 'warehouse_stock'::regclass 
        AND contype = 'p'
    ) INTO has_pk;
    
    -- Verificar si existe la columna id
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'warehouse_stock' 
        AND column_name = 'id'
    ) INTO has_id_column;
    
    -- Si no hay PRIMARY KEY pero existe la columna id, agregar PRIMARY KEY
    IF NOT has_pk AND has_id_column THEN
        ALTER TABLE warehouse_stock 
        ADD CONSTRAINT warehouse_stock_pkey PRIMARY KEY (id);
        RAISE NOTICE 'PRIMARY KEY agregada a warehouse_stock en columna id';
    ELSIF NOT has_pk AND NOT has_id_column THEN
        -- Si no hay PRIMARY KEY ni columna id, agregar columna id y PRIMARY KEY
        ALTER TABLE warehouse_stock 
        ADD COLUMN id UUID DEFAULT gen_random_uuid();
        
        UPDATE warehouse_stock 
        SET id = gen_random_uuid() 
        WHERE id IS NULL;
        
        ALTER TABLE warehouse_stock 
        ALTER COLUMN id SET NOT NULL;
        
        ALTER TABLE warehouse_stock 
        ADD CONSTRAINT warehouse_stock_pkey PRIMARY KEY (id);
        
        RAISE NOTICE 'Columna id y PRIMARY KEY agregadas a warehouse_stock';
    ELSE
        RAISE NOTICE 'warehouse_stock ya tiene PRIMARY KEY';
    END IF;
END $$;

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON INDEX idx_accounting_account_mappings_account_id IS 
    'Índice para clave foránea account_id - mejora rendimiento de JOINs';
COMMENT ON INDEX idx_refresh_tokens_store_id IS 
    'Índice para clave foránea store_id - mejora rendimiento de JOINs';
COMMENT ON INDEX idx_two_factor_auth_store_id IS 
    'Índice para clave foránea store_id - mejora rendimiento de JOINs';
