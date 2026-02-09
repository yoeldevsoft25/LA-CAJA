-- Migration: Add fiscal_number to sales table
-- Phase 3: Fiscal safety for offline sales

ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS fiscal_number VARCHAR(100) NULL;

COMMENT ON COLUMN sales.fiscal_number IS 'Pre-assigned fiscal number (Phase 3 offline-first safety)';

-- Index for searching sales by fiscal number
CREATE INDEX IF NOT EXISTS idx_sales_fiscal_number ON sales(store_id, fiscal_number) WHERE fiscal_number IS NOT NULL;
