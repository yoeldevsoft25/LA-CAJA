-- Migración para optimizar el flujo de validación de créditos (FIAO)
-- Estos índices aceleran el cálculo de suma de deudas pendientes por cliente.

-- Índice para buscar deudas abiertas por cliente eficientemente
CREATE INDEX IF NOT EXISTS idx_debts_customer_id_status ON debts (customer_id, status) WHERE status != 'paid';

-- Índice para acelerar el agrupamiento y suma de pagos por deuda
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON debt_payments (debt_id);

-- Índice compuesto para la suma de montos en USD (usado en validación de crédito)
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_amount_usd ON debt_payments (debt_id, amount_usd);
