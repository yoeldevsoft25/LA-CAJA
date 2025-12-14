-- ============================================
-- 9. Agregar campo sold_by_user_id a sales
-- ============================================
-- Agrega el campo para registrar quién realizó la venta

-- Agregar columna sold_by_user_id
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS sold_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Crear índice para búsquedas por responsable
CREATE INDEX IF NOT EXISTS idx_sales_sold_by_user_id ON sales(sold_by_user_id) WHERE sold_by_user_id IS NOT NULL;

-- Comentarios
COMMENT ON COLUMN sales.sold_by_user_id IS 'ID del usuario responsable de la venta';

