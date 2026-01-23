-- ============================================
-- VERIFICACIÓN FINAL - DEUDAS DE MARY
-- ============================================
-- Verificar que las deudas de Mary están correctas después de la corrección

-- Resumen de ventas de Mary (solo no anuladas)
SELECT 
    'VENTAS VÁLIDAS' AS tipo,
    COUNT(*) AS cantidad,
    COALESCE(SUM((s.totals->>'total_usd')::numeric), 0) AS total_usd,
    COALESCE(SUM((s.totals->>'total_bs')::numeric), 0) AS total_bs
FROM sales s
INNER JOIN customers c ON s.customer_id = c.id
WHERE c.document_id = 'V-15263733'
AND s.voided_at IS NULL;

-- Resumen de deudas de Mary (solo válidas, sin pagos)
SELECT 
    'DEUDAS VÁLIDAS' AS tipo,
    COUNT(*) AS cantidad,
    COALESCE(SUM(d.amount_usd), 0) AS total_usd,
    COALESCE(SUM(d.amount_bs), 0) AS total_bs
FROM debts d
INNER JOIN customers c ON d.customer_id = c.id
LEFT JOIN sales s ON d.sale_id = s.id
WHERE c.document_id = 'V-15263733'
AND (s.id IS NULL OR s.voided_at IS NULL)  -- Incluir deudas sin venta o con venta válida
AND NOT EXISTS (
    SELECT 1 FROM debt_payments dp 
    WHERE dp.debt_id = d.id
);  -- Solo deudas sin pagos

-- Lista detallada de deudas restantes
SELECT 
    d.id AS debt_id,
    d.sale_id,
    d.amount_usd,
    d.amount_bs,
    d.status,
    d.created_at,
    s.voided_at,
    CASE 
        WHEN s.id IS NULL THEN 'Sin venta asociada'
        WHEN s.voided_at IS NOT NULL THEN 'Venta anulada'
        ELSE 'OK'
    END AS estado_venta
FROM debts d
INNER JOIN customers c ON d.customer_id = c.id
LEFT JOIN sales s ON d.sale_id = s.id
WHERE c.document_id = 'V-15263733'
ORDER BY d.created_at DESC;

-- Verificar que no quedan deudas problemáticas
SELECT 
    'DEUDAS PROBLEMÁTICAS' AS tipo,
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
