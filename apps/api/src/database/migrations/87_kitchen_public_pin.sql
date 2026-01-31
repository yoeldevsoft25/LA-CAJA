-- Add optional PIN for public kitchen link
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS kitchen_public_pin_hash TEXT;
