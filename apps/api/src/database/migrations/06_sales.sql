-- Migration: Sales y Sale Items
-- Sprint 4: POS ultra rápido

-- Tabla de ventas
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    cash_session_id UUID NULL,
    sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 0,
    currency VARCHAR(20) NOT NULL CHECK (currency IN ('BS', 'USD', 'MIXED')),
    totals JSONB NOT NULL,
    payment JSONB NOT NULL,
    customer_id UUID NULL,
    note TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para sales
CREATE INDEX IF NOT EXISTS idx_sales_store_id ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON sales(sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_cash_session_id ON sales(cash_session_id) WHERE cash_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id) WHERE customer_id IS NOT NULL;

-- Tabla de items de venta
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    qty INTEGER NOT NULL CHECK (qty > 0),
    unit_price_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
    unit_price_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
    discount_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
    discount_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para sale_items
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

-- Comentarios
COMMENT ON TABLE sales IS 'Ventas realizadas en el POS';
COMMENT ON TABLE sale_items IS 'Items individuales de cada venta';
COMMENT ON COLUMN sales.totals IS 'JSON con subtotales, descuentos y totales en BS y USD';
COMMENT ON COLUMN sales.payment IS 'JSON con método de pago y detalles (split, etc)';
COMMENT ON COLUMN sale_items.unit_price_bs IS 'Precio unitario en BS al momento de la venta';
COMMENT ON COLUMN sale_items.unit_price_usd IS 'Precio unitario en USD al momento de la venta';
