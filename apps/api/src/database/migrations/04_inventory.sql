-- ============================================
-- 4. INVENTARIO (Movimientos)
-- ============================================
-- Tabla de movimientos de inventario
-- El stock actual se calcula como SUM(qty_delta) por producto

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY, -- Generado desde eventos
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL, -- 'received' | 'adjust' | 'sold'
  qty_delta INT NOT NULL, -- Positivo para entradas, negativo para salidas
  unit_cost_bs NUMERIC(18,2) NOT NULL DEFAULT 0,
  unit_cost_usd NUMERIC(18,2) NOT NULL DEFAULT 0,
  note TEXT,
  ref JSONB, -- Referencias adicionales (supplier, invoice, etc)
  happened_at TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE inventory_movements IS 'Movimientos de inventario - Proyectado desde eventos StockReceived, StockAdjusted, y derivado de SaleCreated';
COMMENT ON COLUMN inventory_movements.id IS 'ID único del movimiento';
COMMENT ON COLUMN inventory_movements.store_id IS 'ID de la tienda';
COMMENT ON COLUMN inventory_movements.product_id IS 'ID del producto';
COMMENT ON COLUMN inventory_movements.movement_type IS 'Tipo: received (entrada), adjust (ajuste), sold (venta)';
COMMENT ON COLUMN inventory_movements.qty_delta IS 'Cantidad del movimiento (positivo=entrada, negativo=salida)';
COMMENT ON COLUMN inventory_movements.unit_cost_bs IS 'Costo unitario en Bolívares';
COMMENT ON COLUMN inventory_movements.unit_cost_usd IS 'Costo unitario en Dólares';
COMMENT ON COLUMN inventory_movements.note IS 'Nota o descripción del movimiento';
COMMENT ON COLUMN inventory_movements.ref IS 'Referencias JSON (proveedor, factura, etc)';
COMMENT ON COLUMN inventory_movements.happened_at IS 'Fecha y hora del movimiento';

-- Índices para consultas de inventario
CREATE INDEX IF NOT EXISTS idx_inv_mov_store_product ON inventory_movements(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_store_happened ON inventory_movements(store_id, happened_at);
CREATE INDEX IF NOT EXISTS idx_inv_mov_product_type ON inventory_movements(product_id, movement_type);

-- Vista para calcular stock actual (opcional, puede calcularse on-demand)
CREATE OR REPLACE VIEW product_stock AS
SELECT 
  store_id,
  product_id,
  SUM(qty_delta) AS current_stock
FROM inventory_movements
GROUP BY store_id, product_id;

COMMENT ON VIEW product_stock IS 'Vista que calcula el stock actual por producto';

-- Verificar que se creó correctamente
SELECT 'Tabla de inventario creada correctamente' AS status;

