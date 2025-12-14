-- ============================================================================
-- Script para Verificar que la Tienda Existe
-- Ejecuta esto en Supabase SQL Editor para verificar los datos
-- ============================================================================

-- Verificar tienda
SELECT 
  id,
  name,
  created_at
FROM stores
WHERE id = '11111111-1111-1111-1111-111111111111';

-- Verificar usuarios/perfiles
SELECT 
  p.id,
  p.full_name,
  p.created_at
FROM profiles p
WHERE p.id IN (
  '00000000-0000-0000-0000-000000000001',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

-- Verificar miembros de la tienda (con roles y PINs)
SELECT 
  sm.store_id,
  sm.user_id,
  sm.role,
  CASE WHEN sm.pin_hash IS NOT NULL THEN 'Sí' ELSE 'No' END as tiene_pin,
  p.full_name
FROM store_members sm
JOIN profiles p ON p.id = sm.user_id
WHERE sm.store_id = '11111111-1111-1111-1111-111111111111';

-- Resumen: Contar tiendas, usuarios, miembros
SELECT 
  'Tiendas' as tipo,
  COUNT(*) as cantidad
FROM stores
UNION ALL
SELECT 
  'Usuarios' as tipo,
  COUNT(*) as cantidad
FROM profiles
UNION ALL
SELECT 
  'Miembros' as tipo,
  COUNT(*) as cantidad
FROM store_members;
