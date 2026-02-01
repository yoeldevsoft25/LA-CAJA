-- Add debt cutoff marker to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS debt_cutoff_at TIMESTAMPTZ;
COMMENT ON COLUMN customers.debt_cutoff_at IS 'Corte para distinguir deudas pasadas vs actuales (por cliente)';

SELECT 'Columna debt_cutoff_at agregada a customers' AS status;
