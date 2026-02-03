-- =====================================================
-- D20260203105400__seed_partitioning_metadata
-- =====================================================
-- Seed initial metadata for events partitioning
-- =====================================================

INSERT INTO partitioning_meta (process_key, metadata) 
VALUES ('events_to_events_p', '{"batch_size": 5000}')
ON CONFLICT (process_key) DO NOTHING;

-- Verification
SELECT 'Partitioning metadata seeded' AS status;
