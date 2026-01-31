-- Add public catalog fields and product type for restaurant separation
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) NOT NULL DEFAULT 'sale_item',
  ADD COLUMN IF NOT EXISTS is_visible_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS public_name TEXT,
  ADD COLUMN IF NOT EXISTS public_description TEXT,
  ADD COLUMN IF NOT EXISTS public_image_url TEXT,
  ADD COLUMN IF NOT EXISTS public_category TEXT;

-- Backfill product_type based on existing recipe flag
UPDATE products
SET product_type = CASE WHEN is_recipe THEN 'prepared' ELSE 'sale_item' END
WHERE product_type IS NULL;
