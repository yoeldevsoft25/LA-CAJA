-- ============================================
-- 17. VARIANTES DE PRODUCTOS
-- ============================================
-- Tabla para manejar variantes de productos (tallas, colores, etc.)

-- Tabla de variantes de productos
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_type VARCHAR(50) NOT NULL, -- 'size', 'color', 'material', etc.
  variant_value VARCHAR(100) NOT NULL, -- 'M', 'L', 'XL', 'Rojo', etc.
  sku TEXT NULL,
  barcode TEXT NULL,
  price_bs NUMERIC(18,2) NULL, -- Si null, usa precio del producto base
  price_usd NUMERIC(18,2) NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, variant_type, variant_value)
);

COMMENT ON TABLE product_variants IS 'Variantes de productos (tallas, colores, materiales, etc.)';
COMMENT ON COLUMN product_variants.product_id IS 'ID del producto base';
COMMENT ON COLUMN product_variants.variant_type IS 'Tipo de variante (size, color, material, etc.)';
COMMENT ON COLUMN product_variants.variant_value IS 'Valor de la variante (M, L, XL, Rojo, Azul, etc.)';
COMMENT ON COLUMN product_variants.sku IS 'SKU específico de la variante (opcional)';
COMMENT ON COLUMN product_variants.barcode IS 'Código de barras específico de la variante (opcional)';
COMMENT ON COLUMN product_variants.price_bs IS 'Precio en Bs (si null, usa precio del producto base)';
COMMENT ON COLUMN product_variants.price_usd IS 'Precio en USD (si null, usa precio del producto base)';
COMMENT ON COLUMN product_variants.is_active IS 'Si la variante está activa';

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_type ON product_variants(variant_type);
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON product_variants(product_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode ON product_variants(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;

-- Añadir columna variant_id a sale_items para rastrear qué variante se vendió
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS variant_id UUID NULL REFERENCES product_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sale_items_variant ON sale_items(variant_id) WHERE variant_id IS NOT NULL;

-- Añadir columna variant_id a inventory_movements para rastrear movimientos por variante
ALTER TABLE inventory_movements
ADD COLUMN IF NOT EXISTS variant_id UUID NULL REFERENCES product_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant ON inventory_movements(variant_id) WHERE variant_id IS NOT NULL;

