-- ============================================
-- VERIFICACIÓN COMPLETA DEL ESTADO ACTUAL
-- ============================================
-- Verificar el estado real de las deudas de Mary en la base de datos

-- Todas las deudas de Mary con detalles completos
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
    (SELECT COUNT(*) FROM debt_payments dp WHERE dp.debt_id = d.id) AS payments_count
FROM debts d
INNER JOIN customers c ON d.customer_id = c.id
LEFT JOIN sales s ON d.sale_id = s.id
WHERE c.document_id = 'V-15263733'
ORDER BY d.created_at DESC;

-- Verificar si hay eventos DebtCreated que puedan recrear deudas
SELECT 
    'EVENTOS DEBT CREATED' AS tipo,
    COUNT(*) AS cantidad,
    array_agg(event_id) AS event_ids
FROM events
WHERE type = 'DebtCreated'
AND payload->>'sale_id' = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- Verificar todas las deudas asociadas a la venta problemática
SELECT 
    'DEUDAS DE VENTA PROBLEMÁTICA' AS tipo,
    COUNT(*) AS cantidad,
    array_agg(id) AS debt_ids
FROM debts
WHERE sale_id = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- Resumen final
SELECT 
    'RESUMEN FINAL' AS tipo,
    COUNT(*) AS total_deudas,
    COUNT(CASE WHEN s.voided_at IS NOT NULL THEN 1 END) AS deudas_ventas_anuladas,
    COUNT(CASE WHEN d.sale_id IS NOT NULL AND s.id IS NULL THEN 1 END) AS deudas_ventas_inexistentes,
    COUNT(CASE WHEN s.id IS NOT NULL AND s.voided_at IS NULL THEN 1 END) AS deudas_ventas_validas,
    COALESCE(SUM(d.amount_usd), 0) AS total_usd,
    COALESCE(SUM(d.amount_bs), 0) AS total_bs
FROM debts d
INNER JOIN customers c ON d.customer_id = c.id
LEFT JOIN sales s ON d.sale_id = s.id
WHERE c.document_id = 'V-15263733';
