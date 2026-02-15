-- Fix Projection Gap for Event 18a9c2f8-1fad-409c-911d-7d942519c4d5
-- This event failed with a timeout. We will reset it to 'pending' to trigger a retry.

BEGIN;

UPDATE events 
SET 
    projection_status = 'pending',
    projection_error = NULL
WHERE event_id = '18a9c2f8-1fad-409c-911d-7d942519c4d5';

-- Verify the update
SELECT event_id, type, projection_status
FROM events 
WHERE event_id = '18a9c2f8-1fad-409c-911d-7d942519c4d5';

COMMIT;
