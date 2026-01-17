-- Migration: Add credit_limit, email and created_at to customers
-- Date: 2026-01-16
-- Description: Completes Customer entity with credit limit for FIAO control and email

-- Add email field
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL;

-- Add credit_limit field (in USD, as reference currency)
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(18, 2) NULL;

-- Add created_at field
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add index for email searches
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(store_id, email) WHERE email IS NOT NULL;

-- Add index for credit limit checks (customers with credit)
CREATE INDEX IF NOT EXISTS idx_customers_with_credit ON customers(store_id, credit_limit) WHERE credit_limit IS NOT NULL AND credit_limit > 0;

-- Comment on columns
COMMENT ON COLUMN customers.email IS 'Customer email for notifications and invoices';
COMMENT ON COLUMN customers.credit_limit IS 'Maximum credit allowed for FIAO purchases in USD';
COMMENT ON COLUMN customers.created_at IS 'When the customer was first registered';
