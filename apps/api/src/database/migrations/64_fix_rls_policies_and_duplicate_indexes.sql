-- Migración 64: Corrección de Políticas RLS y Eliminación de Índices Duplicados
-- Fecha: 2025-01-XX
-- Descripción: 
--   1. Corrige políticas RLS para usar (select auth.uid()) en lugar de auth.uid() para mejor performance
--   2. Elimina índices duplicados detectados por el linter de Supabase

-- ============================================
-- PARTE 1: CORRECCIÓN DE POLÍTICAS RLS
-- ============================================
-- Reemplazar auth.uid() con (select auth.uid()) para evitar re-evaluación en cada fila
-- Ver: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- Políticas para store_rate_configs
DROP POLICY IF EXISTS "Users can view their store rate configs" ON store_rate_configs;
CREATE POLICY "Users can view their store rate configs" ON store_rate_configs
    FOR SELECT USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can update their store rate configs" ON store_rate_configs;
CREATE POLICY "Users can update their store rate configs" ON store_rate_configs
    FOR UPDATE USING (
        store_id IN (
            SELECT sm.store_id FROM store_members sm WHERE sm.user_id = (select auth.uid())
        )
    );

-- Políticas para sale_payments
DROP POLICY IF EXISTS "Users can view sale payments" ON sale_payments;
CREATE POLICY "Users can view sale payments" ON sale_payments
    FOR SELECT USING (
        sale_id IN (
            SELECT s.id FROM sales s
            JOIN store_members sm ON sm.store_id = s.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can insert sale payments" ON sale_payments;
CREATE POLICY "Users can insert sale payments" ON sale_payments
    FOR INSERT WITH CHECK (
        sale_id IN (
            SELECT s.id FROM sales s
            JOIN store_members sm ON sm.store_id = s.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- Políticas para sale_change
DROP POLICY IF EXISTS "Users can view sale change" ON sale_change;
CREATE POLICY "Users can view sale change" ON sale_change
    FOR SELECT USING (
        sale_id IN (
            SELECT s.id FROM sales s
            JOIN store_members sm ON sm.store_id = s.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can insert sale change" ON sale_change;
CREATE POLICY "Users can insert sale change" ON sale_change
    FOR INSERT WITH CHECK (
        sale_id IN (
            SELECT s.id FROM sales s
            JOIN store_members sm ON sm.store_id = s.store_id
            WHERE sm.user_id = (select auth.uid())
        )
    );

-- ============================================
-- PARTE 2: ELIMINACIÓN DE ÍNDICES DUPLICADOS
-- ============================================
-- Eliminamos los índices duplicados detectados por el linter de Supabase
-- Mantenemos los índices con nombres más consistentes y específicos

-- cash_sessions: Eliminar índices duplicados
-- Grupo 1: {idx_cash_sessions_open, idx_cash_sessions_store_status} - ambos son (store_id, closed_at) WHERE closed_at IS NULL
-- Mantener: idx_cash_sessions_store_status
DROP INDEX IF EXISTS idx_cash_sessions_open;

-- Grupo 2: {cash_sessions_store_open_idx, idx_cash_sessions_store_open} - ambos son (store_id, opened_at)
-- Mantener: idx_cash_sessions_store_open
DROP INDEX IF EXISTS cash_sessions_store_open_idx;

-- customers: Eliminar índices duplicados
-- Grupo 1: {idx_customers_document, idx_customers_store_document} - ambos son (store_id, document_id) WHERE document_id IS NOT NULL
-- Mantener: idx_customers_store_document
DROP INDEX IF EXISTS idx_customers_document;

-- Grupo 2: {idx_customers_name, idx_customers_store_name} - ambos son (store_id, name)
-- Mantener: idx_customers_store_name
DROP INDEX IF EXISTS idx_customers_name;

-- debts: Eliminar índice duplicado
-- Grupo: {debts_store_customer_idx, idx_debts_store_customer} - ambos son (store_id, customer_id)
-- Mantener: idx_debts_store_customer
DROP INDEX IF EXISTS debts_store_customer_idx;

-- events: Eliminar índices duplicados
-- Grupo 1: {events_store_seq_idx, idx_events_store_seq} - ambos son (store_id, seq)
-- Mantener: idx_events_store_seq
DROP INDEX IF EXISTS events_store_seq_idx;

-- Grupo 2: {events_store_type_idx, idx_events_store_type} - ambos son (store_id, type)
-- Mantener: idx_events_store_type
DROP INDEX IF EXISTS events_store_type_idx;

-- fiscal_invoices: Eliminar índice duplicado
-- Grupo: {idx_fiscal_invoices_number, idx_fiscal_invoices_store_number} - ambos son (store_id, invoice_number)
-- Mantener: idx_fiscal_invoices_store_number
DROP INDEX IF EXISTS idx_fiscal_invoices_number;

-- inventory_movements: Eliminar índices duplicados
-- Grupo 1: {idx_inventory_happened_at, idx_inventory_movements_store_happened_btree} - ambos son (store_id, happened_at DESC)
-- Mantener: idx_inventory_movements_store_happened_btree
DROP INDEX IF EXISTS idx_inventory_happened_at;

-- Grupo 2: {idx_inv_mov_store_product, idx_inventory_store_product, inv_mov_store_product_idx} - todos son (store_id, product_id)
-- Mantener: idx_inventory_store_product
DROP INDEX IF EXISTS idx_inv_mov_store_product;
DROP INDEX IF EXISTS inv_mov_store_product_idx;

-- products: Eliminar índice duplicado
-- Grupo: {idx_products_store_name, products_store_name_idx} - ambos son (store_id, name)
-- Mantener: idx_products_store_name
DROP INDEX IF EXISTS products_store_name_idx;

-- sale_items: Eliminar índices duplicados
-- Grupo 1: {idx_sale_items_product, idx_sale_items_product_id} - ambos son (product_id)
-- Mantener: idx_sale_items_product_id
DROP INDEX IF EXISTS idx_sale_items_product;

-- Grupo 2: {idx_sale_items_sale, idx_sale_items_sale_id} - ambos son (sale_id)
-- Mantener: idx_sale_items_sale_id
DROP INDEX IF EXISTS idx_sale_items_sale;

-- sales: Eliminar índices duplicados
-- Grupo 1: {idx_sales_cash_session, idx_sales_cash_session_id} - ambos son (cash_session_id) WHERE cash_session_id IS NOT NULL
-- Mantener: idx_sales_cash_session_id
DROP INDEX IF EXISTS idx_sales_cash_session;

-- Grupo 2: {idx_sales_customer, idx_sales_customer_id} - ambos son (customer_id) WHERE customer_id IS NOT NULL
-- Mantener: idx_sales_customer_id
DROP INDEX IF EXISTS idx_sales_customer;

-- Grupo 3: {idx_sales_sold_by, idx_sales_sold_by_user_id} - ambos son (sold_by_user_id) WHERE sold_by_user_id IS NOT NULL
-- Mantener: idx_sales_sold_by_user_id
DROP INDEX IF EXISTS idx_sales_sold_by;

-- Grupo 4: {idx_sales_store_date, idx_sales_store_date_status, idx_sales_store_sold_at_btree} - todos son (store_id, sold_at DESC)
-- Mantener: idx_sales_store_sold_at_btree (más descriptivo)
DROP INDEX IF EXISTS idx_sales_store_date;
-- Eliminar idx_sales_store_date_status (duplicado de idx_sales_store_sold_at_btree)
DROP INDEX IF EXISTS idx_sales_store_date_status;

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON POLICY "Users can view their store rate configs" ON store_rate_configs IS 
    'Política RLS optimizada usando (select auth.uid()) para mejor performance';
COMMENT ON POLICY "Users can update their store rate configs" ON store_rate_configs IS 
    'Política RLS optimizada usando (select auth.uid()) para mejor performance';
COMMENT ON POLICY "Users can view sale payments" ON sale_payments IS 
    'Política RLS optimizada usando (select auth.uid()) para mejor performance';
COMMENT ON POLICY "Users can insert sale payments" ON sale_payments IS 
    'Política RLS optimizada usando (select auth.uid()) para mejor performance';
COMMENT ON POLICY "Users can view sale change" ON sale_change IS 
    'Política RLS optimizada usando (select auth.uid()) para mejor performance';
COMMENT ON POLICY "Users can insert sale change" ON sale_change IS 
    'Política RLS optimizada usando (select auth.uid()) para mejor performance';
