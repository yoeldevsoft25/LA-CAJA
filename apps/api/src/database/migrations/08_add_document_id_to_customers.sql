-- Agregar campo document_id (cédula de identidad) a la tabla customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS document_id TEXT;

-- Crear índice para búsquedas rápidas por cédula
CREATE INDEX IF NOT EXISTS idx_customers_store_document ON customers(store_id, document_id) WHERE document_id IS NOT NULL;

COMMENT ON COLUMN customers.document_id IS 'Cédula de identidad del cliente (único por tienda)';

-- Verificar que se agregó correctamente
SELECT 'Campo document_id agregado a customers' AS status;

