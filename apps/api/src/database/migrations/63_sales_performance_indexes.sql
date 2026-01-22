-- Migración 63: Índices Optimizados para Performance de Ventas
-- Crea índices adicionales específicos para optimizar el procesamiento de ventas
-- Fecha: 2025-01-XX
-- Descripción: Índices para mejorar queries frecuentes en el flujo de ventas

-- ============================================
-- ÍNDICES PARA VENTAS (SALES)
-- ============================================

-- Índice compuesto optimizado para queries de listado de ventas
-- Usado frecuentemente en: listado de ventas por tienda ordenadas por fecha
CREATE INDEX IF NOT EXISTS idx_sales_store_sold_at_id 
  ON sales(store_id, sold_at DESC, id DESC);

-- Índice para búsqueda rápida de ventas por sesión de caja (muy común en cierre de caja)
CREATE INDEX IF NOT EXISTS idx_sales_cash_session_sold_at 
  ON sales(cash_session_id, sold_at DESC) 
  WHERE cash_session_id IS NOT NULL;

-- Índice para búsqueda de ventas por usuario vendedor y fecha (reportes)
CREATE INDEX IF NOT EXISTS idx_sales_sold_by_date 
  ON sales(sold_by_user_id, sold_at DESC) 
  WHERE sold_by_user_id IS NOT NULL;

-- ============================================
-- ÍNDICES PARA ITEMS DE VENTA (SALE_ITEMS)
-- ============================================

-- Índice compuesto con INCLUDE columns para evitar lookups adicionales
-- Permite obtener qty, precios y descuentos sin acceder a la tabla principal
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_product_include 
  ON sale_items(sale_id, product_id) 
  INCLUDE (qty, unit_price_bs, unit_price_usd, discount_bs, discount_usd, is_weight_product, weight_value);

-- Índice para queries de productos más vendidos (analytics)
CREATE INDEX IF NOT EXISTS idx_sale_items_product_sold_at 
  ON sale_items(product_id, sale_id) 
  INCLUDE (qty);

-- ============================================
-- ÍNDICES PARA PRODUCTOS (PRODUCTS)
-- ============================================

-- Índice parcial optimizado para productos activos (usado en búsquedas de ventas)
CREATE INDEX IF NOT EXISTS idx_products_store_active_id 
  ON products(store_id, id) 
  WHERE is_active = true;

-- Índice para búsqueda rápida por código de barras (escaneo en POS)
CREATE INDEX IF NOT EXISTS idx_products_store_barcode 
  ON products(store_id, barcode) 
  WHERE barcode IS NOT NULL AND is_active = true;

-- ============================================
-- ÍNDICES PARA LOTES (PRODUCT_LOTS)
-- ============================================

-- Índice optimizado para queries FIFO de lotes (usado en ventas)
-- Ordenado por fecha de expiración para facilitar selección FIFO
CREATE INDEX IF NOT EXISTS idx_product_lots_product_fifo 
  ON product_lots(product_id, expires_at ASC NULLS LAST, remaining_quantity DESC) 
  WHERE remaining_quantity > 0;

-- ============================================
-- ÍNDICES PARA STOCK DE BODEGAS (WAREHOUSE_STOCK)
-- ============================================

-- Índice compuesto para validación rápida de stock durante ventas
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_warehouse_product_variant 
  ON warehouse_stock(warehouse_id, product_id, variant_id) 
  WHERE stock > 0 OR reserved > 0;

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON INDEX idx_sales_store_sold_at_id IS 'Índice optimizado para listado de ventas por tienda ordenadas por fecha';
COMMENT ON INDEX idx_sale_items_sale_product_include IS 'Índice con columnas incluidas para evitar lookups adicionales en queries de items de venta';
COMMENT ON INDEX idx_products_store_active_id IS 'Índice parcial para productos activos usado en búsquedas de ventas';
COMMENT ON INDEX idx_product_lots_product_fifo IS 'Índice optimizado para selección FIFO de lotes en ventas';
