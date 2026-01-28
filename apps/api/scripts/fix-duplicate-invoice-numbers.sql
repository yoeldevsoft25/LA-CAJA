-- Migration Script: Fix Duplicate Invoice Numbers
-- Problem: Multiple sales have invoice_full_number = 'FAC-000001'
-- Solution: Reassign sequential numbers starting from where the series left off

-- Step 1: Identify all sales with duplicate invoice numbers
-- This query shows how many sales have each invoice number
SELECT 
    invoice_full_number, 
    COUNT(*) as count,
    MIN(sold_at) as first_sale,
    MAX(sold_at) as last_sale
FROM sales
WHERE invoice_full_number IS NOT NULL
GROUP BY invoice_full_number
HAVING COUNT(*) > 1
ORDER BY count DESC, first_sale;

-- Step 2: Get the current max number from the series
SELECT 
    id,
    series_code,
    prefix,
    current_number,
    start_number
FROM invoice_series
WHERE is_active = true
ORDER BY created_at ASC
LIMIT 1;

-- Step 3: Fix duplicate sales by reassigning sequential numbers
-- This will update all sales with 'FAC-000001' to have unique numbers
-- starting from the next available number in the series

-- IMPORTANT: Run this in a transaction and verify before committing!
BEGIN;

-- Create a temporary table with the sales that need new numbers
CREATE TEMP TABLE sales_to_fix AS
SELECT 
    id,
    sold_at,
    invoice_full_number,
    ROW_NUMBER() OVER (ORDER BY sold_at ASC) as row_num
FROM sales
WHERE invoice_full_number = 'FAC-000001'  -- or whatever the duplicate number is
ORDER BY sold_at ASC;

-- Get the current series info
DO $$
DECLARE
    v_series_id UUID;
    v_series_code TEXT;
    v_prefix TEXT;
    v_current_number INT;
    v_start_number INT;
    v_next_number INT;
    v_sale_record RECORD;
    v_new_invoice_number TEXT;
    v_new_full_number TEXT;
BEGIN
    -- Get the active series
    SELECT id, series_code, prefix, current_number, start_number
    INTO v_series_id, v_series_code, v_prefix, v_current_number, v_start_number
    FROM invoice_series
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Start from current_number + 1 (or start_number if current is 0)
    v_next_number := COALESCE(v_current_number, v_start_number, 1) + 1;
    
    RAISE NOTICE 'Starting reassignment from number: %', v_next_number;
    RAISE NOTICE 'Series: % (prefix: %)', v_series_code, v_prefix;
    
    -- Loop through each sale that needs fixing
    FOR v_sale_record IN 
        SELECT id, sold_at FROM sales_to_fix ORDER BY row_num
    LOOP
        -- Generate new invoice number
        v_new_invoice_number := LPAD(v_next_number::TEXT, 6, '0');
        
        -- Generate full number with prefix
        IF v_prefix IS NOT NULL AND v_prefix != '' THEN
            v_new_full_number := v_prefix || '-' || v_series_code || '-' || v_new_invoice_number;
        ELSE
            v_new_full_number := v_series_code || '-' || v_new_invoice_number;
        END IF;
        
        -- Update the sale
        UPDATE sales
        SET 
            invoice_number = v_new_invoice_number,
            invoice_full_number = v_new_full_number,
            invoice_series_id = v_series_id
        WHERE id = v_sale_record.id;
        
        RAISE NOTICE 'Updated sale % (sold_at: %) to %', 
            v_sale_record.id, v_sale_record.sold_at, v_new_full_number;
        
        -- Increment for next sale
        v_next_number := v_next_number + 1;
    END LOOP;
    
    -- Update the series current_number to reflect the last assigned number
    UPDATE invoice_series
    SET 
        current_number = v_next_number - 1,
        updated_at = NOW()
    WHERE id = v_series_id;
    
    RAISE NOTICE 'Updated series current_number to: %', v_next_number - 1;
END $$;

-- Verify the changes
SELECT 
    id,
    sold_at,
    invoice_full_number,
    invoice_number
FROM sales
WHERE id IN (SELECT id FROM sales_to_fix)
ORDER BY sold_at ASC;

-- If everything looks good, COMMIT
-- If not, ROLLBACK
-- COMMIT;
-- ROLLBACK;
