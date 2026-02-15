-- Diagnostic Query for Projection Gaps

-- 1. Check for Sale Gaps
SELECT 
    'SaleGap' as gap_type,
    e.event_id, 
    e.store_id, 
    e.type, 
    e.created_at, 
    e.payload->>'sale_id' as sale_id,
    e.projection_status,
    e.projection_error
FROM events e
LEFT JOIN sales s ON s.id = (e.payload->>'sale_id')::uuid
WHERE e.store_id = '89c07cf6-a02f-4afe-adc8-896f8bae6187'
  AND e.type = 'SaleCreated'
  AND e.created_at < NOW() - INTERVAL '1 minute'
  AND e.projection_status IN ('processed', 'failed')
  AND s.id IS NULL;

-- 2. Check for Debt Gaps
SELECT 
    'DebtGap' as gap_type,
    e.event_id, 
    e.store_id, 
    e.type, 
    e.created_at, 
    e.payload->>'debt_id' as debt_id,
    e.projection_status,
    e.projection_error
FROM events e
LEFT JOIN debts d ON d.id = (e.payload->>'debt_id')::uuid
WHERE e.store_id = '89c07cf6-a02f-4afe-adc8-896f8bae6187'
  AND e.type = 'DebtCreated'
  AND e.created_at < NOW() - INTERVAL '1 minute'
  AND e.projection_status IN ('processed', 'failed')
  AND d.id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM debts d2
    WHERE d2.store_id = e.store_id
    AND d2.sale_id = (e.payload->>'sale_id')::uuid
  );
