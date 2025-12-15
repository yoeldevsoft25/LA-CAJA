-- Script rápido para verificar base de datos
-- Ejecuta esto en pgAdmin en la base de datos 'la_caja'

-- Verificar que todas las tablas existen
SELECT 
    'Tablas encontradas:' AS info,
    COUNT(*) AS total
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';

-- Listar todas las tablas
SELECT 
    table_name AS "Tabla",
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE columns.table_name = tables.table_name) AS "Columnas"
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Verificar tipos personalizados
SELECT typname AS "Tipo"
FROM pg_type
WHERE typname IN ('store_role');

-- Si todo está bien, deberías ver:
-- - 12 tablas (stores, profiles, store_members, events, products, inventory_movements, cash_sessions, sales, sale_items, customers, debts, debt_payments)
-- - 1 tipo (store_role)

