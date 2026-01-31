-- Migration: Change audit columns to text to support 'system'
-- Date: 2026-01-30

DO $$ 
BEGIN
    -- 1. Drop Foreign Key Constraints
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'license_payments_verified_by_fkey') THEN
        ALTER TABLE license_payments DROP CONSTRAINT license_payments_verified_by_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'license_payments_approved_by_fkey') THEN
        ALTER TABLE license_payments DROP CONSTRAINT license_payments_approved_by_fkey;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'license_payments_rejected_by_fkey') THEN
        ALTER TABLE license_payments DROP CONSTRAINT license_payments_rejected_by_fkey;
    END IF;

    -- 2. Alter Columns type to VARCHAR
    ALTER TABLE license_payments 
    ALTER COLUMN verified_by TYPE VARCHAR(100),
    ALTER COLUMN approved_by TYPE VARCHAR(100),
    ALTER COLUMN rejected_by TYPE VARCHAR(100);

END $$;
