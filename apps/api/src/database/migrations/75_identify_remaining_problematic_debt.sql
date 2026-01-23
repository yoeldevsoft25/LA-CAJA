-- ============================================
-- IDENTIFICAR DEUDA PROBLEMÁTICA RESTANTE
-- ============================================
-- Identificar exactamente cuál es la deuda problemática que queda

-- Deuda problemática de Mary
SELECT 
    d.id AS debt_id,
    d.sale_id,
    c.name AS customer_name,
    c.document_id,
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
        ELSE 'OK'
    END AS problema,
    (SELECT COUNT(*) FROM debt_payments dp WHERE dp.debt_id = d.id) AS payments_count
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

-- ============================================
-- CORREGIR LA DEUDA PROBLEMÁTICA RESTANTE
-- ============================================
-- Ejecutar después de identificar la deuda

BEGIN;

-- Reemplazar 'DEBT_ID_AQUI' con el debt_id de la consulta anterior
-- Primero verificar
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
WHERE d.id = 'DEBT_ID_AQUI';  -- ⚠️ CAMBIAR POR EL ID REAL

-- Si el estado es 'VENTA NO EXISTE' o 'VENTA ANULADA' y payments_count = 0:
-- Eliminar pagos primero
DELETE FROM debt_payments 
WHERE debt_id = 'DEBT_ID_AQUI';  -- ⚠️ CAMBIAR POR EL ID REAL

-- Eliminar la deuda
DELETE FROM debts 
WHERE id = 'DEBT_ID_AQUI';  -- ⚠️ CAMBIAR POR EL ID REAL

-- Verificar que se eliminó
SELECT 
    'Verificación' AS status,
    COUNT(*) AS deudas_restantes
FROM debts 
WHERE id = 'DEBT_ID_AQUI';  -- ⚠️ CAMBIAR POR EL ID REAL

COMMIT;  -- O ROLLBACK; si algo salió mal
