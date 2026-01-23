-- ============================================
-- VERIFICACIÓN FINAL Y SOLUCIÓN DEFINITIVA
-- ============================================
-- Verificar estado actual y eliminar cualquier deuda restante problemática

-- ============================================
-- PARTE 1: VERIFICACIÓN COMPLETA
-- ============================================

-- Todas las deudas de Mary
SELECT 
    d.id AS debt_id,
    d.sale_id,
    d.amount_usd,
    d.amount_bs,
    d.status,
    d.created_at,
    s.id AS sale_exists,
    s.voided_at,
    CASE 
        WHEN s.voided_at IS NOT NULL THEN 'Venta anulada - ELIMINAR'
        WHEN d.sale_id IS NOT NULL AND s.id IS NULL THEN 'Venta no existe - ELIMINAR'
        WHEN s.id IS NOT NULL AND s.voided_at IS NULL THEN 'Venta válida - OK'
        ELSE 'Sin venta - REVISAR'
    END AS accion
FROM debts d
INNER JOIN customers c ON d.customer_id = c.id
LEFT JOIN sales s ON d.sale_id = s.id
WHERE c.document_id = 'V-15263733'
ORDER BY d.created_at DESC;

-- Verificar eventos
SELECT 
    'EVENTOS DEBT CREATED' AS tipo,
    COUNT(*) AS cantidad
FROM events
WHERE type = 'DebtCreated'
AND payload->>'sale_id' = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- ============================================
-- PARTE 2: ELIMINACIÓN DEFINITIVA (SI HAY DEUDAS PROBLEMÁTICAS)
-- ============================================

BEGIN;

-- Eliminar TODAS las deudas asociadas a ventas anuladas de Mary
DELETE FROM debt_payments
WHERE debt_id IN (
    SELECT d.id
    FROM debts d
    INNER JOIN customers c ON d.customer_id = c.id
    LEFT JOIN sales s ON d.sale_id = s.id
    WHERE c.document_id = 'V-15263733'
    AND (s.voided_at IS NOT NULL OR (d.sale_id IS NOT NULL AND s.id IS NULL))
);

DELETE FROM debts
WHERE id IN (
    SELECT d.id
    FROM debts d
    INNER JOIN customers c ON d.customer_id = c.id
    LEFT JOIN sales s ON d.sale_id = s.id
    WHERE c.document_id = 'V-15263733'
    AND (s.voided_at IS NOT NULL OR (d.sale_id IS NOT NULL AND s.id IS NULL))
);

-- Eliminar TODOS los eventos DebtCreated asociados a ventas anuladas
DELETE FROM events
WHERE type = 'DebtCreated'
AND payload->>'sale_id' IN (
    SELECT id FROM sales 
    WHERE voided_at IS NOT NULL
    AND store_id = (SELECT store_id FROM customers WHERE document_id = 'V-15263733' LIMIT 1)
);

-- Verificación final
SELECT 
    'DEUDAS FINALES DE MARY' AS tipo,
    COUNT(*) AS cantidad,
    COALESCE(SUM(d.amount_usd), 0) AS total_usd,
    COALESCE(SUM(d.amount_bs), 0) AS total_bs
FROM debts d
INNER JOIN customers c ON d.customer_id = c.id
LEFT JOIN sales s ON d.sale_id = s.id
WHERE c.document_id = 'V-15263733'
AND (s.id IS NULL OR s.voided_at IS NULL);

COMMIT;  -- O ROLLBACK; si algo salió mal

-- ============================================
-- NOTA IMPORTANTE:
-- ============================================
-- Después de ejecutar esto, el frontend debería refrescar automáticamente.
-- Si no se refresca, el usuario puede:
-- 1. Recargar la página (F5)
-- 2. O limpiar el caché del navegador
-- 3. O esperar unos segundos para que el cache expire (15 minutos según la configuración)
