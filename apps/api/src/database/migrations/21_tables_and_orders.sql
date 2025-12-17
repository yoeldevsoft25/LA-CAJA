-- ============================================
-- 21. MESAS Y ÓRDENES (CUENTAS ABIERTAS)
-- ============================================
-- Sistema para gestión de mesas y órdenes (restaurantes, talleres, etc.)

-- Tabla de mesas
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  table_number VARCHAR(20) NOT NULL,
  name VARCHAR(100) NULL, -- Nombre opcional: "Mesa VIP", "Barra 1", etc.
  capacity INTEGER NULL, -- Capacidad de la mesa
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning', 'out_of_service')),
  current_order_id UUID NULL, -- Orden activa en la mesa
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, table_number)
);

COMMENT ON TABLE tables IS 'Mesas físicas del establecimiento';
COMMENT ON COLUMN tables.table_number IS 'Número o identificador de la mesa';
COMMENT ON COLUMN tables.status IS 'Estado de la mesa (available, occupied, reserved, cleaning, out_of_service)';
COMMENT ON COLUMN tables.current_order_id IS 'ID de la orden activa en la mesa';

-- Tabla de órdenes (cuentas abiertas)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  table_id UUID NULL REFERENCES tables(id) ON DELETE SET NULL,
  order_number VARCHAR(50) NOT NULL, -- Número de orden único
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paused', 'closed', 'cancelled')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paused_at TIMESTAMPTZ NULL,
  closed_at TIMESTAMPTZ NULL,
  customer_id UUID NULL REFERENCES customers(id) ON DELETE SET NULL,
  opened_by_user_id UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  closed_by_user_id UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE orders IS 'Órdenes o cuentas abiertas (restaurantes, talleres, etc.)';
COMMENT ON COLUMN orders.order_number IS 'Número único de orden';
COMMENT ON COLUMN orders.status IS 'Estado de la orden (open, paused, closed, cancelled)';
COMMENT ON COLUMN orders.table_id IS 'Mesa asociada (NULL si es orden sin mesa)';

-- Tabla de items de orden (similar a sale_items pero para órdenes)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id UUID NULL REFERENCES product_variants(id) ON DELETE SET NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
  unit_price_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  discount_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
  discount_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  note TEXT NULL, -- Nota especial del item (ej: "sin cebolla")
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE order_items IS 'Items de una orden (productos agregados)';
COMMENT ON COLUMN order_items.note IS 'Nota especial del item (ej: "sin cebolla", "bien cocido")';

-- Tabla de pagos parciales (recibos parciales)
CREATE TABLE IF NOT EXISTS order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sale_id UUID NULL REFERENCES sales(id) ON DELETE SET NULL, -- Venta generada por el pago parcial
  amount_bs NUMERIC(18, 2) NOT NULL DEFAULT 0,
  amount_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_by_user_id UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE order_payments IS 'Pagos parciales realizados sobre una orden';
COMMENT ON COLUMN order_payments.sale_id IS 'Venta generada por el pago parcial (si aplica)';

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_tables_store ON tables(store_id);
CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(store_id, status);
CREATE INDEX IF NOT EXISTS idx_tables_current_order ON tables(current_order_id) WHERE current_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id) WHERE table_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_opened_at ON orders(store_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(store_id, order_number);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_order_payments_order ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_sale ON order_payments(sale_id) WHERE sale_id IS NOT NULL;

