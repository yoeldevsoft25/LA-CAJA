-- 86. FIX WAREHOUSE_STOCK DUPLICATES FOR NULL VARIANT
-- Limpia duplicados con variant_id NULL y asegura unicidad futura.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY warehouse_id, product_id
      ORDER BY stock DESC, reserved DESC, updated_at DESC, id DESC
    ) AS rn
  FROM warehouse_stock
  WHERE variant_id IS NULL
)
DELETE FROM warehouse_stock
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouse_stock_unique_null_variant
  ON warehouse_stock (warehouse_id, product_id)
  WHERE variant_id IS NULL;
