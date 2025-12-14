-- Script para crear un cajero manualmente
-- Ajusta el store_id con el que obtuviste al crear la tienda

DO $$
DECLARE
  v_user_id UUID;
  v_store_id UUID := 'ecfac731-7049-4899-ad25-3e2572f3bd84'; -- ⚠️ REEMPLAZA CON TU STORE_ID
  -- Hash de PIN "1234" generado con bcrypt
  v_pin_hash TEXT := '$2b$10$Ic0eTkOcWxrRcbCo04kqdOEl2bwz7E23si.Hl3S/VZhCOH/jqudW2';
  v_full_name TEXT := 'Juan Pérez - Cajero';
BEGIN
  -- Crear perfil del cajero
  v_user_id := gen_random_uuid();
  
  INSERT INTO profiles (id, full_name, created_at)
  VALUES (v_user_id, v_full_name, NOW());
  
  -- Crear store member como cashier
  INSERT INTO store_members (store_id, user_id, role, pin_hash, created_at)
  VALUES (v_store_id, v_user_id, 'cashier', v_pin_hash, NOW());
  
  RAISE NOTICE '✅ Cajero creado exitosamente!';
  RAISE NOTICE '   User ID: %', v_user_id;
  RAISE NOTICE '   Store ID: %', v_store_id;
  RAISE NOTICE '   Full Name: %', v_full_name;
  RAISE NOTICE '   PIN: 1234';
END $$;

-- Verificar que se creó correctamente
SELECT 
  sm.store_id,
  sm.user_id,
  sm.role,
  p.full_name,
  sm.created_at
FROM store_members sm
JOIN profiles p ON p.id = sm.user_id
WHERE sm.role = 'cashier'
ORDER BY sm.created_at DESC
LIMIT 1;

