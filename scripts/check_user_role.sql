-- Script para verificar el rol de un usuario en la base de datos
-- Reemplaza 'USER_ID' y 'STORE_ID' con los valores correctos

SELECT 
    sm.user_id,
    sm.store_id,
    sm.role,
    p.full_name,
    s.name as store_name
FROM store_members sm
JOIN profiles p ON p.id = sm.user_id
JOIN stores s ON s.id = sm.store_id
WHERE sm.store_id = '9b8d1b2a-5635-4678-bef6-82b43a2b4c0a'
ORDER BY sm.created_at DESC;
