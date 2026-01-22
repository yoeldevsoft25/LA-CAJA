-- Migración 69: Corrección de Seguridad - Function Search Path y Materialized Views
-- Fecha: 2025-01-XX
-- Descripción: 
--   1. Configura search_path fijo para todas las funciones (previene inyección SQL)
--   2. Revoca permisos de acceso directo a vistas materializadas desde API
-- Ver: https://supabase.com/docs/guides/database/database-linter

-- ============================================
-- PARTE 1: CONFIGURAR SEARCH_PATH EN FUNCIONES
-- ============================================
-- Establecer search_path = '' previene ataques de inyección SQL
-- que explotan el search_path mutable

-- Funciones de notificaciones
ALTER FUNCTION update_notification_engagement_score() SET search_path = '';
ALTER FUNCTION reset_rate_limit_windows() SET search_path = '';

-- Funciones de analytics
ALTER FUNCTION refresh_analytics_views() SET search_path = '';
ALTER FUNCTION refresh_sales_daily_incremental(UUID, DATE) SET search_path = '';

-- Funciones de licencias
ALTER FUNCTION update_license_payments_updated_at() SET search_path = '';

-- Funciones de sincronización
ALTER FUNCTION update_device_sync_state_timestamp() SET search_path = '';
ALTER FUNCTION update_sync_conflicts_timestamp() SET search_path = '';

-- Funciones de tasas de cambio
ALTER FUNCTION update_exchange_rates_updated_at() SET search_path = '';

-- Funciones de refresh tokens
ALTER FUNCTION cleanup_expired_refresh_tokens() SET search_path = '';

-- Funciones de conversión de moneda
ALTER FUNCTION to_cents(NUMERIC) SET search_path = '';
ALTER FUNCTION from_cents(BIGINT) SET search_path = '';
ALTER FUNCTION usd_to_bs(NUMERIC, NUMERIC) SET search_path = '';
ALTER FUNCTION bs_to_usd(NUMERIC, NUMERIC) SET search_path = '';
ALTER FUNCTION banker_round(NUMERIC, INTEGER) SET search_path = '';

-- Funciones de tasas de cambio
ALTER FUNCTION get_active_rate(UUID, VARCHAR) SET search_path = '';
ALTER FUNCTION get_all_active_rates(UUID) SET search_path = '';

-- Funciones de cálculos de ventas
ALTER FUNCTION calculate_bs_change_breakdown(NUMERIC) SET search_path = '';
ALTER FUNCTION calculate_sale_totals(UUID) SET search_path = '';

-- Funciones trigger
ALTER FUNCTION trg_ensure_single_preferred_rate() SET search_path = '';
ALTER FUNCTION trg_update_store_rate_configs_timestamp() SET search_path = '';
ALTER FUNCTION trg_validate_payment_limits() SET search_path = '';

-- ============================================
-- PARTE 2: REVOCAR PERMISOS DE VISTAS MATERIALIZADAS
-- ============================================
-- Las vistas materializadas no deben ser accesibles directamente desde la API
-- Los datos deben accederse a través de funciones o vistas regulares con RLS

-- Revocar permisos SELECT para roles anon y authenticated
REVOKE SELECT ON mv_sales_daily FROM anon, authenticated;
REVOKE SELECT ON mv_inventory_metrics FROM anon, authenticated;
REVOKE SELECT ON mv_customer_metrics FROM anon, authenticated;
REVOKE SELECT ON mv_top_products_30d FROM anon, authenticated;

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON FUNCTION update_notification_engagement_score() IS 'Actualiza score de engagement de notificaciones - search_path fijo para seguridad';
COMMENT ON FUNCTION reset_rate_limit_windows() IS 'Resetea ventanas de rate limiting - search_path fijo para seguridad';
COMMENT ON FUNCTION refresh_analytics_views() IS 'Refresca vistas de analytics - search_path fijo para seguridad';
COMMENT ON FUNCTION refresh_sales_daily_incremental(UUID, DATE) IS 'Refresca vista materializada de ventas diarias - search_path fijo para seguridad';
COMMENT ON FUNCTION update_license_payments_updated_at() IS 'Actualiza timestamp de pagos de licencia - search_path fijo para seguridad';
COMMENT ON FUNCTION update_device_sync_state_timestamp() IS 'Actualiza timestamp de estado de sincronización - search_path fijo para seguridad';
COMMENT ON FUNCTION update_sync_conflicts_timestamp() IS 'Actualiza timestamp de conflictos de sincronización - search_path fijo para seguridad';
COMMENT ON FUNCTION update_exchange_rates_updated_at() IS 'Actualiza timestamp de tasas de cambio - search_path fijo para seguridad';
COMMENT ON FUNCTION cleanup_expired_refresh_tokens() IS 'Limpia refresh tokens expirados - search_path fijo para seguridad';
COMMENT ON FUNCTION to_cents(NUMERIC) IS 'Convierte monto a centavos - search_path fijo para seguridad';
COMMENT ON FUNCTION from_cents(BIGINT) IS 'Convierte centavos a monto - search_path fijo para seguridad';
COMMENT ON FUNCTION usd_to_bs(NUMERIC, NUMERIC) IS 'Convierte USD a BS - search_path fijo para seguridad';
COMMENT ON FUNCTION bs_to_usd(NUMERIC, NUMERIC) IS 'Convierte BS a USD - search_path fijo para seguridad';
COMMENT ON FUNCTION banker_round(NUMERIC, INTEGER) IS 'Redondeo bancario - search_path fijo para seguridad';
COMMENT ON FUNCTION get_active_rate(UUID, VARCHAR) IS 'Obtiene tasa activa - search_path fijo para seguridad';
COMMENT ON FUNCTION get_all_active_rates(UUID) IS 'Obtiene todas las tasas activas - search_path fijo para seguridad';
COMMENT ON FUNCTION calculate_bs_change_breakdown(NUMERIC) IS 'Calcula desglose de cambio en BS - search_path fijo para seguridad';
COMMENT ON FUNCTION calculate_sale_totals(UUID) IS 'Calcula totales de venta - search_path fijo para seguridad';
COMMENT ON FUNCTION trg_ensure_single_preferred_rate() IS 'Trigger: asegura una sola tasa preferida - search_path fijo para seguridad';
COMMENT ON FUNCTION trg_update_store_rate_configs_timestamp() IS 'Trigger: actualiza timestamp de configs de tasa - search_path fijo para seguridad';
COMMENT ON FUNCTION trg_validate_payment_limits() IS 'Trigger: valida límites de pago - search_path fijo para seguridad';
