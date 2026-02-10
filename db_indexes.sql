-- Indexes for faster product search (ILIKE / trigram) and common store/name filtering.
-- Safe to run multiple times due to IF NOT EXISTS.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_store_name
ON public.products (store_id, name);

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
ON public.products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_sku_trgm
ON public.products USING gin (sku gin_trgm_ops)
WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_barcode_trgm
ON public.products USING gin (barcode gin_trgm_ops)
WHERE barcode IS NOT NULL;
