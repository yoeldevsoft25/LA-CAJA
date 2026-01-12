ALTER TABLE sale_items
  ALTER COLUMN qty TYPE numeric(18, 3) USING qty::numeric;

ALTER TABLE inventory_movements
  ALTER COLUMN qty_delta TYPE numeric(18, 3) USING qty_delta::numeric;

ALTER TABLE warehouse_stock
  ALTER COLUMN stock TYPE numeric(18, 3) USING stock::numeric,
  ALTER COLUMN reserved TYPE numeric(18, 3) USING reserved::numeric;

ALTER TABLE product_lots
  ALTER COLUMN initial_quantity TYPE numeric(18, 3) USING initial_quantity::numeric,
  ALTER COLUMN remaining_quantity TYPE numeric(18, 3) USING remaining_quantity::numeric;

ALTER TABLE lot_movements
  ALTER COLUMN qty_delta TYPE numeric(18, 3) USING qty_delta::numeric;

ALTER TABLE fiscal_invoice_items
  ALTER COLUMN quantity TYPE numeric(18, 3) USING quantity::numeric;
