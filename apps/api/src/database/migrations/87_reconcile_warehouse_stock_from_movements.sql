-- 87. Reconciliación de warehouse_stock desde inventory_movements
-- Corrige el stock en bodega cuando movimientos 'received' se guardaron pero
-- warehouse_stock no se actualizó (bug previo en stockReceived).
--
-- Para cada (warehouse_id, product_id, variant_id) con movimientos, calcula
-- el stock esperado como SUM(qty_delta) y actualiza o inserta en warehouse_stock.

-- 1) Calcular stock esperado por (warehouse_id, product_id, variant_id)
WITH expected AS (
  SELECT
    im.warehouse_id,
    im.product_id,
    im.variant_id,
    SUM(im.qty_delta) AS expected_stock
  FROM inventory_movements im
  INNER JOIN warehouses w ON w.id = im.warehouse_id
  WHERE im.warehouse_id IS NOT NULL
    AND im.movement_type IN ('received', 'adjust', 'sold', 'sale')
  GROUP BY im.warehouse_id, im.product_id, im.variant_id
)

-- 2) Actualizar registros existentes en warehouse_stock
UPDATE warehouse_stock ws
SET
  stock = GREATEST(0, e.expected_stock::numeric),
  updated_at = NOW()
FROM expected e
WHERE ws.warehouse_id = e.warehouse_id
  AND ws.product_id = e.product_id
  AND (
    (e.variant_id IS NULL AND ws.variant_id IS NULL)
    OR (e.variant_id IS NOT NULL AND ws.variant_id = e.variant_id)
  );

-- 3) Insertar registros faltantes (movimientos existen pero no hay fila en warehouse_stock)
-- NOTA: El CTE 'expected' solo aplica a la sentencia anterior; el INSERT necesita su propio WITH.
WITH expected AS (
  SELECT
    im.warehouse_id,
    im.product_id,
    im.variant_id,
    SUM(im.qty_delta) AS expected_stock
  FROM inventory_movements im
  INNER JOIN warehouses w ON w.id = im.warehouse_id
  WHERE im.warehouse_id IS NOT NULL
    AND im.movement_type IN ('received', 'adjust', 'sold', 'sale')
  GROUP BY im.warehouse_id, im.product_id, im.variant_id
)
INSERT INTO warehouse_stock (id, warehouse_id, product_id, variant_id, stock, reserved, updated_at)
SELECT
  gen_random_uuid(),
  e.warehouse_id,
  e.product_id,
  e.variant_id,
  GREATEST(0, e.expected_stock),
  0,
  NOW()
FROM expected e
WHERE e.expected_stock > 0
  AND NOT EXISTS (
    SELECT 1
    FROM warehouse_stock ws
    WHERE ws.warehouse_id = e.warehouse_id
      AND ws.product_id = e.product_id
      AND (
        (e.variant_id IS NULL AND ws.variant_id IS NULL)
        OR (e.variant_id IS NOT NULL AND ws.variant_id = e.variant_id)
      )
  );
