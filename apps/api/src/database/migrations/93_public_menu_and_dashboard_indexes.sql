-- Migración 93: Índices para menú público y dashboard/reportes
-- Fecha: 2026-01-31
-- Descripción: Índices parciales para acelerar endpoints públicos y queries frecuentes del dashboard

-- ============================================
-- ÍNDICES PARA MENÚ PÚBLICO
-- ============================================

-- Acelera /public/menu (filtro por tienda + activos + visibles + orden por categoría/nombre)
CREATE INDEX IF NOT EXISTS idx_products_store_public_category_name
  ON products(store_id, category, name)
  WHERE is_active = true AND is_visible_public = true;

-- ============================================
-- ÍNDICES PARA DASHBOARD/REPORTES
-- ============================================

-- Ventas no anuladas por tienda y fecha (dashboard y reportes)
CREATE INDEX IF NOT EXISTS idx_sales_store_sold_at_not_voided
  ON sales(store_id, sold_at DESC)
  WHERE voided_at IS NULL;
