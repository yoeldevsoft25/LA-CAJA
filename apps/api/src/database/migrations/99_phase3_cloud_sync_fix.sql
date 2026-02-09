-- ############################################################################
-- LA-CAJA PHASE 3: CONSOLIDATED MIGRATION SCRIPT (FIX SYNC)
-- Purpose: Fix missing tables in Supabase (Cloud) for Production.
-- Includes: Outbox, Fiscal Invoices, Ledger, Stock Escrow, Event Deduplication.
-- ############################################################################

DO $$ 
BEGIN

  -- ========================================================
  -- 1. INFRAESTRUCTURA DE SINCRONIZACIÓN Y OUTBOX
  -- ========================================================
  -- Fixes error: relation "outbox_entries" does not exist

  CREATE TABLE IF NOT EXISTS outbox_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    store_id UUID NOT NULL,
    target VARCHAR(50) NOT NULL,  -- 'projection' | 'federation-relay'
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
  );

  CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_entries (created_at) WHERE status = 'pending';
  CREATE INDEX IF NOT EXISTS idx_outbox_event_id ON outbox_entries (event_id);

  -- Auditoría de Conflictos
  CREATE TABLE IF NOT EXISTS conflict_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255),
    winner_event_id VARCHAR(255) NOT NULL,
    loser_event_ids TEXT[] NOT NULL DEFAULT '{}',
    strategy VARCHAR(50) NOT NULL,
    winner_payload JSONB,
    loser_payloads JSONB,
    resolved_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_by VARCHAR(100) DEFAULT 'auto'
  );

  CREATE INDEX IF NOT EXISTS idx_conflict_audit_store ON conflict_audit_log (store_id, resolved_at DESC);

  -- Snapshots de Salud de Federación
  CREATE TABLE IF NOT EXISTS federation_health_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL,
    overall_health VARCHAR(20) NOT NULL,
    event_lag_count INT DEFAULT 0,
    projection_gap_count INT DEFAULT 0,
    stock_divergence_count INT DEFAULT 0,
    negative_stock_count INT DEFAULT 0,
    queue_depth INT DEFAULT 0,
    failed_jobs INT DEFAULT 0,
    remote_reachable BOOLEAN DEFAULT true,
    remote_latency_ms INT,
    snapshot_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_health_snapshots ON federation_health_snapshots (store_id, snapshot_at DESC);

  -- ========================================================
  -- 2. SEGURIDAD FISCAL (Phase 3 Offline)
  -- ========================================================

  -- Rangos de secuencias fiscales por dispositivo
  CREATE TABLE IF NOT EXISTS fiscal_sequence_ranges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL,
    series_id UUID NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    range_start BIGINT NOT NULL,
    range_end BIGINT NOT NULL,
    used_up_to BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_fiscal_range_device UNIQUE (store_id, series_id, device_id, range_start)
  );

  CREATE INDEX IF NOT EXISTS idx_fiscal_ranges_active ON fiscal_sequence_ranges (store_id, device_id, status) WHERE status = 'active';

  -- Columna clave en SALES para Offline Safety
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS fiscal_number VARCHAR(100) NULL;
  CREATE INDEX IF NOT EXISTS idx_sales_fiscal_number ON sales(store_id, fiscal_number) WHERE fiscal_number IS NOT NULL;
  COMMENT ON COLUMN sales.fiscal_number IS 'Pre-assigned fiscal number (Phase 3 offline-first safety)';

  -- ========================================================
  -- 3. FACTURACIÓN FISCAL COMPLETA
  -- ========================================================

  -- Facturas Fiscales
  CREATE TABLE IF NOT EXISTS fiscal_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    sale_id UUID NULL REFERENCES sales(id) ON DELETE SET NULL,
    invoice_number VARCHAR(50) NOT NULL,
    fiscal_number VARCHAR(100) NULL,
    invoice_series_id UUID NULL, 
    invoice_type VARCHAR(20) NOT NULL DEFAULT 'invoice',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    issued_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    issuer_name VARCHAR(200) NOT NULL,
    issuer_tax_id VARCHAR(50) NOT NULL,
    issuer_address TEXT NULL,
    issuer_phone VARCHAR(50) NULL,
    issuer_email VARCHAR(255) NULL,
    customer_id UUID NULL REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(200) NULL,
    customer_tax_id VARCHAR(50) NULL,
    customer_address TEXT NULL,
    customer_phone VARCHAR(50) NULL,
    customer_email VARCHAR(255) NULL,
    subtotal_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
    subtotal_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_amount_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_amount_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
    discount_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
    discount_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
    total_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
    total_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
    exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 0,
    currency VARCHAR(20) NOT NULL DEFAULT 'BS',
    fiscal_control_code VARCHAR(100) NULL,
    fiscal_authorization_number VARCHAR(100) NULL,
    fiscal_qr_code TEXT NULL,
    payment_method VARCHAR(50) NULL,
    note TEXT NULL,
    created_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, invoice_number)
  );

  -- Items de Factura Fiscal
  CREATE TABLE IF NOT EXISTS fiscal_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_invoice_id UUID NOT NULL REFERENCES fiscal_invoices(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id UUID NULL REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name VARCHAR(200) NOT NULL,
    product_code VARCHAR(100) NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
    unit_price_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
    discount_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
    discount_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
    subtotal_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
    subtotal_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_amount_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_amount_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
    total_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
    total_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Configuración Fiscal
  CREATE TABLE IF NOT EXISTS fiscal_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    tax_id VARCHAR(50) NOT NULL,
    business_name VARCHAR(200) NOT NULL,
    business_address TEXT NOT NULL,
    business_phone VARCHAR(50) NULL,
    business_email VARCHAR(255) NULL,
    default_tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 16.00,
    fiscal_authorization_number VARCHAR(100) NULL,
    fiscal_authorization_date DATE NULL,
    fiscal_authorization_expiry DATE NULL,
    fiscal_control_system VARCHAR(50) NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(store_id)
  );

  -- Estructuras de Soporte (Ledger & Escrow)
  CREATE TABLE IF NOT EXISTS cash_ledger_entries (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL,
    device_id UUID,
    seq BIGINT,
    vector_clock JSONB DEFAULT '{}',
    entry_type TEXT,
    amount_bs NUMERIC(18, 2) DEFAULT 0,
    amount_usd NUMERIC(18, 2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'BS',
    cash_session_id UUID,
    sold_at TIMESTAMPTZ,
    event_id UUID,
    request_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
  );

  CREATE TABLE IF NOT EXISTS stock_escrow (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL,
    product_id UUID NOT NULL,
    variant_id UUID NULL,
    device_id UUID NOT NULL,
    qty_granted NUMERIC(18, 3) DEFAULT 0,
    expires_at TIMESTAMPTZ,
    last_updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Request IDs en Eventos (Deduplicación)
  ALTER TABLE events ADD COLUMN IF NOT EXISTS request_id UUID NULL;
  
  -- Indices faltantes
  CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_store ON fiscal_invoices(store_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_created_at_desc ON cash_ledger_entries(store_id, created_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_events_request_id_unique ON events (request_id) WHERE request_id IS NOT NULL;

END $$;
