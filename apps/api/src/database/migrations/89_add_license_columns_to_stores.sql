ALTER TABLE stores
ADD COLUMN IF NOT EXISTS license_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS license_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS license_grace_days integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS license_plan text,
ADD COLUMN IF NOT EXISTS license_notes text;
