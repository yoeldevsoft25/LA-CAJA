-- ============================================
-- ELIMINACIÓN DEFINITIVA - DEUDA DE $41.38
-- ============================================
-- Script directo para eliminar TODO lo relacionado con la deuda problemática
-- sale_id: 5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb

BEGIN;

-- ============================================
-- PASO 1: IDENTIFICAR TODO LO QUE SE VA A ELIMINAR
-- ============================================

-- Eventos
SELECT 
    'EVENTOS A ELIMINAR' AS tipo,
    COUNT(*) AS cantidad
FROM events
WHERE type = 'DebtCreated'
AND payload->>'sale_id' = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- Deudas
SELECT 
    'DEUDAS A ELIMINAR' AS tipo,
    COUNT(*) AS cantidad,
    array_agg(id) AS debt_ids
FROM debts
WHERE sale_id = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- Pagos de deudas
SELECT 
    'PAGOS A ELIMINAR' AS tipo,
    COUNT(*) AS cantidad
FROM debt_payments
WHERE debt_id IN (
    SELECT id FROM debts 
    WHERE sale_id = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb'
);

-- ============================================
-- PASO 2: ELIMINAR TODO
-- ============================================

-- 1. Eliminar pagos de deudas
DELETE FROM debt_payments
WHERE debt_id IN (
    SELECT id FROM debts 
    WHERE sale_id = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb'
);

-- 2. Eliminar todas las deudas asociadas a esa venta
DELETE FROM debts
WHERE sale_id = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- 3. Eliminar todos los eventos DebtCreated asociados a esa venta
DELETE FROM events
WHERE type = 'DebtCreated'
AND payload->>'sale_id' = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- ============================================
-- PASO 3: VERIFICACIÓN
-- ============================================

-- Verificar eventos
SELECT 
    'EVENTOS RESTANTES' AS tipo,
    COUNT(*) AS cantidad
FROM events
WHERE type = 'DebtCreated'
AND payload->>'sale_id' = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- Verificar deudas
SELECT 
    'DEUDAS RESTANTES' AS tipo,
    COUNT(*) AS cantidad
FROM debts
WHERE sale_id = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- Verificar deudas finales de Mary (deberían ser solo 2: $43.37 + $5.23 = $48.60)
SELECT 
    'DEUDAS FINALES DE MARY' AS tipo,
    COUNT(*) AS cantidad,
    COALESCE(SUM(d.amount_usd), 0) AS total_usd,
    COALESCE(SUM(d.amount_bs), 0) AS total_bs,
    array_agg(d.id) AS debt_ids
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
