-- Add note column to debts for legacy and rollover notes
ALTER TABLE debts ADD COLUMN IF NOT EXISTS note TEXT;
COMMENT ON COLUMN debts.note IS 'Nota de la deuda (opcional)';

SELECT 'Columna note agregada a debts' AS status;
