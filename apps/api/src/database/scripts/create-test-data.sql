-- Script para crear datos de prueba para login
-- Ejecuta este script en tu base de datos PostgreSQL (pgAdmin)

-- 1. Crear una tienda de prueba
INSERT INTO stores (id, name, created_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Tienda de Prueba',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Crear un perfil (profile) para el cajero
INSERT INTO profiles (id, full_name, created_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Juan Pérez - Cajero',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 3. Crear un miembro de la tienda (cajero) con PIN '1234'
-- Hash generado con: bcrypt.hash('1234', 10)
INSERT INTO store_members (store_id, user_id, role, pin_hash, created_at)
VALUES (
  '11111111-1111-1111-1111-111111111111', -- Store ID
  '22222222-2222-2222-2222-222222222222', -- User ID (Profile ID)
  'cashier',
  '$2b$10$7mzvb3IUc/4XNZDHbNHrdu5s/lEKx2sf4yKZ1eEILxa0u/AdbKr7O', -- PIN: 1234
  NOW()
)
ON CONFLICT (store_id, user_id) DO NOTHING;

-- Verificar los datos creados
SELECT 
  s.id as store_id,
  s.name as store_name,
  p.id as profile_id,
  p.full_name,
  sm.role,
  CASE WHEN sm.pin_hash IS NOT NULL THEN 'Sí' ELSE 'No' END as has_pin
FROM stores s
JOIN store_members sm ON sm.store_id = s.id
JOIN profiles p ON p.id = sm.user_id
WHERE s.id = '11111111-1111-1111-1111-111111111111';
