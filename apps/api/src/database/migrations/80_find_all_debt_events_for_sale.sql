-- ============================================
-- ENCONTRAR TODOS LOS EVENTOS DE DEUDA PARA LA VENTA
-- ============================================
-- Buscar todos los eventos DebtCreated asociados a la venta anulada

SELECT 
    e.event_id,
    e.seq,
    e.type,
    e.store_id,
    e.device_id,
    e.created_at,
    e.received_at,
    e.payload->>'debt_id' AS debt_id_from_event,
    e.payload->>'sale_id' AS sale_id_from_event,
    e.payload->>'customer_id' AS customer_id_from_event,
    e.payload->>'amount_usd' AS amount_usd_from_event,
    e.payload->>'amount_bs' AS amount_bs_from_event
FROM events e
WHERE e.type = 'DebtCreated'
AND e.payload->>'sale_id' = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb'  -- sale_id de la venta anulada
ORDER BY e.created_at DESC;

-- Verificar todas las deudas asociadas a esa venta
SELECT 
    d.id AS debt_id,
    d.sale_id,
    d.amount_usd,
    d.amount_bs,
    d.status,
    d.created_at,
    (SELECT COUNT(*) FROM debt_payments dp WHERE dp.debt_id = d.id) AS payments_count
FROM debts d
WHERE d.sale_id = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb'
ORDER BY d.created_at DESC;

-- ============================================
-- ELIMINAR TODOS LOS EVENTOS Y DEUDAS
-- ============================================
-- Eliminar TODOS los eventos DebtCreated y TODAS las deudas asociadas

BEGIN;

-- Paso 1: Ver cuántos eventos hay
SELECT 
    'EVENTOS ANTES' AS tipo,
    COUNT(*) AS cantidad,
    array_agg(events.event_id) AS event_ids
FROM events
WHERE type = 'DebtCreated'
AND payload->>'sale_id' = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- Paso 2: Eliminar TODOS los eventos DebtCreated asociados a esa venta
DELETE FROM events
WHERE type = 'DebtCreated'
AND payload->>'sale_id' = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- Paso 3: Verificar que se eliminaron
SELECT 
    'EVENTOS DESPUÉS' AS tipo,
    COUNT(*) AS cantidad
FROM events
WHERE type = 'DebtCreated'
AND payload->>'sale_id' = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- Paso 4: Eliminar TODOS los pagos de deudas asociadas a esa venta
DELETE FROM debt_payments
WHERE debt_id IN (
    SELECT id FROM debts 
    WHERE sale_id = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb'
);

-- Paso 5: Eliminar TODAS las deudas asociadas a esa venta
DELETE FROM debts
WHERE sale_id = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- Paso 6: Verificar que no quedan deudas
SELECT 
    'DEUDAS RESTANTES' AS tipo,
    COUNT(*) AS cantidad
FROM debts
WHERE sale_id = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- Paso 7: Verificar deudas finales de Mary
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
