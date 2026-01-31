-- Drop the overly strict constraint
ALTER TABLE license_payments DROP CONSTRAINT IF EXISTS chk_verified_data;

-- Add a corrected constraint that only enforces verified_at presence when status is 'verified',
-- but allows verified_at to remain populated for other statuses (like 'approved').
ALTER TABLE license_payments 
ADD CONSTRAINT chk_verified_data 
CHECK (status <> 'verified' OR verified_at IS NOT NULL);
