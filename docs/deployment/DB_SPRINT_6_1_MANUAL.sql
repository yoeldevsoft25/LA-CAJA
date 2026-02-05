-- Sprint 6.1 Manual SQL Patch (PostgreSQL)
-- Targets:
-- 1) stores.settings (JSONB)
-- 2) events.request_id + unique partial index
-- 3) cash_ledger_entries table + indexes
-- 4) stock_escrow table + constraints/indexes
-- 5) inventory_movements.from_escrow

-- IMPORTANT:
-- - Run on the correct database/schema.
-- - If unique indexes fail, you likely have duplicate request_id values.
--   Resolve duplicates before re-running the index creation.

BEGIN;

-- 1) stores.settings
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- 2) events.request_id
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS request_id UUID;

-- Unique partial index to enforce idempotency on request_id
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_events_request_id_unique"
  ON events (request_id)
  WHERE request_id IS NOT NULL;

-- 3) cash_ledger_entries
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

CREATE INDEX IF NOT EXISTS "IDX_cash_ledger_store_session"
  ON cash_ledger_entries (store_id, cash_session_id);

CREATE INDEX IF NOT EXISTS "IDX_cash_ledger_event_id"
  ON cash_ledger_entries (event_id);

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cash_ledger_request_id"
  ON cash_ledger_entries (request_id);

CREATE INDEX IF NOT EXISTS "IDX_cash_ledger_store_created_at"
  ON cash_ledger_entries (store_id, created_at);

-- 4) stock_escrow
CREATE TABLE IF NOT EXISTS stock_escrow (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  product_id UUID NOT NULL,
  variant_id UUID,
  device_id UUID NOT NULL,
  qty_granted NUMERIC(18,3) NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UQ_stock_escrow_store_product_device'
  ) THEN
    ALTER TABLE stock_escrow
      ADD CONSTRAINT "UQ_stock_escrow_store_product_device"
      UNIQUE (store_id, product_id, device_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IDX_stock_escrow_store_product"
  ON stock_escrow (store_id, product_id);

-- 5) inventory_movements.from_escrow
ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS from_escrow BOOLEAN NOT NULL DEFAULT false;

COMMIT;
