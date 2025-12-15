-- Añadir campos de licencia a stores
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS license_status text NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS license_expires_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS license_grace_days integer NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS license_plan text NULL,
ADD COLUMN IF NOT EXISTS license_notes text NULL;

CREATE INDEX IF NOT EXISTS idx_stores_license_expires ON stores(license_expires_at);
