-- ============================================
-- 19. SERIALES DE PRODUCTOS
-- ============================================
-- Tabla para rastrear productos individuales por número de serie

-- Tabla de seriales de productos
CREATE TABLE IF NOT EXISTS product_serials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  serial_number VARCHAR(200) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold', 'returned', 'damaged')),
  sale_id UUID NULL REFERENCES sales(id) ON DELETE SET NULL,
  sale_item_id UUID NULL REFERENCES sale_items(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL,
  sold_at TIMESTAMPTZ NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, serial_number)
);

COMMENT ON TABLE product_serials IS 'Seriales de productos para rastreo individual';
COMMENT ON COLUMN product_serials.product_id IS 'ID del producto';
COMMENT ON COLUMN product_serials.serial_number IS 'Número de serie único por producto';
COMMENT ON COLUMN product_serials.status IS 'Estado del serial (available, sold, returned, damaged)';
COMMENT ON COLUMN product_serials.sale_id IS 'ID de la venta (si fue vendido)';
COMMENT ON COLUMN product_serials.sale_item_id IS 'ID del item de venta (si fue vendido)';
COMMENT ON COLUMN product_serials.received_at IS 'Fecha de recepción del serial';
COMMENT ON COLUMN product_serials.sold_at IS 'Fecha de venta del serial';

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_product_serials_product ON product_serials(product_id);
CREATE INDEX IF NOT EXISTS idx_product_serials_status ON product_serials(status);
CREATE INDEX IF NOT EXISTS idx_product_serials_sale ON product_serials(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_serials_sale_item ON product_serials(sale_item_id) WHERE sale_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_serials_available ON product_serials(product_id, status) WHERE status = 'available';

