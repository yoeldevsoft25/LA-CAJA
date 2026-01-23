-- ============================================
-- ELIMINAR ÚLTIMA DEUDA DUPLICADA DE MARY
-- ============================================
-- Eliminar la deuda duplicada de $41.38 asociada a venta anulada
-- debt_id: c1be33cd-b553-41d1-a43f-23618d50bcab
-- sale_id: 5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb

BEGIN;

-- Verificar primero el estado
SELECT 
    'VERIFICACIÓN PREVIA' AS tipo,
    d.id AS debt_id,
    d.sale_id,
    d.amount_usd,
    d.amount_bs,
    s.voided_at,
    s.void_reason,
    (SELECT COUNT(*) FROM debt_payments dp WHERE dp.debt_id = d.id) AS payments_count
FROM debts d
LEFT JOIN sales s ON d.sale_id = s.id
WHERE d.id = 'c1be33cd-b553-41d1-a43f-23618d50bcab';

-- Eliminar pagos primero (por si acaso hay registros huérfanos)
DELETE FROM debt_payments 
WHERE debt_id = 'c1be33cd-b553-41d1-a43f-23618d50bcab';

-- Eliminar la deuda
DELETE FROM debts 
WHERE id = 'c1be33cd-b553-41d1-a43f-23618d50bcab';

-- Verificar que se eliminó
SELECT 
    'VERIFICACIÓN POST-ELIMINACIÓN' AS tipo,
    COUNT(*) AS deudas_restantes
FROM debts 
WHERE id = 'c1be33cd-b553-41d1-a43f-23618d50bcab';

-- Verificar que no quedan más deudas problemáticas
SELECT 
    'DEUDAS PROBLEMÁTICAS RESTANTES' AS tipo,
    COUNT(*) AS cantidad
FROM debts d
INNER JOIN customers c ON d.customer_id = c.id
LEFT JOIN sales s ON d.sale_id = s.id
WHERE c.document_id = 'V-15263733'
AND (
    (s.voided_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM debt_payments dp WHERE dp.debt_id = d.id))
    OR
    (d.sale_id IS NOT NULL AND s.id IS NULL AND NOT EXISTS (SELECT 1 FROM debt_payments dp WHERE dp.debt_id = d.id))
);

-- Resumen final de deudas de Mary
SELECT 
    'RESUMEN FINAL' AS tipo,
    COUNT(*) AS cantidad_deudas,
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
