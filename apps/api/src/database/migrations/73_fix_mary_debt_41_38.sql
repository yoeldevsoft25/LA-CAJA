-- ============================================
-- VERIFICAR VENTA DE LA DEUDA PROBLEMÁTICA
-- ============================================
-- Verificar el estado de la venta asociada a la deuda de $41.38

-- Verificar si la venta existe y su estado
SELECT 
    'ESTADO DE LA VENTA' AS tipo,
    s.id AS sale_id,
    s.invoice_number,
    s.sold_at,
    s.voided_at,
    s.void_reason,
    s.totals->>'total_usd' AS total_usd,
    s.totals->>'total_bs' AS total_bs,
    s.payment->>'method' AS payment_method,
    CASE 
        WHEN s.id IS NULL THEN 'VENTA NO EXISTE'
        WHEN s.voided_at IS NOT NULL THEN 'VENTA ANULADA'
        ELSE 'VENTA VÁLIDA'
    END AS estado
FROM sales s
WHERE s.id = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';  -- sale_id de la deuda problemática

-- Verificar la deuda y sus pagos
SELECT 
    'DEUDA Y PAGOS' AS tipo,
    d.id AS debt_id,
    d.sale_id,
    d.amount_usd,
    d.amount_bs,
    d.status,
    d.created_at,
    COUNT(dp.id) AS payments_count,
    COALESCE(SUM(dp.amount_usd), 0) AS total_paid_usd,
    COALESCE(SUM(dp.amount_bs), 0) AS total_paid_bs
FROM debts d
LEFT JOIN debt_payments dp ON dp.debt_id = d.id
WHERE d.id = 'a17d4e01-fe00-46c3-bc64-878f28a017ad'  -- debt_id de la deuda problemática
GROUP BY d.id, d.sale_id, d.amount_usd, d.amount_bs, d.status, d.created_at;

-- ============================================
-- CORREGIR LA DEUDA PROBLEMÁTICA
-- ============================================
-- Opción 1: Si la venta NO existe o está ANULADA y NO tiene pagos
-- Ejecutar dentro de una transacción

BEGIN;

-- Verificar primero
SELECT 
    d.id AS debt_id,
    d.sale_id,
    CASE 
        WHEN s.id IS NULL THEN 'VENTA NO EXISTE'
        WHEN s.voided_at IS NOT NULL THEN 'VENTA ANULADA'
        ELSE 'VENTA VÁLIDA - NO ELIMINAR'
    END AS estado,
    (SELECT COUNT(*) FROM debt_payments dp WHERE dp.debt_id = d.id) AS payments_count
FROM debts d
LEFT JOIN sales s ON d.sale_id = s.id
WHERE d.id = 'a17d4e01-fe00-46c3-bc64-878f28a017ad';

-- Si el estado es 'VENTA NO EXISTE' o 'VENTA ANULADA' y payments_count = 0:
-- Eliminar pagos primero (por si acaso hay registros huérfanos)
DELETE FROM debt_payments 
WHERE debt_id = 'a17d4e01-fe00-46c3-bc64-878f28a017ad';

-- Eliminar la deuda
DELETE FROM debts 
WHERE id = 'a17d4e01-fe00-46c3-bc64-878f28a017ad';

-- Verificar que se eliminó
SELECT 
    'Verificación' AS status,
    COUNT(*) AS deudas_restantes
FROM debts 
WHERE id = 'a17d4e01-fe00-46c3-bc64-878f28a017ad';

-- Si todo está bien, hacer COMMIT
-- Si hay problemas, hacer ROLLBACK
COMMIT;  -- O ROLLBACK; si algo salió mal
