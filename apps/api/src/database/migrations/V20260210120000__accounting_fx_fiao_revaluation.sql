-- ============================================
-- V20260210120000 - CONTABILIDAD FX (BCV), FIAO Y REVALUACION
-- ============================================
-- NOTE: Structural migration (V). Do not include DML (INSERT/UPDATE/DELETE).

-- FIAO: almacenar tasa de libro (BCV) para evitar CxC negativas por volatilidad del Bs
ALTER TABLE debts
  ADD COLUMN IF NOT EXISTS book_rate_bcv NUMERIC(18,6) NULL,
  ADD COLUMN IF NOT EXISTS book_rate_as_of TIMESTAMPTZ NULL;

-- Pagos de deuda: auditoria de tasa BCV usada y diferencial realizado
ALTER TABLE debt_payments
  ADD COLUMN IF NOT EXISTS bcv_rate NUMERIC(18,6) NULL,
  ADD COLUMN IF NOT EXISTS book_rate_bcv NUMERIC(18,6) NULL,
  ADD COLUMN IF NOT EXISTS fx_gain_loss_bs NUMERIC(18,2) NULL;

