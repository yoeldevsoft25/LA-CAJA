-- ============================================
-- 92. RECETAS Y MANUFACTURA (RESTAURANTES)
-- ============================================

-- Actualizar tabla de productos con nuevos campos
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image_url TEXT NULL,
ADD COLUMN IF NOT EXISTS description TEXT NULL,
ADD COLUMN IF NOT EXISTS is_recipe BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS profit_margin NUMERIC(18, 2) NOT NULL DEFAULT 0;

-- Tabla de ingredientes de una receta
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty NUMERIC(18, 3) NOT NULL CHECK (qty > 0),
  unit VARCHAR(20) NULL, -- 'g', 'unit', 'kg', etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE recipe_ingredients IS 'Ingredientes que componen un producto tipo receta (plato)';

-- Tabla de modificadores (ej: "Término de carne", "Extras", "Acompañantes")
CREATE TABLE IF NOT EXISTS product_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- Ej: "Extras", "Cambiar Guarnición"
  type VARCHAR(50) NOT NULL DEFAULT 'optional', -- 'optional', 'interchangeable', 'required'
  is_multiple BOOLEAN NOT NULL DEFAULT FALSE, -- Si permite elegir varios
  min_options INTEGER NOT NULL DEFAULT 0,
  max_options INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Opciones de cada modificador (ej: "Queso Extra", "Papas Fritas")
CREATE TABLE IF NOT EXISTS product_modifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_id UUID NOT NULL REFERENCES product_modifiers(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  extra_price_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
  extra_price_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  ingredient_product_id UUID NULL REFERENCES products(id) ON DELETE SET NULL, -- Si la opción descuenta stock de un ingrediente
  qty_delta NUMERIC(18, 3) NULL, -- Cuánto descuenta
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_product_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient_id ON recipe_ingredients(ingredient_product_id);
CREATE INDEX IF NOT EXISTS idx_product_modifiers_product_id ON product_modifiers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_modifier_options_modifier_id ON product_modifier_options(modifier_id);
