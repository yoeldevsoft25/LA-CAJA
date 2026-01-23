-- ============================================
-- 71. CORREGIR DEUDAS DE VENTAS ANULADAS
-- ============================================
-- Este script identifica y corrige deudas que quedaron asociadas
-- a ventas que fueron anuladas pero la deuda no se eliminó correctamente

-- ============================================
-- PARTE 1: IDENTIFICAR DEUDAS HUÉRFANAS
-- ============================================
-- Ejecutar primero para ver qué deudas necesitan corrección

SELECT 
    d.id AS debt_id,
    d.store_id,
    d.sale_id,
    d.customer_id,
    c.name AS customer_name,
    d.amount_bs,
    d.amount_usd,
    d.status,
    d.created_at,
    s.id AS sale_exists,
    s.voided_at,
    s.void_reason,
    (SELECT COUNT(*) FROM debt_payments dp WHERE dp.debt_id = d.id) AS payments_count
FROM debts d
LEFT JOIN sales s ON d.sale_id = s.id
LEFT JOIN customers c ON d.customer_id = c.id
WHERE 
    d.sale_id IS NOT NULL
    AND (
        -- Caso 1: La venta fue anulada (voided_at IS NOT NULL)
        (s.voided_at IS NOT NULL)
        OR
        -- Caso 2: La venta no existe (fue borrada manualmente)
        (s.id IS NULL)
    )
ORDER BY d.created_at DESC;

-- ============================================
-- PARTE 2: CORREGIR DEUDAS DE VENTAS ANULADAS
-- ============================================
-- Este script elimina deudas asociadas a ventas anuladas
-- que no tienen pagos registrados

BEGIN; -- Usar transacción para poder hacer rollback

-- Paso 1: Identificar deudas a eliminar (sin pagos)
WITH debts_to_delete AS (
    SELECT d.id AS debt_id
    FROM debts d
    INNER JOIN sales s ON d.sale_id = s.id
    WHERE 
        s.voided_at IS NOT NULL  -- Venta anulada
        AND d.sale_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM debt_payments dp 
            WHERE dp.debt_id = d.id
        )  -- Sin pagos
)
-- Eliminar pagos de deuda primero (por si acaso hay registros huérfanos)
DELETE FROM debt_payments
WHERE debt_id IN (SELECT debt_id FROM debts_to_delete);

-- Paso 2: Eliminar las deudas
WITH debts_to_delete AS (
    SELECT d.id AS debt_id
    FROM debts d
    INNER JOIN sales s ON d.sale_id = s.id
    WHERE 
        s.voided_at IS NOT NULL  -- Venta anulada
        AND d.sale_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM debt_payments dp 
            WHERE dp.debt_id = d.id
        )  -- Sin pagos
)
DELETE FROM debts
WHERE id IN (SELECT debt_id FROM debts_to_delete);

-- Verificar resultados
SELECT 
    'Deudas eliminadas correctamente' AS status,
    COUNT(*) AS remaining_debts_with_voided_sales
FROM debts d
INNER JOIN sales s ON d.sale_id = s.id
WHERE s.voided_at IS NOT NULL;

-- Si todo está bien, hacer COMMIT
-- Si hay problemas, hacer ROLLBACK
COMMIT; -- O ROLLBACK; si algo salió mal

-- ============================================
-- PARTE 3: CASO ESPECIAL - DEUDAS CON PAGOS
-- ============================================
-- Si una venta anulada tiene deuda con pagos, NO se debe eliminar automáticamente
-- porque los pagos son registros históricos importantes.
-- En este caso, se debe:
-- 1. Reversar los pagos manualmente
-- 2. O marcar la deuda como cancelada/anulada

-- Ver deudas con pagos de ventas anuladas
SELECT 
    d.id AS debt_id,
    d.sale_id,
    c.name AS customer_name,
    d.amount_bs,
    d.amount_usd,
    d.status,
    COUNT(dp.id) AS payments_count,
    SUM(dp.amount_bs) AS total_paid_bs,
    SUM(dp.amount_usd) AS total_paid_usd,
    s.voided_at,
    s.void_reason
FROM debts d
INNER JOIN sales s ON d.sale_id = s.id
LEFT JOIN customers c ON d.customer_id = c.id
LEFT JOIN debt_payments dp ON dp.debt_id = d.id
WHERE 
    s.voided_at IS NOT NULL
    AND d.sale_id IS NOT NULL
GROUP BY d.id, d.sale_id, c.name, d.amount_bs, d.amount_usd, d.status, s.voided_at, s.void_reason
HAVING COUNT(dp.id) > 0
ORDER BY d.created_at DESC;

-- Si necesitas eliminar estas deudas también (después de reversar pagos manualmente):
-- BEGIN;
-- 
-- -- Primero eliminar los pagos
-- DELETE FROM debt_payments
-- WHERE debt_id IN (
--     SELECT d.id
--     FROM debts d
--     INNER JOIN sales s ON d.sale_id = s.id
--     WHERE s.voided_at IS NOT NULL
-- );
-- 
-- -- Luego eliminar las deudas
-- DELETE FROM debts
-- WHERE id IN (
--     SELECT d.id
--     FROM debts d
--     INNER JOIN sales s ON d.sale_id = s.id
--     WHERE s.voided_at IS NOT NULL
-- );
-- 
-- COMMIT;

-- ============================================
-- PARTE 4: VERIFICACIÓN FINAL
-- ============================================
-- Verificar que no quedan deudas huérfanas

SELECT 
    'Verificación final' AS check_type,
    COUNT(*) AS debts_with_voided_sales,
    COUNT(CASE WHEN EXISTS (SELECT 1 FROM debt_payments dp WHERE dp.debt_id = d.id) THEN 1 END) AS debts_with_payments
FROM debts d
INNER JOIN sales s ON d.sale_id = s.id
WHERE s.voided_at IS NOT NULL;

-- ============================================
-- NOTAS IMPORTANTES:
-- ============================================
-- 1. Siempre ejecutar PARTE 1 primero para ver qué se va a afectar
-- 2. Usar transacciones (BEGIN/COMMIT/ROLLBACK) para poder revertir cambios
-- 3. Si hay deudas con pagos, NO eliminar automáticamente - revisar caso por caso
-- 4. Los pagos de deuda son registros históricos importantes
-- 5. Si una venta anulada tiene pagos, probablemente necesites:
--    - Reversar los pagos manualmente
--    - O crear un ajuste contable
--    - O marcar la deuda como cancelada
