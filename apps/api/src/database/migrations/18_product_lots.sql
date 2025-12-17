-- ============================================
-- 18. LOTES Y VENCIMIENTOS
-- ============================================
-- Tablas para manejar lotes de productos con fechas de vencimiento y lógica FIFO

-- Tabla de lotes de productos
CREATE TABLE IF NOT EXISTS product_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lot_number VARCHAR(100) NOT NULL,
  initial_quantity INTEGER NOT NULL,
  remaining_quantity INTEGER NOT NULL,
  unit_cost_bs NUMERIC(18,2) NOT NULL,
  unit_cost_usd NUMERIC(18,2) NOT NULL,
  expiration_date DATE NULL,
  received_at TIMESTAMPTZ NOT NULL,
  supplier TEXT NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, lot_number)
);

COMMENT ON TABLE product_lots IS 'Lotes de productos con fechas de vencimiento';
COMMENT ON COLUMN product_lots.product_id IS 'ID del producto';
COMMENT ON COLUMN product_lots.lot_number IS 'Número de lote único por producto';
COMMENT ON COLUMN product_lots.initial_quantity IS 'Cantidad inicial del lote';
COMMENT ON COLUMN product_lots.remaining_quantity IS 'Cantidad restante del lote';
COMMENT ON COLUMN product_lots.unit_cost_bs IS 'Costo unitario en Bs';
COMMENT ON COLUMN product_lots.unit_cost_usd IS 'Costo unitario en USD';
COMMENT ON COLUMN product_lots.expiration_date IS 'Fecha de vencimiento (opcional)';
COMMENT ON COLUMN product_lots.received_at IS 'Fecha de recepción del lote';
COMMENT ON COLUMN product_lots.supplier IS 'Proveedor del lote (opcional)';

-- Movimientos de lotes
CREATE TABLE IF NOT EXISTS lot_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES product_lots(id) ON DELETE CASCADE,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('received', 'sold', 'expired', 'damaged', 'adjusted')),
  qty_delta INTEGER NOT NULL,
  happened_at TIMESTAMPTZ NOT NULL,
  sale_id UUID NULL REFERENCES sales(id) ON DELETE SET NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lot_movements IS 'Movimientos de lotes (entradas, salidas, vencimientos, etc.)';
COMMENT ON COLUMN lot_movements.lot_id IS 'ID del lote';
COMMENT ON COLUMN lot_movements.movement_type IS 'Tipo de movimiento';
COMMENT ON COLUMN lot_movements.qty_delta IS 'Cambio en cantidad (positivo para entradas, negativo para salidas)';
COMMENT ON COLUMN lot_movements.happened_at IS 'Fecha del movimiento';
COMMENT ON COLUMN lot_movements.sale_id IS 'ID de la venta (si aplica)';

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_product_lots_product ON product_lots(product_id);
CREATE INDEX IF NOT EXISTS idx_product_lots_expiration ON product_lots(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_lots_received ON product_lots(product_id, received_at);
CREATE INDEX IF NOT EXISTS idx_lot_movements_lot ON lot_movements(lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_movements_sale ON lot_movements(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lot_movements_type ON lot_movements(movement_type);

-- Añadir columna lot_id a sale_items para rastrear qué lote se vendió
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS lot_id UUID NULL REFERENCES product_lots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sale_items_lot ON sale_items(lot_id) WHERE lot_id IS NOT NULL;

