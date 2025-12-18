    -- ============================================
    -- SCRIPT DE CORRECCIÓN RÁPIDA
    -- Corrige la licencia y PINs de la tienda demo
    -- ============================================
    -- Ejecuta este script si ya tienes una tienda con el mismo ID
    -- y no puedes hacer login

    BEGIN;

    -- 1. Actualizar licencia de la tienda
    UPDATE stores 
    SET 
    license_status = 'active',
    license_expires_at = COALESCE(license_expires_at, NOW() + INTERVAL '365 days'),
    license_grace_days = COALESCE(license_grace_days, 3),
    license_plan = COALESCE(license_plan, 'premium')
    WHERE id = '550e8400-e29b-41d4-a716-446655440000';

    -- 2. Actualizar PINs de los usuarios (si existen)
    -- PINs: Owner=1234, María=5678, Carlos=9012
    UPDATE store_members 
    SET pin_hash = '$2b$10$JO.JwPGo1VcOXkLvGyUQYuhVIK52ZG/W25y.gq0PB4y9c2Bu1wSfm'
    WHERE store_id = '550e8400-e29b-41d4-a716-446655440000' 
    AND user_id = '660e8400-e29b-41d4-a716-446655440001';

    UPDATE store_members 
    SET pin_hash = '$2b$10$VXI6fVxJ9aagCvWa.TxS.OfLRWYTmKHhBj.WLkVibrN29IBt.rtkK'
    WHERE store_id = '550e8400-e29b-41d4-a716-446655440000' 
    AND user_id = '660e8400-e29b-41d4-a716-446655440002';

    UPDATE store_members 
    SET pin_hash = '$2b$10$tauFnyJyXBVOQC8XLd1GgeR9oaZ20wPsv1e7uF5KrUXlL47ntOcYW'
    WHERE store_id = '550e8400-e29b-41d4-a716-446655440000' 
    AND user_id = '660e8400-e29b-41d4-a716-446655440003';

    -- 3. Verificar configuración
    SELECT 
    s.id,
    s.name,
    s.license_status,
    s.license_expires_at,
    s.license_plan,
    sm.user_id,
    p.full_name,
    sm.role,
    CASE WHEN sm.pin_hash IS NOT NULL THEN 'Sí' ELSE 'No' END as has_pin
    FROM stores s
    LEFT JOIN store_members sm ON sm.store_id = s.id
    LEFT JOIN profiles p ON p.id = sm.user_id
    WHERE s.id = '550e8400-e29b-41d4-a716-446655440000';

    COMMIT;

    -- ============================================
    -- CREDENCIALES
    -- ============================================
    -- Store ID: 550e8400-e29b-41d4-a716-446655440000
    -- 
    -- Usuario: Juan Pérez (Owner)
    -- PIN: 1234
    --
    -- Usuario: María González (Cajera)
    -- PIN: 5678
    --
    -- Usuario: Carlos Rodríguez (Cajero)
    -- PIN: 9012
    -- ============================================

