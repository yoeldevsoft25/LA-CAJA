-- ============================================
-- SOLUCIÓN DEFINITIVA: ELIMINAR EVENTO DE DEUDA
-- ============================================
-- El problema es que el sistema usa Event Sourcing.
-- Cuando se crea una venta FIAO, se genera un evento DebtCreated.
-- Si borras la deuda manualmente, el evento sigue existiendo y se vuelve a proyectar.
-- 
-- SOLUCIÓN: Eliminar o marcar el evento DebtCreated para que no se vuelva a proyectar.

-- ============================================
-- PARTE 1: IDENTIFICAR EL EVENTO PROBLEMÁTICO
-- ============================================
-- Buscar el evento DebtCreated asociado a la venta anulada

SELECT 
    e.event_id,
    e.seq,
    e.type,
    e.store_id,
    e.created_at,
    e.payload->>'debt_id' AS debt_id_from_event,
    e.payload->>'sale_id' AS sale_id_from_event,
    e.payload->>'customer_id' AS customer_id_from_event,
    e.payload->>'amount_usd' AS amount_usd_from_event
FROM events e
WHERE e.type = 'DebtCreated'
AND e.payload->>'sale_id' = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb'  -- sale_id de la venta anulada
ORDER BY e.created_at DESC;

-- ============================================
-- PARTE 2: ELIMINAR EL EVENTO (SOLUCIÓN DEFINITIVA)
-- ============================================
-- ⚠️ ADVERTENCIA: Eliminar eventos puede afectar la integridad del event store
-- Solo hacer esto si estás seguro de que el evento es incorrecto

BEGIN;

-- Verificar primero cuántos eventos hay
SELECT 
    'EVENTOS ANTES' AS tipo,
    COUNT(*) AS cantidad
FROM events
WHERE type = 'DebtCreated'
AND payload->>'sale_id' = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- Eliminar el evento DebtCreated asociado a la venta anulada
DELETE FROM events
WHERE type = 'DebtCreated'
AND payload->>'sale_id' = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- Verificar que se eliminó
SELECT 
    'EVENTOS DESPUÉS' AS tipo,
    COUNT(*) AS cantidad
FROM events
WHERE type = 'DebtCreated'
AND payload->>'sale_id' = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- Eliminar todas las deudas asociadas a esa venta (por si acaso se recrean)
DELETE FROM debt_payments
WHERE debt_id IN (
    SELECT id FROM debts 
    WHERE sale_id = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb'
);

DELETE FROM debts
WHERE sale_id = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

-- Verificar que no quedan deudas
SELECT 
    'DEUDAS RESTANTES' AS tipo,
    COUNT(*) AS cantidad
FROM debts
WHERE sale_id = '5d36dcc5-9710-41ad-8b4c-9c4b0b4bc5cb';

COMMIT;  -- O ROLLBACK; si algo salió mal

-- ============================================
-- PARTE 3: VERIFICACIÓN FINAL
-- ============================================
-- Verificar que no quedan deudas problemáticas de Mary

SELECT 
    'VERIFICACIÓN FINAL' AS tipo,
    COUNT(*) AS deudas_problematicas
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
    'RESUMEN FINAL MARY' AS tipo,
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

-- ============================================
-- NOTAS IMPORTANTES:
-- ============================================
-- 1. Eliminar eventos del event store es una operación delicada
-- 2. Esto rompe la integridad del event store, pero es necesario para corregir el problema
-- 3. Después de esto, la deuda NO se volverá a crear porque el evento ya no existe
-- 4. Si necesitas mantener el historial de eventos, considera crear un evento DebtCancelled
--    en lugar de eliminar el DebtCreated
