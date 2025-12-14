-- ============================================
-- 3. PRODUCTOS (Read Model)
-- ============================================
-- Tabla de productos - Proyectada desde eventos ProductCreated, ProductUpdated, etc.

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY, -- Generado desde eventos
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  sku TEXT,
  barcode TEXT,
  price_bs NUMERIC(18,2) NOT NULL DEFAULT 0,
  price_usd NUMERIC(18,2) NOT NULL DEFAULT 0,
  cost_bs NUMERIC(18,2) NOT NULL DEFAULT 0,
  cost_usd NUMERIC(18,2) NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE products IS 'Read model de productos - Proyectado desde eventos';
COMMENT ON COLUMN products.id IS 'ID único del producto';
COMMENT ON COLUMN products.store_id IS 'ID de la tienda';
COMMENT ON COLUMN products.name IS 'Nombre del producto';
COMMENT ON COLUMN products.category IS 'Categoría del producto';
COMMENT ON COLUMN products.sku IS 'SKU del producto (opcional)';
COMMENT ON COLUMN products.barcode IS 'Código de barras (opcional)';
COMMENT ON COLUMN products.price_bs IS 'Precio en Bolívares';
COMMENT ON COLUMN products.price_usd IS 'Precio en Dólares';
COMMENT ON COLUMN products.cost_bs IS 'Costo en Bolívares';
COMMENT ON COLUMN products.cost_usd IS 'Costo en Dólares';
COMMENT ON COLUMN products.low_stock_threshold IS 'Umbral de stock bajo para alertas';
COMMENT ON COLUMN products.is_active IS 'Si el producto está activo o desactivado';
COMMENT ON COLUMN products.updated_at IS 'Última actualización';

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_products_store_name ON products(store_id, name);
CREATE INDEX IF NOT EXISTS idx_products_store_category ON products(store_id, category);
CREATE INDEX IF NOT EXISTS idx_products_store_active ON products(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL;

-- Verificar que se creó correctamente
SELECT 'Tabla de productos creada correctamente' AS status;

