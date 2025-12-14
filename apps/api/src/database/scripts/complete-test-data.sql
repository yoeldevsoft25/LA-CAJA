-- ============================================================================
-- Script Completo de Datos de Prueba para LA CAJA
-- Ejecuta este script en Supabase SQL Editor para crear todos los datos
-- ============================================================================

-- ============================================================================
-- 1. TIENDA
-- ============================================================================
INSERT INTO stores (id, name, created_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Supermercado La Caja',
  NOW() - INTERVAL '30 days'
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ============================================================================
-- 2. PERFILES (Usuarios)
-- ============================================================================
INSERT INTO profiles (id, full_name, created_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Carlos Rodríguez - Dueño', NOW() - INTERVAL '30 days'),
  ('22222222-2222-2222-2222-222222222222', 'María González - Cajera', NOW() - INTERVAL '25 days'),
  ('33333333-3333-3333-3333-333333333333', 'José Martínez - Cajero', NOW() - INTERVAL '20 days')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- ============================================================================
-- 3. MIEMBROS DE LA TIENDA
-- ============================================================================
INSERT INTO store_members (store_id, user_id, role, pin_hash, created_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'owner', NULL, NOW() - INTERVAL '30 days'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'cashier', '$2b$10$7mzvb3IUc/4XNZDHbNHrdu5s/lEKx2sf4yKZ1eEILxa0u/AdbKr7O', NOW() - INTERVAL '25 days'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'cashier', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', NOW() - INTERVAL '20 days')
ON CONFLICT (store_id, user_id) DO UPDATE 
SET role = EXCLUDED.role, pin_hash = EXCLUDED.pin_hash;

-- ============================================================================
-- 4. PRODUCTOS
-- ============================================================================
INSERT INTO products (id, store_id, name, category, sku, barcode, price_bs, price_usd, cost_bs, cost_usd, low_stock_threshold, is_active, updated_at)
VALUES 
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Coca Cola 2L', 'Bebidas', 'COC-2L', '7801234567890', 15.50, 0.50, 12.00, 0.40, 10, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Pepsi 2L', 'Bebidas', 'PEP-2L', '7801234567891', 14.50, 0.48, 11.50, 0.38, 10, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Agua Cristal 1.5L', 'Bebidas', 'AC-1.5L', '7801234567892', 8.00, 0.27, 6.00, 0.20, 20, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Jugo Hit 1L', 'Bebidas', 'HIT-1L', '7801234567893', 12.00, 0.40, 9.50, 0.32, 15, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Arroz 1kg', 'Alimentos', 'ARR-1KG', '7801234567894', 18.00, 0.60, 14.00, 0.47, 25, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Azúcar 1kg', 'Alimentos', 'AZU-1KG', '7801234567895', 12.50, 0.42, 9.50, 0.32, 20, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Harina PAN 1kg', 'Alimentos', 'HP-1KG', '7801234567896', 10.00, 0.33, 7.50, 0.25, 30, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Aceite 1L', 'Alimentos', 'ACE-1L', '7801234567897', 25.00, 0.83, 19.00, 0.63, 15, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Pasta 500g', 'Alimentos', 'PAS-500G', '7801234567898', 8.50, 0.28, 6.50, 0.22, 40, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Leche 1L', 'Lácteos', 'LEC-1L', '7801234567899', 22.00, 0.73, 17.00, 0.57, 20, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Queso Blanco 500g', 'Lácteos', 'QUE-500G', '7801234567900', 35.00, 1.17, 28.00, 0.93, 10, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Mantequilla 250g', 'Lácteos', 'MAN-250G', '7801234567901', 28.00, 0.93, 22.00, 0.73, 15, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Doritos 150g', 'Snacks', 'DOR-150G', '7801234567902', 18.00, 0.60, 14.00, 0.47, 30, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Galletas María 400g', 'Snacks', 'GAL-400G', '7801234567903', 15.00, 0.50, 11.50, 0.38, 25, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Chicles Trident', 'Snacks', 'CHI-UNIT', '7801234567904', 5.00, 0.17, 3.50, 0.12, 50, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Detergente 1kg', 'Limpieza', 'DET-1KG', '7801234567905', 32.00, 1.07, 25.00, 0.83, 15, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Cloro 1L', 'Limpieza', 'CLO-1L', '7801234567906', 12.00, 0.40, 9.00, 0.30, 20, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Papel Higiénico x4', 'Limpieza', 'PH-4', '7801234567907', 45.00, 1.50, 35.00, 1.17, 10, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Jabón de Baño', 'Limpieza', 'JAB-UNIT', '7801234567908', 8.00, 0.27, 5.50, 0.18, 30, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Shampoo 400ml', 'Higiene', 'SHA-400ML', '7801234567909', 28.00, 0.93, 22.00, 0.73, 15, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Crema Dental', 'Higiene', 'CRE-UNIT', '7801234567910', 18.00, 0.60, 14.00, 0.47, 20, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Desodorante', 'Higiene', 'DES-UNIT', '7801234567911', 22.00, 0.73, 17.00, 0.57, 15, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Pollo 1kg', 'Carnes', 'POL-1KG', '7801234567912', 45.00, 1.50, 38.00, 1.27, 10, true, NOW()),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Carne Molida 500g', 'Carnes', 'CAR-500G', '7801234567913', 55.00, 1.83, 46.00, 1.53, 8, true, NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. CLIENTES
-- ============================================================================
INSERT INTO customers (id, store_id, name, phone, note, updated_at)
VALUES 
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Ana López', '0412-1234567', 'Cliente frecuente, paga bien', NOW() - INTERVAL '20 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Pedro Sánchez', '0414-2345678', 'Vive cerca de la tienda', NOW() - INTERVAL '18 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Carmen Rojas', '0424-3456789', 'Tiene fiao pendiente', NOW() - INTERVAL '15 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Luis Torres', '0416-4567890', 'Cliente nuevo', NOW() - INTERVAL '10 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Rosa Mendez', '0426-5678901', 'Prefiere productos orgánicos', NOW() - INTERVAL '8 days'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Miguel Herrera', '0412-6789012', 'Compra al por mayor ocasionalmente', NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. MOVIMIENTOS DE INVENTARIO (Stock inicial)
-- ============================================================================
DO $$
DECLARE
  product RECORD;
  v_store_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  FOR product IN SELECT id, cost_bs, cost_usd FROM products WHERE store_id = v_store_id
  LOOP
    INSERT INTO inventory_movements (id, store_id, product_id, movement_type, qty_delta, unit_cost_bs, unit_cost_usd, note, happened_at)
    VALUES (
      gen_random_uuid(),
      v_store_id,
      product.id,
      'received',
      CASE 
        WHEN product.cost_bs < 15 THEN 100
        WHEN product.cost_bs < 30 THEN 50
        ELSE 25
      END,
      product.cost_bs,
      product.cost_usd,
      'Stock inicial',
      NOW() - INTERVAL '25 days'
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================================
-- 7. SESIÓN DE CAJA (Abierta)
-- ============================================================================
INSERT INTO cash_sessions (id, store_id, opened_by, opened_at, opening_amount_bs, opening_amount_usd, closed_by, closed_at, expected, counted, note)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  NOW() - INTERVAL '2 hours',
  500.00,
  20.00,
  NULL,
  NULL,
  NULL,
  NULL,
  'Sesión del día de hoy'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. VENTAS DE EJEMPLO
-- ============================================================================
DO $$
DECLARE
  v_store_id UUID := '11111111-1111-1111-1111-111111111111';
  v_customer1_id UUID;
  v_customer2_id UUID;
  v_customer3_id UUID;
  v_sale_id UUID;
  v_product1_id UUID;
  v_product2_id UUID;
  v_product3_id UUID;
  v_exchange_rate NUMERIC := 30.0;
BEGIN
  SELECT id INTO v_customer1_id FROM customers WHERE store_id = v_store_id LIMIT 1;
  SELECT id INTO v_customer2_id FROM customers WHERE store_id = v_store_id OFFSET 1 LIMIT 1;
  SELECT id INTO v_customer3_id FROM customers WHERE store_id = v_store_id OFFSET 2 LIMIT 1;
  
  SELECT id INTO v_product1_id FROM products WHERE store_id = v_store_id AND name = 'Coca Cola 2L' LIMIT 1;
  SELECT id INTO v_product2_id FROM products WHERE store_id = v_store_id AND name = 'Arroz 1kg' LIMIT 1;
  SELECT id INTO v_product3_id FROM products WHERE store_id = v_store_id AND name = 'Leche 1L' LIMIT 1;

  -- Venta 1: Al contado
  v_sale_id := gen_random_uuid();
  INSERT INTO sales (id, store_id, cash_session_id, sold_at, exchange_rate, currency, totals, payment, customer_id, note)
  VALUES (
    v_sale_id,
    v_store_id,
    NULL,
    NOW() - INTERVAL '3 days',
    v_exchange_rate,
    'BS',
    jsonb_build_object('subtotal_bs', 33.50, 'subtotal_usd', 1.12, 'tax_bs', 0.00, 'tax_usd', 0.00, 'total_bs', 33.50, 'total_usd', 1.12),
    jsonb_build_object('method', 'cash', 'amount_bs', 33.50, 'amount_usd', 0.00, 'change_bs', 0.00, 'change_usd', 0.00),
    v_customer1_id,
    'Venta normal'
  );
  
  INSERT INTO sale_items (id, sale_id, product_id, qty, unit_price_bs, unit_price_usd, discount_bs, discount_usd)
  VALUES 
    (gen_random_uuid(), v_sale_id, v_product1_id, 1, 15.50, 0.52, 0.00, 0.00),
    (gen_random_uuid(), v_sale_id, v_product2_id, 1, 18.00, 0.60, 0.00, 0.00);

  -- Venta 2: Mixta
  v_sale_id := gen_random_uuid();
  INSERT INTO sales (id, store_id, cash_session_id, sold_at, exchange_rate, currency, totals, payment, customer_id, note)
  VALUES (
    v_sale_id,
    v_store_id,
    NULL,
    NOW() - INTERVAL '2 days',
    v_exchange_rate,
    'MIXED',
    jsonb_build_object('subtotal_bs', 40.00, 'subtotal_usd', 1.20, 'tax_bs', 0.00, 'tax_usd', 0.00, 'total_bs', 40.00, 'total_usd', 1.20),
    jsonb_build_object('method', 'mixed', 'amount_bs', 10.00, 'amount_usd', 1.00, 'change_bs', 0.00, 'change_usd', 0.00),
    v_customer2_id,
    'Pago mixto BS/USD'
  );
  
  INSERT INTO sale_items (id, sale_id, product_id, qty, unit_price_bs, unit_price_usd, discount_bs, discount_usd)
  VALUES 
    (gen_random_uuid(), v_sale_id, v_product3_id, 1, 22.00, 0.73, 0.00, 0.00),
    (gen_random_uuid(), v_sale_id, v_product1_id, 1, 15.50, 0.52, 2.50, 0.08);

  -- Venta 3: Fiao
  v_sale_id := gen_random_uuid();
  INSERT INTO sales (id, store_id, cash_session_id, sold_at, exchange_rate, currency, totals, payment, customer_id, note)
  VALUES (
    v_sale_id,
    v_store_id,
    NULL,
    NOW() - INTERVAL '1 day',
    v_exchange_rate,
    'BS',
    jsonb_build_object('subtotal_bs', 55.00, 'subtotal_usd', 1.83, 'tax_bs', 0.00, 'tax_usd', 0.00, 'total_bs', 55.00, 'total_usd', 1.83),
    jsonb_build_object('method', 'debt', 'amount_bs', 0.00, 'amount_usd', 0.00, 'change_bs', 0.00, 'change_usd', 0.00),
    v_customer3_id,
    'Fiado - pagar en 7 días'
  );
  
  INSERT INTO sale_items (id, sale_id, product_id, qty, unit_price_bs, unit_price_usd, discount_bs, discount_usd)
  VALUES 
    (gen_random_uuid(), v_sale_id, v_product2_id, 2, 18.00, 0.60, 0.00, 0.00),
    (gen_random_uuid(), v_sale_id, v_product3_id, 1, 22.00, 0.73, 0.00, 0.00);

  -- Deuda
  INSERT INTO debts (id, store_id, sale_id, customer_id, created_at, amount_bs, amount_usd, status)
  VALUES (
    gen_random_uuid(),
    v_store_id,
    v_sale_id,
    v_customer3_id,
    NOW() - INTERVAL '1 day',
    55.00,
    1.83,
    'open'
  );

  -- Ajustar inventario por ventas
  INSERT INTO inventory_movements (id, store_id, product_id, movement_type, qty_delta, unit_cost_bs, unit_cost_usd, ref, happened_at)
  SELECT gen_random_uuid(), v_store_id, product_id, 'sold', -qty, unit_price_bs, unit_price_usd, jsonb_build_object('sale_id', sale_id), NOW() - INTERVAL '3 days'
  FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE sold_at >= NOW() - INTERVAL '3 days' AND sold_at < NOW() - INTERVAL '2 days');
  
  INSERT INTO inventory_movements (id, store_id, product_id, movement_type, qty_delta, unit_cost_bs, unit_cost_usd, ref, happened_at)
  SELECT gen_random_uuid(), v_store_id, product_id, 'sold', -qty, unit_price_bs, unit_price_usd, jsonb_build_object('sale_id', sale_id), NOW() - INTERVAL '2 days'
  FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE sold_at >= NOW() - INTERVAL '2 days' AND sold_at < NOW() - INTERVAL '1 day');
  
  INSERT INTO inventory_movements (id, store_id, product_id, movement_type, qty_delta, unit_cost_bs, unit_cost_usd, ref, happened_at)
  SELECT gen_random_uuid(), v_store_id, product_id, 'sold', -qty, unit_price_bs, unit_price_usd, jsonb_build_object('sale_id', sale_id), NOW() - INTERVAL '1 day'
  FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE sold_at >= NOW() - INTERVAL '1 day');

END $$;
