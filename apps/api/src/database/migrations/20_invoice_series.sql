-- ============================================
-- 20. SERIES Y CONSECUTIVOS DE FACTURA
-- ============================================
-- Sistema para manejar múltiples series de facturas con consecutivos independientes

-- Tabla de series de factura
CREATE TABLE IF NOT EXISTS invoice_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  series_code VARCHAR(10) NOT NULL, -- A, B, C, etc.
  name VARCHAR(100) NOT NULL, -- Nombre descriptivo: "Serie Principal", "Serie Especial", etc.
  prefix VARCHAR(20) NULL, -- Prefijo opcional: "FAC", "TICK", etc.
  current_number INTEGER NOT NULL DEFAULT 0, -- Último número usado
  start_number INTEGER NOT NULL DEFAULT 1, -- Número inicial
  is_active BOOLEAN NOT NULL DEFAULT true,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, series_code)
);

COMMENT ON TABLE invoice_series IS 'Series de facturas con consecutivos independientes';
COMMENT ON COLUMN invoice_series.series_code IS 'Código de la serie (A, B, C, etc.)';
COMMENT ON COLUMN invoice_series.name IS 'Nombre descriptivo de la serie';
COMMENT ON COLUMN invoice_series.prefix IS 'Prefijo opcional para el número de factura';
COMMENT ON COLUMN invoice_series.current_number IS 'Último número consecutivo usado';
COMMENT ON COLUMN invoice_series.start_number IS 'Número inicial de la serie';
COMMENT ON COLUMN invoice_series.is_active IS 'Si la serie está activa y puede generar números';

-- Índices
CREATE INDEX IF NOT EXISTS idx_invoice_series_store ON invoice_series(store_id);
CREATE INDEX IF NOT EXISTS idx_invoice_series_active ON invoice_series(store_id, is_active) WHERE is_active = true;

-- Agregar campos a sales para rastrear número de factura
ALTER TABLE sales 
  ADD COLUMN IF NOT EXISTS invoice_series_id UUID NULL REFERENCES invoice_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS invoice_full_number VARCHAR(100) NULL; -- Número completo: "A-001", "FAC-B-123", etc.

COMMENT ON COLUMN sales.invoice_series_id IS 'ID de la serie de factura usada';
COMMENT ON COLUMN sales.invoice_number IS 'Número consecutivo de la factura';
COMMENT ON COLUMN sales.invoice_full_number IS 'Número completo de factura con prefijo y serie';

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_sales_invoice_series ON sales(invoice_series_id) WHERE invoice_series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_invoice_number ON sales(invoice_full_number) WHERE invoice_full_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_store_invoice ON sales(store_id, invoice_full_number) WHERE invoice_full_number IS NOT NULL;

