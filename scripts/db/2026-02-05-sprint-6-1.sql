-- Sprint 6.1 DB changes (safe, idempotent)
-- Covers: stores.settings, cash_sessions PN counters, cash_ledger_entries, stock_escrow, events.request_id

-- 1) stores.settings
ALTER TABLE IF EXISTS stores
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- 2) cash_sessions PN counters
ALTER TABLE IF EXISTS cash_sessions
  ADD COLUMN IF NOT EXISTS ledger_p_bs NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ledger_n_bs NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ledger_p_usd NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ledger_n_usd NUMERIC(18,2) DEFAULT 0;

-- 3) cash_ledger_entries (immutable ledger)
CREATE TABLE IF NOT EXISTS cash_ledger_entries (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  device_id UUID NOT NULL,
  seq BIGINT NOT NULL,
  vector_clock JSONB NOT NULL DEFAULT '{}'::jsonb,
  entry_type TEXT NOT NULL,
  amount_bs NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_usd NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'BS',
  cash_session_id UUID NOT NULL,
  sold_at TIMESTAMPTZ NOT NULL,
  event_id UUID NOT NULL,
  request_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS IDX_cash_ledger_store_session
  ON cash_ledger_entries (store_id, cash_session_id);

CREATE INDEX IF NOT EXISTS IDX_cash_ledger_event_id
  ON cash_ledger_entries (event_id);

CREATE UNIQUE INDEX IF NOT EXISTS IDX_cash_ledger_request_id
  ON cash_ledger_entries (request_id);

CREATE INDEX IF NOT EXISTS IDX_cash_ledger_store_created_at
  ON cash_ledger_entries (store_id, created_at);

-- 4) stock_escrow (quota per device/product)
CREATE TABLE IF NOT EXISTS stock_escrow (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  product_id UUID NOT NULL,
  variant_id UUID NULL,
  device_id UUID NOT NULL,
  qty_granted NUMERIC(18,3) NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NULL,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stock_escrow
  ADD CONSTRAINT IF NOT EXISTS UQ_stock_escrow_store_product_device
  UNIQUE (store_id, product_id, device_id);

CREATE INDEX IF NOT EXISTS IDX_stock_escrow_store_product
  ON stock_escrow (store_id, product_id);

-- 5) events.request_id + unique index (dedupe)
ALTER TABLE IF EXISTS events
  ADD COLUMN IF NOT EXISTS request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS IDX_events_request_id_unique
  ON events (request_id)
  WHERE request_id IS NOT NULL;
