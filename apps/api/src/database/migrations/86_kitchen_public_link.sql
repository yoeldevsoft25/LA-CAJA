-- Add public kitchen access token to stores
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS kitchen_public_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_kitchen_public_token
  ON stores (kitchen_public_token)
  WHERE kitchen_public_token IS NOT NULL;
