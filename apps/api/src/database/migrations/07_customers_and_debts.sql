-- ============================================
-- 7. CLIENTES Y FIAO (Read Models)
-- ============================================
-- Tablas para clientes y sistema de fiado

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY, -- Generado desde eventos
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE customers IS 'Read model de clientes - Proyectado desde eventos CustomerCreated, CustomerUpdated';
COMMENT ON COLUMN customers.id IS 'ID único del cliente';
COMMENT ON COLUMN customers.store_id IS 'ID de la tienda';
COMMENT ON COLUMN customers.name IS 'Nombre del cliente';
COMMENT ON COLUMN customers.phone IS 'Teléfono del cliente (opcional)';
COMMENT ON COLUMN customers.note IS 'Notas del cliente';
COMMENT ON COLUMN customers.updated_at IS 'Última actualización';

-- Tabla de deudas (fiao)
CREATE TABLE IF NOT EXISTS debts (
  id UUID PRIMARY KEY, -- Generado desde eventos
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  amount_bs NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_usd NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' -- 'open' | 'paid' | 'partial'
);

COMMENT ON TABLE debts IS 'Read model de deudas (fiao) - Proyectado desde eventos DebtCreated';
COMMENT ON COLUMN debts.id IS 'ID único de la deuda';
COMMENT ON COLUMN debts.store_id IS 'ID de la tienda';
COMMENT ON COLUMN debts.sale_id IS 'ID de la venta que generó la deuda';
COMMENT ON COLUMN debts.customer_id IS 'ID del cliente que debe';
COMMENT ON COLUMN debts.created_at IS 'Fecha de creación de la deuda';
COMMENT ON COLUMN debts.amount_bs IS 'Monto de la deuda en Bolívares';
COMMENT ON COLUMN debts.amount_usd IS 'Monto de la deuda en Dólares';
COMMENT ON COLUMN debts.status IS 'Estado: open (abierta), paid (pagada), partial (parcial)';

-- Tabla de pagos de deudas
CREATE TABLE IF NOT EXISTS debt_payments (
  id UUID PRIMARY KEY, -- Generado desde eventos
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  paid_at TIMESTAMPTZ NOT NULL,
  amount_bs NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_usd NUMERIC(18,2) NOT NULL DEFAULT 0,
  method TEXT NOT NULL, -- 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER'
  note TEXT
);

COMMENT ON TABLE debt_payments IS 'Read model de pagos de deudas - Proyectado desde eventos DebtPaymentRecorded';
COMMENT ON COLUMN debt_payments.id IS 'ID único del pago';
COMMENT ON COLUMN debt_payments.store_id IS 'ID de la tienda';
COMMENT ON COLUMN debt_payments.debt_id IS 'ID de la deuda que se está pagando';
COMMENT ON COLUMN debt_payments.paid_at IS 'Fecha y hora del pago';
COMMENT ON COLUMN debt_payments.amount_bs IS 'Monto pagado en Bolívares';
COMMENT ON COLUMN debt_payments.amount_usd IS 'Monto pagado en Dólares';
COMMENT ON COLUMN debt_payments.method IS 'Método de pago';
COMMENT ON COLUMN debt_payments.note IS 'Nota del pago';

-- Índices para consultas de clientes y deudas
CREATE INDEX IF NOT EXISTS idx_customers_store_name ON customers(store_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_store_phone ON customers(store_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_debts_store_customer ON debts(store_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_debts_store_status ON debts(store_id, status);
CREATE INDEX IF NOT EXISTS idx_debts_customer_status ON debts(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_store ON debt_payments(store_id, paid_at);

-- Vista para calcular saldo de deudas (opcional)
CREATE OR REPLACE VIEW customer_debt_balance AS
SELECT 
  d.store_id,
  d.customer_id,
  d.id AS debt_id,
  d.amount_bs AS debt_amount_bs,
  d.amount_usd AS debt_amount_usd,
  COALESCE(SUM(dp.amount_bs), 0) AS paid_amount_bs,
  COALESCE(SUM(dp.amount_usd), 0) AS paid_amount_usd,
  (d.amount_bs - COALESCE(SUM(dp.amount_bs), 0)) AS balance_bs,
  (d.amount_usd - COALESCE(SUM(dp.amount_usd), 0)) AS balance_usd
FROM debts d
LEFT JOIN debt_payments dp ON dp.debt_id = d.id
WHERE d.status IN ('open', 'partial')
GROUP BY d.id, d.store_id, d.customer_id, d.amount_bs, d.amount_usd;

COMMENT ON VIEW customer_debt_balance IS 'Vista que calcula el saldo pendiente por deuda';

-- Verificar que se crearon correctamente
SELECT 'Tablas de clientes y deudas creadas correctamente' AS status;

