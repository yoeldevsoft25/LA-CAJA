-- ============================================
-- 5. CAJA (Cash Sessions)
-- ============================================
-- Tabla para sesiones de caja (apertura/cierre)

CREATE TABLE IF NOT EXISTS cash_sessions (
  id UUID PRIMARY KEY, -- Generado desde eventos
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  opened_by UUID, -- user_id que abrió la caja
  opened_at TIMESTAMPTZ NOT NULL,
  opening_amount_bs NUMERIC(18,2) NOT NULL DEFAULT 0,
  opening_amount_usd NUMERIC(18,2) NOT NULL DEFAULT 0,
  closed_by UUID, -- user_id que cerró la caja
  closed_at TIMESTAMPTZ, -- NULL si está abierta
  expected JSONB, -- Montos esperados por medio de pago
  counted JSONB, -- Montos contados físicamente
  note TEXT
);

COMMENT ON TABLE cash_sessions IS 'Sesiones de caja - Proyectado desde eventos CashSessionOpened, CashSessionClosed';
COMMENT ON COLUMN cash_sessions.id IS 'ID único de la sesión';
COMMENT ON COLUMN cash_sessions.store_id IS 'ID de la tienda';
COMMENT ON COLUMN cash_sessions.opened_by IS 'ID del usuario que abrió la caja';
COMMENT ON COLUMN cash_sessions.opened_at IS 'Fecha y hora de apertura';
COMMENT ON COLUMN cash_sessions.opening_amount_bs IS 'Monto inicial en Bolívares';
COMMENT ON COLUMN cash_sessions.opening_amount_usd IS 'Monto inicial en Dólares';
COMMENT ON COLUMN cash_sessions.closed_by IS 'ID del usuario que cerró la caja';
COMMENT ON COLUMN cash_sessions.closed_at IS 'Fecha y hora de cierre (NULL si está abierta)';
COMMENT ON COLUMN cash_sessions.expected IS 'Montos esperados por medio de pago (JSON)';
COMMENT ON COLUMN cash_sessions.counted IS 'Montos contados físicamente (JSON)';
COMMENT ON COLUMN cash_sessions.note IS 'Notas del cierre (descuadres, etc)';

-- Índices para consultas de caja
CREATE INDEX IF NOT EXISTS idx_cash_sessions_store_open ON cash_sessions(store_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_store_closed ON cash_sessions(store_id, closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_sessions_open ON cash_sessions(store_id, closed_at) WHERE closed_at IS NULL;

-- Verificar que se creó correctamente
SELECT 'Tabla de sesiones de caja creada correctamente' AS status;

