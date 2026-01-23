-- ============================================
-- ENCONTRAR ÚLTIMA DEUDA PROBLEMÁTICA
-- ============================================
-- Identificar exactamente cuál es la deuda problemática que queda

-- Todas las deudas de Mary con su estado
SELECT 
    d.id AS debt_id,
    d.sale_id,
    d.amount_usd,
    d.amount_bs,
    d.status,
    d.created_at,
    s.id AS sale_exists,
    s.voided_at,
    s.void_reason,
    CASE 
        WHEN s.voided_at IS NOT NULL THEN 'Venta anulada'
        WHEN d.sale_id IS NOT NULL AND s.id IS NULL THEN 'Venta no existe'
        WHEN s.id IS NOT NULL AND s.voided_at IS NULL THEN 'Venta válida'
        ELSE 'Sin venta asociada'
    END AS estado_venta,
    (SELECT COUNT(*) FROM debt_payments dp WHERE dp.debt_id = d.id) AS payments_count,
    CASE 
        WHEN (s.voided_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM debt_payments dp WHERE dp.debt_id = d.id)) THEN 'PROBLEMÁTICA - Anular'
        WHEN (d.sale_id IS NOT NULL AND s.id IS NULL AND NOT EXISTS (SELECT 1 FROM debt_payments dp WHERE dp.debt_id = d.id)) THEN 'PROBLEMÁTICA - Anular'
        ELSE 'OK'
    END AS accion
FROM debts d
INNER JOIN customers c ON d.customer_id = c.id
LEFT JOIN sales s ON d.sale_id = s.id
WHERE c.document_id = 'V-15263733'
ORDER BY d.created_at DESC;

-- Solo las deudas problemáticas
SELECT 
    d.id AS debt_id,
    d.sale_id,
    d.amount_usd,
    d.amount_bs,
    d.created_at,
    CASE 
        WHEN s.voided_at IS NOT NULL THEN 'Venta anulada'
        WHEN d.sale_id IS NOT NULL AND s.id IS NULL THEN 'Venta no existe'
        ELSE 'Otro problema'
    END AS problema
FROM debts d
INNER JOIN customers c ON d.customer_id = c.id
LEFT JOIN sales s ON d.sale_id = s.id
WHERE c.document_id = 'V-15263733'
AND (
    (s.voided_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM debt_payments dp WHERE dp.debt_id = d.id))
    OR
    (d.sale_id IS NOT NULL AND s.id IS NULL AND NOT EXISTS (SELECT 1 FROM debt_payments dp WHERE dp.debt_id = d.id))
)
ORDER BY d.created_at DESC;
