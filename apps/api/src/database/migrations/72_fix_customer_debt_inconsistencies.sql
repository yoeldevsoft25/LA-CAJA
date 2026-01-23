-- ============================================
-- 72. CORREGIR INCONSISTENCIAS DE DEUDAS DE CLIENTES
-- ============================================
-- Este script identifica y corrige deudas que están asociadas a:
-- 1. Ventas anuladas (voided_at IS NOT NULL)
-- 2. Ventas que no existen (sale_id apunta a venta borrada)
-- 3. Deudas huérfanas sin venta asociada

-- ============================================
-- PARTE 1: IDENTIFICAR TODAS LAS INCONSISTENCIAS
-- ============================================
-- Ejecutar primero para ver el estado completo

-- Deudas con ventas anuladas
SELECT 
    'DEUDAS CON VENTAS ANULADAS' AS tipo_problema,
    d.id AS debt_id,
    d.sale_id,
    c.name AS customer_name,
    c.id AS customer_id,
    c.document_id,
    d.amount_bs,
    d.amount_usd,
    d.status,
    d.created_at,
    s.voided_at,
    s.void_reason,
    (SELECT COUNT(*) FROM debt_payments dp WHERE dp.debt_id = d.id) AS payments_count
FROM debts d
INNER JOIN sales s ON d.sale_id = s.id
INNER JOIN customers c ON d.customer_id = c.id
WHERE s.voided_at IS NOT NULL
ORDER BY d.created_at DESC;

-- Deudas con ventas inexistentes
SELECT 
    'DEUDAS CON VENTAS INEXISTENTES' AS tipo_problema,
    d.id AS debt_id,
    d.sale_id,
    c.name AS customer_name,
    c.id AS customer_id,
    c.document_id,
    d.amount_bs,
    d.amount_usd,
    d.status,
    d.created_at,
    NULL::timestamptz AS voided_at,
    'Venta no existe' AS void_reason,
    (SELECT COUNT(*) FROM debt_payments dp WHERE dp.debt_id = d.id) AS payments_count
FROM debts d
LEFT JOIN sales s ON d.sale_id = s.id
INNER JOIN customers c ON d.customer_id = c.id
WHERE d.sale_id IS NOT NULL AND s.id IS NULL
ORDER BY d.created_at DESC;

-- ============================================
-- PARTE 2: ANÁLISIS POR CLIENTE ESPECÍFICO
-- ============================================
-- Reemplazar 'V-15263733' con el documento del cliente que quieres analizar

-- Ventas del cliente
SELECT 
    'VENTAS DEL CLIENTE' AS tipo,
    s.id AS sale_id,
    s.invoice_number,
    s.sold_at,
    s.voided_at,
    s.totals->>'total_usd' AS total_usd,
    s.totals->>'total_bs' AS total_bs,
    s.payment->>'method' AS payment_method
FROM sales s
INNER JOIN customers c ON s.customer_id = c.id
WHERE c.document_id = 'V-15263733'  -- ⚠️ CAMBIAR POR EL DOCUMENTO DEL CLIENTE
ORDER BY s.sold_at DESC;

-- Deudas del cliente
SELECT 
    'DEUDAS DEL CLIENTE' AS tipo,
    d.id AS debt_id,
    d.sale_id,
    d.created_at,
    d.amount_usd::text AS total_usd,
    d.amount_bs::text AS total_bs,
    d.status AS payment_method
FROM debts d
INNER JOIN customers c ON d.customer_id = c.id
WHERE c.document_id = 'V-15263733'  -- ⚠️ CAMBIAR POR EL DOCUMENTO DEL CLIENTE
ORDER BY d.created_at DESC;

-- ============================================
-- PARTE 3: CORREGIR DEUDAS DE VENTAS ANULADAS (SIN PAGOS)
-- ============================================
-- Elimina deudas asociadas a ventas anuladas que no tienen pagos

BEGIN; -- Usar transacción

-- Identificar y eliminar deudas sin pagos de ventas anuladas
WITH debts_to_delete AS (
    SELECT d.id AS debt_id
    FROM debts d
    INNER JOIN sales s ON d.sale_id = s.id
    WHERE 
        s.voided_at IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM debt_payments dp 
            WHERE dp.debt_id = d.id
        )
)
DELETE FROM debt_payments
WHERE debt_id IN (SELECT debt_id FROM debts_to_delete);

WITH debts_to_delete AS (
    SELECT d.id AS debt_id
    FROM debts d
    INNER JOIN sales s ON d.sale_id = s.id
    WHERE 
        s.voided_at IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM debt_payments dp 
            WHERE dp.debt_id = d.id
        )
)
DELETE FROM debts
WHERE id IN (SELECT debt_id FROM debts_to_delete);

-- Verificar resultados
SELECT 
    'Deudas eliminadas' AS status,
    COUNT(*) AS remaining_debts_with_voided_sales
FROM debts d
INNER JOIN sales s ON d.sale_id = s.id
WHERE s.voided_at IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM debt_payments dp WHERE dp.debt_id = d.id);

COMMIT; -- O ROLLBACK; si algo salió mal

-- ============================================
-- PARTE 4: CORREGIR DEUDAS DE VENTAS INEXISTENTES (SIN PAGOS)
-- ============================================
-- Elimina deudas que apuntan a ventas que no existen

BEGIN; -- Usar transacción

