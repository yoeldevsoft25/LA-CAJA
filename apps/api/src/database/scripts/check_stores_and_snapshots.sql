-- check_stores_and_snapshots.sql

-- 1. List all stores to confirm UUIDs
SELECT id, name, created_at FROM stores;

-- 2. Check latest health snapshots for the suspicion store
SELECT 
    id, 
    store_id, 
    overall_health, 
    projection_gap_count, 
    snapshot_at 
FROM federation_health_snapshots 
WHERE store_id::text LIKE '89c07cf6%'
ORDER BY snapshot_at DESC 
LIMIT 5;
