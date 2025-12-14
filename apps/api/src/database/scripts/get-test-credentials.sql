-- Script para obtener credenciales de prueba existentes
-- Ejecuta este script en pgAdmin para ver las tiendas y cajeros disponibles

-- Obtener todas las tiendas con sus cajeros
SELECT 
  s.id as store_id,
  s.name as store_name,
  p.id as profile_id,
  p.full_name as cashier_name,
  sm.role,
  CASE WHEN sm.pin_hash IS NOT NULL THEN '✅ Tiene PIN' ELSE '❌ Sin PIN' END as pin_status,
  sm.created_at
FROM stores s
LEFT JOIN store_members sm ON sm.store_id = s.id AND sm.role = 'cashier'
LEFT JOIN profiles p ON p.id = sm.user_id
ORDER BY s.created_at DESC, sm.created_at DESC;

-- Obtener solo tiendas con cajeros que tienen PIN
SELECT 
  s.id as store_id,
  s.name as store_name,
  p.full_name as cashier_name,
  '1234' as pin_hint -- ⚠️ Este es el PIN de prueba, puedes cambiarlo en create-test-data.sql
FROM stores s
JOIN store_members sm ON sm.store_id = s.id AND sm.role = 'cashier'
JOIN profiles p ON p.id = sm.user_id
WHERE sm.pin_hash IS NOT NULL
ORDER BY s.created_at DESC
LIMIT 5;

