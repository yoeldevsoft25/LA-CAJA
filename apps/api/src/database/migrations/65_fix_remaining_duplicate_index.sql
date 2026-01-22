-- Migración 65: Eliminar índice duplicado restante en sales
-- Fecha: 2025-01-XX
-- Descripción: Elimina el índice duplicado idx_sales_store_date_status que es idéntico a idx_sales_store_sold_at_btree
-- Ambos índices son: (store_id, sold_at DESC)

-- Eliminar índice duplicado
-- Mantener: idx_sales_store_sold_at_btree (más descriptivo)
DROP INDEX IF EXISTS idx_sales_store_date_status;

COMMENT ON INDEX idx_sales_store_sold_at_btree IS 
    'Índice compuesto para queries de ventas por tienda y fecha. Reemplaza idx_sales_store_date_status duplicado';