WITH debts_to_delete AS (
    SELECT d.id AS debt_id
    FROM debts d
    LEFT JOIN sales s ON d.sale_id = s.id
    WHERE 
        d.sale_id IS NOT NULL
        AND s.id IS NULL  -- Venta no existe
        AND NOT EXISTS (
            SELECT 1 FROM debt_payments dp 
            WHERE dp.debt_id = d.id
        )
)
DELETE FROM debt_payments
WHERE debt_id IN (SELECT debt_id FROM debts_to_delete);

WITH debts_to_delete AS (
    SELECT d.id AS debt_id
    FROM debts d
    LEFT JOIN sales s ON d.sale_id = s.id
    WHERE 
        d.sale_id IS NOT NULL
        AND s.id IS NULL  -- Venta no existe
        AND NOT EXISTS (
            SELECT 1 FROM debt_payments dp 
            WHERE dp.debt_id = d.id
        )
)
DELETE FROM debts
WHERE id IN (SELECT debt_id FROM debts_to_delete);

COMMIT; -- O ROLLBACK; si algo salió mal

-- ============================================
-- PARTE 5: CASO ESPECIAL - DEUDAS CON PAGOS
-- ============================================
-- Si una deuda tiene pagos pero la venta está anulada o no existe,
-- NO se debe eliminar automáticamente. Se debe revisar caso por caso.

-- Ver deudas con pagos de ventas anuladas o inexistentes
SELECT 
    d.id AS debt_id,
    d.sale_id,
    c.name AS customer_name,
    c.document_id,
    d.amount_bs,
    d.amount_usd,
    d.status,
    d.created_at,
    CASE 
        WHEN s.voided_at IS NOT NULL THEN 'Venta anulada'
        WHEN d.sale_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sales s2 WHERE s2.id = d.sale_id) THEN 'Venta no existe'
        ELSE 'OK'
    END AS problema,
    s.voided_at,
    s.void_reason,
    COUNT(dp.id) AS payments_count,
    SUM(dp.amount_bs) AS total_paid_bs,
    SUM(dp.amount_usd) AS total_paid_usd
FROM debts d
LEFT JOIN sales s ON d.sale_id = s.id
LEFT JOIN customers c ON d.customer_id = c.id
LEFT JOIN debt_payments dp ON dp.debt_id = d.id
WHERE 
    (s.voided_at IS NOT NULL OR (d.sale_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sales s2 WHERE s2.id = d.sale_id)))
GROUP BY d.id, d.sale_id, c.name, c.document_id, d.amount_bs, d.amount_usd, 
         d.status, d.created_at, s.voided_at, s.void_reason
HAVING COUNT(dp.id) > 0
ORDER BY d.created_at DESC;

-- Para estas deudas, tienes dos opciones:
-- 
-- OPCIÓN A: Si los pagos fueron errores, eliminar todo
-- BEGIN;
-- DELETE FROM debt_payments WHERE debt_id = 'DEBT_ID_AQUI';
-- DELETE FROM debts WHERE id = 'DEBT_ID_AQUI';
-- COMMIT;
--
-- OPCIÓN B: Si los pagos son válidos, marcar la deuda como pagada
-- UPDATE debts 
-- SET status = 'paid'
-- WHERE id = 'DEBT_ID_AQUI';

-- ============================================
-- PARTE 6: VERIFICACIÓN FINAL POR CLIENTE
-- ============================================
-- Verificar que las deudas y ventas coinciden para un cliente específico

-- Resumen de ventas
SELECT 
    'VENTAS' AS tipo,
    COUNT(*) AS cantidad,
    COALESCE(SUM((s.totals->>'total_usd')::numeric), 0) AS total_usd,
    COALESCE(SUM((s.totals->>'total_bs')::numeric), 0) AS total_bs
FROM sales s
INNER JOIN customers c ON s.customer_id = c.id
WHERE c.document_id = 'V-15263733'  -- ⚠️ CAMBIAR
AND s.voided_at IS NULL;  -- Solo ventas no anuladas

-- Resumen de deudas
SELECT 
    'DEUDAS' AS tipo,
    COUNT(*) AS cantidad,
    COALESCE(SUM(d.amount_usd), 0) AS total_usd,
    COALESCE(SUM(d.amount_bs), 0) AS total_bs
FROM debts d
INNER JOIN customers c ON d.customer_id = c.id
LEFT JOIN sales s ON d.sale_id = s.id
WHERE c.document_id = 'V-15263733'  -- ⚠️ CAMBIAR
AND (s.id IS NULL OR s.voided_at IS NULL)  -- Incluir deudas sin venta o con venta válida
AND NOT EXISTS (
    SELECT 1 FROM debt_payments dp 
    WHERE dp.debt_id = d.id
);  -- Solo deudas sin pagos

-- ============================================
-- NOTAS IMPORTANTES:
-- ============================================
-- 1. Siempre ejecutar PARTE 1 primero para ver el estado completo
-- 2. Usar PARTE 2 para analizar un cliente específico
-- 3. Ejecutar PARTE 3 y 4 para corregir automáticamente (solo deudas sin pagos)
-- 4. Revisar PARTE 5 caso por caso para deudas con pagos
-- 5. Usar PARTE 6 para verificar que todo quedó correcto
-- 6. Siempre usar transacciones (BEGIN/COMMIT/ROLLBACK)
-- 7. Hacer backup antes de ejecutar
