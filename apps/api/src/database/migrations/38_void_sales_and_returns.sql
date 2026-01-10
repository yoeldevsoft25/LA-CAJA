-- Migration: permitir anular ventas (devoluciones)

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS voided_by_user_id UUID NULL,
  ADD COLUMN IF NOT EXISTS void_reason TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_voided_at ON sales(voided_at) WHERE voided_at IS NOT NULL;
