-- Script para verificar el rol de TODOS los usuarios en la tienda
-- Reemplaza el STORE_ID con el valor correcto si es necesario

-- Ver todos los miembros de la tienda
SELECT 
    sm.user_id,
    sm.store_id,
    sm.role,
    p.full_name,
    s.name as store_name,
    sm.created_at
FROM store_members sm
LEFT JOIN profiles p ON p.id = sm.user_id
LEFT JOIN stores s ON s.id = sm.store_id
WHERE sm.store_id = '9b8d1b2a-5635-4678-bef6-82b43a2b4c0a'
ORDER BY 
    CASE sm.role 
        WHEN 'owner' THEN 1 
        WHEN 'cashier' THEN 2 
        ELSE 3 
    END,
    sm.created_at DESC;

-- Verificar si hay múltiples usuarios con el mismo user_id (no debería pasar, pero por si acaso)
SELECT 
    user_id,
    COUNT(*) as count,
    STRING_AGG(role::text, ', ') as roles,
    STRING_AGG(store_id::text, ', ') as store_ids
FROM store_members
WHERE store_id = '9b8d1b2a-5635-4678-bef6-82b43a2b4c0a'
GROUP BY user_id
HAVING COUNT(*) > 1;
