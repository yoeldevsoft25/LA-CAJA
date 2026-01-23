-- ============================================
-- ELIMINAR DEUDA DUPLICADA DE MARY
-- ============================================
-- Eliminar la deuda duplicada de $41.38
-- debt_id: 986a2217-254e-4995-bf45-70ee71c6bfae
-- sale_id: 5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb

BEGIN;

-- Verificar primero el estado de la venta y la deuda
SELECT 
    'VERIFICACIÓN PREVIA' AS tipo,
    d.id AS debt_id,
    d.sale_id,
    d.amount_usd,
    d.amount_bs,
    s.id AS sale_exists,
    s.voided_at,
    CASE 
        WHEN s.id IS NULL THEN 'VENTA NO EXISTE'
        WHEN s.voided_at IS NOT NULL THEN 'VENTA ANULADA'
        ELSE 'VENTA VÁLIDA'
    END AS estado_venta,
    (SELECT COUNT(*) FROM debt_payments dp WHERE dp.debt_id = d.id) AS payments_count
FROM debts d
LEFT JOIN sales s ON d.sale_id = s.id
WHERE d.id = '986a2217-254e-4995-bf45-70ee71c6bfae';

-- Eliminar pagos primero (por si acaso hay registros huérfanos)
DELETE FROM debt_payments 
WHERE debt_id = '986a2217-254e-4995-bf45-70ee71c6bfae';

-- Eliminar la deuda
DELETE FROM debts 
WHERE id = '986a2217-254e-4995-bf45-70ee71c6bfae';

-- Verificar que se eliminó
SELECT 
    'VERIFICACIÓN POST-ELIMINACIÓN' AS tipo,
    COUNT(*) AS deudas_restantes
FROM debts 
WHERE id = '986a2217-254e-4995-bf45-70ee71c6bfae';

-- Verificar deudas finales de Mary
SELECT 
    'DEUDAS FINALES DE MARY' AS tipo,
    COUNT(*) AS cantidad,
    COALESCE(SUM(d.amount_usd), 0) AS total_usd,
    COALESCE(SUM(d.amount_bs), 0) AS total_bs
FROM debts d
INNER JOIN customers c ON d.customer_id = c.id
LEFT JOIN sales s ON d.sale_id = s.id
WHERE c.document_id = 'V-15263733'
AND (s.id IS NULL OR s.voided_at IS NULL)
AND NOT EXISTS (
    SELECT 1 FROM debt_payments dp 
    WHERE dp.debt_id = d.id
);

COMMIT;  -- O ROLLBACK; si algo salió mal
