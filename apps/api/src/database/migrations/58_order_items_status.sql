-- ============================================
-- 58. AGREGAR STATUS A ORDER ITEMS
-- ============================================
-- Agregar campo status a order_items para seguimiento de preparación en cocina

-- Agregar columna status a order_items
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'
CHECK (status IN ('pending', 'preparing', 'ready'));

-- Índice para búsquedas rápidas por estado
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_status ON order_items(order_id, status);

-- Comentarios
COMMENT ON COLUMN order_items.status IS 'Estado del item en cocina: pending (pendiente), preparing (en preparación), ready (listo)';
