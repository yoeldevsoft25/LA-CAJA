-- Script de prueba para verificar que todas las tablas están creadas
-- Ejecuta este script en pgAdmin después de crear todas las tablas

-- Verificar tablas principales
SELECT 
    'stores' AS tabla,
    COUNT(*) AS registros
FROM stores
UNION ALL
SELECT 
    'profiles',
    COUNT(*)
FROM profiles
UNION ALL
SELECT 
    'store_members',
    COUNT(*)
FROM store_members
UNION ALL
SELECT 
    'events',
    COUNT(*)
FROM events
UNION ALL
SELECT 
    'products',
    COUNT(*)
FROM products
UNION ALL
SELECT 
    'inventory_movements',
    COUNT(*)
FROM inventory_movements
UNION ALL
SELECT 
    'cash_sessions',
    COUNT(*)
FROM cash_sessions
UNION ALL
SELECT 
    'sales',
    COUNT(*)
FROM sales
UNION ALL
SELECT 
    'sale_items',
    COUNT(*)
FROM sale_items
UNION ALL
SELECT 
    'customers',
    COUNT(*)
FROM customers
UNION ALL
SELECT 
    'debts',
    COUNT(*)
FROM debts
UNION ALL
SELECT 
    'debt_payments',
    COUNT(*)
FROM debt_payments
ORDER BY tabla;

-- Verificar índices principales
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN (
        'stores', 'profiles', 'store_members', 'events',
        'products', 'inventory_movements', 'cash_sessions',
        'sales', 'sale_items', 'customers', 'debts', 'debt_payments'
    )
ORDER BY tablename, indexname;

-- Verificar tipos
SELECT typname, typtype
FROM pg_type
WHERE typname IN ('store_role');

SELECT '✅ Base de datos configurada correctamente' AS status;

