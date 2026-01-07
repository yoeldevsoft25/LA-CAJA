-- =====================================================
-- Migración: Crear tabla exchange_rates
-- Descripción: Tabla para gestionar tasas de cambio (manuales y automáticas)
-- Fecha: 2026-01-07
-- =====================================================

-- Crear tabla exchange_rates
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  rate NUMERIC(18, 6) NOT NULL CHECK (rate > 0),
  source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('api', 'manual')),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT effective_date_range CHECK (
    effective_until IS NULL OR effective_until > effective_from
  )
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_exchange_rates_store
  ON exchange_rates(store_id);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_store_active
  ON exchange_rates(store_id, is_active, effective_from, effective_until)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_exchange_rates_store_effective
  ON exchange_rates(store_id, effective_from)
  WHERE is_active = true;

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_exchange_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_exchange_rates_updated_at
  BEFORE UPDATE ON exchange_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_exchange_rates_updated_at();

-- Comentarios
COMMENT ON TABLE exchange_rates IS 'Tasas de cambio para conversión de monedas (manual y automática)';
COMMENT ON COLUMN exchange_rates.source IS 'Fuente de la tasa: api (automática) o manual';
COMMENT ON COLUMN exchange_rates.effective_from IS 'Fecha desde la cual la tasa es efectiva';
COMMENT ON COLUMN exchange_rates.effective_until IS 'Fecha hasta la cual la tasa es efectiva (null = sin límite)';
COMMENT ON COLUMN exchange_rates.is_active IS 'Indica si la tasa está activa';
