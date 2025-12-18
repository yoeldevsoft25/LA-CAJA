-- ============================================
-- SCRIPT DE DATOS DE PRUEBA COMPLETO
-- Tienda Demo con todos los datos para probar métricas, notificaciones y funcionalidades
-- ============================================
-- Este script crea una tienda completa con:
-- - Usuarios (owner y cashier)
-- - Productos variados
-- - Inventario
-- - Ventas históricas
-- - Clientes y deudas
-- - Métricas en tiempo real
-- - Alertas
-- - Notificaciones
-- - Datos de ML
-- - Heatmaps y métricas comparativas
--
-- Ejecutar en Supabase SQL Editor después de todas las migraciones
-- ============================================

BEGIN;

-- ============================================
-- 1. TIENDA Y USUARIOS
-- ============================================

-- Tienda de prueba con licencia configurada
-- Si la tienda ya existe, actualizar la licencia para asegurar que funcione
INSERT INTO stores (id, name, created_at, license_status, license_expires_at, license_grace_days, license_plan) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Supermercado Demo LA-CAJA', NOW() - INTERVAL '90 days', 'active', NOW() + INTERVAL '365 days', 3, 'premium')
ON CONFLICT (id) DO UPDATE SET
  license_status = 'active',
  license_expires_at = COALESCE(stores.license_expires_at, NOW() + INTERVAL '365 days'),
  license_grace_days = COALESCE(stores.license_grace_days, 3),
  license_plan = COALESCE(stores.license_plan, 'premium');

-- Usuarios
INSERT INTO profiles (id, full_name, created_at) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'Juan Pérez - Owner', NOW() - INTERVAL '90 days'),
('660e8400-e29b-41d4-a716-446655440002', 'María González - Cajera', NOW() - INTERVAL '85 days'),
('660e8400-e29b-41d4-a716-446655440003', 'Carlos Rodríguez - Cajero', NOW() - INTERVAL '80 days')
ON CONFLICT (id) DO NOTHING;

-- Miembros de tienda con PINs hasheados
-- PINs: Owner=1234, María=5678, Carlos=9012
-- Hashes generados con bcrypt.hash(pin, 10)
INSERT INTO store_members (store_id, user_id, role, pin_hash, created_at) VALUES
('550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001', 'owner', '$2b$10$JO.JwPGo1VcOXkLvGyUQYuhVIK52ZG/W25y.gq0PB4y9c2Bu1wSfm', NOW() - INTERVAL '90 days'),
('550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440002', 'cashier', '$2b$10$VXI6fVxJ9aagCvWa.TxS.OfLRWYTmKHhBj.WLkVibrN29IBt.rtkK', NOW() - INTERVAL '85 days'),
('550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440003', 'cashier', '$2b$10$tauFnyJyXBVOQC8XLd1GgeR9oaZ20wPsv1e7uF5KrUXlL47ntOcYW', NOW() - INTERVAL '80 days')
ON CONFLICT (store_id, user_id) DO UPDATE SET
  pin_hash = EXCLUDED.pin_hash,
  role = EXCLUDED.role;

-- ============================================
-- 2. PRODUCTOS
-- ============================================

INSERT INTO products (id, store_id, name, category, sku, barcode, price_bs, price_usd, cost_bs, cost_usd, low_stock_threshold, is_active, updated_at) VALUES
-- Alimentos básicos
('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Arroz 1kg', 'Alimentos', 'ARR-001', '7891234567890', 2.50, 0.05, 2.00, 0.04, 50, true, NOW()),
('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Azúcar 1kg', 'Alimentos', 'AZU-001', '7891234567891', 3.00, 0.06, 2.50, 0.05, 40, true, NOW()),
('770e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'Harina 1kg', 'Alimentos', 'HAR-001', '7891234567892', 2.80, 0.056, 2.30, 0.046, 35, true, NOW()),
('770e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', 'Aceite 1L', 'Alimentos', 'ACE-001', '7891234567893', 4.50, 0.09, 3.80, 0.076, 30, true, NOW()),
('770e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440000', 'Pasta 500g', 'Alimentos', 'PAS-001', '7891234567894', 2.20, 0.044, 1.80, 0.036, 45, true, NOW()),

-- Bebidas
('770e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440000', 'Agua 500ml', 'Bebidas', 'BEB-001', '7891234567895', 0.80, 0.016, 0.60, 0.012, 100, true, NOW()),
('770e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440000', 'Refresco 2L', 'Bebidas', 'BEB-002', '7891234567896', 3.50, 0.07, 2.80, 0.056, 50, true, NOW()),
('770e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440000', 'Jugo 1L', 'Bebidas', 'BEB-003', '7891234567897', 2.50, 0.05, 2.00, 0.04, 40, true, NOW()),

-- Lácteos
('770e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440000', 'Leche 1L', 'Lácteos', 'LAC-001', '7891234567898', 3.20, 0.064, 2.60, 0.052, 60, true, NOW()),
('770e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440000', 'Queso 500g', 'Lácteos', 'LAC-002', '7891234567899', 5.50, 0.11, 4.50, 0.09, 25, true, NOW()),
('770e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440000', 'Mantequilla 250g', 'Lácteos', 'LAC-003', '7891234567900', 2.80, 0.056, 2.30, 0.046, 30, true, NOW()),

-- Productos de limpieza
('770e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440000', 'Detergente 1kg', 'Limpieza', 'LIM-001', '7891234567901', 4.00, 0.08, 3.20, 0.064, 40, true, NOW()),
('770e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440000', 'Jabón 3 unidades', 'Limpieza', 'LIM-002', '7891234567902', 2.50, 0.05, 2.00, 0.04, 50, true, NOW()),
('770e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440000', 'Cloro 1L', 'Limpieza', 'LIM-003', '7891234567903', 1.80, 0.036, 1.50, 0.03, 35, true, NOW()),

-- Productos con stock bajo (para alertas)
('770e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440000', 'Café 250g', 'Alimentos', 'CAF-001', '7891234567904', 5.00, 0.10, 4.00, 0.08, 20, true, NOW()),
('770e8400-e29b-41d4-a716-446655440016', '550e8400-e29b-41d4-a716-446655440000', 'Sal 1kg', 'Alimentos', 'SAL-001', '7891234567905', 1.50, 0.03, 1.20, 0.024, 30, true, NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. INVENTARIO (Movimientos)
-- ============================================

-- Movimientos iniciales de inventario (hace 90 días)
INSERT INTO inventory_movements (id, store_id, product_id, movement_type, qty_delta, unit_cost_bs, unit_cost_usd, note, happened_at) VALUES
-- Alimentos
('880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440001', 'received', 200, 2.00, 0.04, 'Compra inicial', NOW() - INTERVAL '90 days'),
('880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440002', 'received', 150, 2.50, 0.05, 'Compra inicial', NOW() - INTERVAL '90 days'),
('880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440003', 'received', 120, 2.30, 0.046, 'Compra inicial', NOW() - INTERVAL '90 days'),
('880e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440004', 'received', 100, 3.80, 0.076, 'Compra inicial', NOW() - INTERVAL '90 days'),
('880e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440005', 'received', 180, 1.80, 0.036, 'Compra inicial', NOW() - INTERVAL '90 days'),

-- Bebidas
('880e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440006', 'received', 300, 0.60, 0.012, 'Compra inicial', NOW() - INTERVAL '90 days'),
('880e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440007', 'received', 200, 2.80, 0.056, 'Compra inicial', NOW() - INTERVAL '90 days'),
('880e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440008', 'received', 150, 2.00, 0.04, 'Compra inicial', NOW() - INTERVAL '90 days'),

-- Lácteos
('880e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440009', 'received', 250, 2.60, 0.052, 'Compra inicial', NOW() - INTERVAL '90 days'),
('880e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440010', 'received', 100, 4.50, 0.09, 'Compra inicial', NOW() - INTERVAL '90 days'),
('880e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440011', 'received', 120, 2.30, 0.046, 'Compra inicial', NOW() - INTERVAL '90 days'),

-- Limpieza
('880e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440012', 'received', 150, 3.20, 0.064, 'Compra inicial', NOW() - INTERVAL '90 days'),
('880e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440013', 'received', 200, 2.00, 0.04, 'Compra inicial', NOW() - INTERVAL '90 days'),
('880e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440014', 'received', 130, 1.50, 0.03, 'Compra inicial', NOW() - INTERVAL '90 days'),

-- Productos con stock bajo
('880e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440015', 'received', 15, 4.00, 0.08, 'Compra inicial - Stock bajo', NOW() - INTERVAL '90 days'),
('880e8400-e29b-41d4-a716-446655440016', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440016', 'received', 12, 1.20, 0.024, 'Compra inicial - Stock bajo', NOW() - INTERVAL '90 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. SESIONES DE CAJA
-- ============================================

-- Sesiones de caja históricas (últimos 30 días)
INSERT INTO cash_sessions (id, store_id, opened_by, opened_at, opening_amount_bs, opening_amount_usd, closed_by, closed_at, expected, counted, note) VALUES
-- Sesión abierta actual
('990e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440002', NOW() - INTERVAL '8 hours', 100.00, 2.00, NULL, NULL, 
 '{"CASH_BS": 5000.00, "CASH_USD": 100.00, "PAGO_MOVIL": 200.00, "TRANSFER": 150.00}'::jsonb,
 NULL, NULL),

-- Sesiones cerradas (últimos días)
('990e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440002', NOW() - INTERVAL '1 day' + INTERVAL '8 hours', 100.00, 2.00, 
 '660e8400-e29b-41d4-a716-446655440002', NOW() - INTERVAL '1 day' + INTERVAL '20 hours',
 '{"CASH_BS": 4500.00, "CASH_USD": 90.00, "PAGO_MOVIL": 180.00}'::jsonb,
 '{"CASH_BS": 4500.00, "CASH_USD": 90.00, "PAGO_MOVIL": 180.00}'::jsonb,
 'Cierre normal'),

('990e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440003', NOW() - INTERVAL '2 days' + INTERVAL '8 hours', 100.00, 2.00,
 '660e8400-e29b-41d4-a716-446655440003', NOW() - INTERVAL '2 days' + INTERVAL '20 hours',
 '{"CASH_BS": 5200.00, "CASH_USD": 105.00, "TRANSFER": 200.00}'::jsonb,
 '{"CASH_BS": 5200.00, "CASH_USD": 105.00, "TRANSFER": 200.00}'::jsonb,
 'Cierre normal')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. CLIENTES
-- ============================================

INSERT INTO customers (id, store_id, name, phone, note, updated_at) VALUES
('aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Pedro Martínez', '0412-1234567', 'Cliente frecuente', NOW() - INTERVAL '60 days'),
('aa0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Ana López', '0414-2345678', 'Cliente VIP', NOW() - INTERVAL '55 days'),
('aa0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'Luis Hernández', '0416-3456789', NULL, NOW() - INTERVAL '50 days'),
('aa0e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', 'Carmen Silva', '0424-4567890', 'Cliente con deuda', NOW() - INTERVAL '45 days'),
('aa0e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440000', 'Roberto Díaz', '0426-5678901', NULL, NOW() - INTERVAL '40 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 6. VENTAS (Históricas - últimos 30 días)
-- ============================================

-- Función auxiliar para generar ventas
DO $$
DECLARE
  sale_id UUID;
  sale_item_id UUID;
  product_record RECORD;
  sale_date TIMESTAMPTZ;
  exchange_rate NUMERIC;
  i INTEGER;
  j INTEGER;
  qty INTEGER;
  total_bs NUMERIC;
  total_usd NUMERIC;
  currency_val VARCHAR(20);
  payment_method VARCHAR(50);
BEGIN
  -- Generar ventas para los últimos 30 días
  FOR i IN 1..150 LOOP
    sale_id := gen_random_uuid();
    sale_date := NOW() - (RANDOM() * INTERVAL '30 days');
    exchange_rate := 50.0 + (RANDOM() * 10.0); -- Entre 50 y 60
    
    -- Decidir moneda
    IF RANDOM() < 0.4 THEN
      currency_val := 'USD';
      total_usd := 5.0 + (RANDOM() * 45.0); -- Entre $5 y $50
      total_bs := total_usd * exchange_rate;
    ELSIF RANDOM() < 0.7 THEN
      currency_val := 'BS';
      total_bs := 250.0 + (RANDOM() * 2250.0); -- Entre 250 y 2500 BS
      total_usd := total_bs / exchange_rate;
    ELSE
      currency_val := 'MIXED';
      total_bs := 200.0 + (RANDOM() * 1800.0);
      total_usd := 3.0 + (RANDOM() * 27.0);
    END IF;
    
    -- Método de pago
    IF RANDOM() < 0.5 THEN
      payment_method := 'CASH_BS';
    ELSIF RANDOM() < 0.7 THEN
      payment_method := 'CASH_USD';
    ELSIF RANDOM() < 0.85 THEN
      payment_method := 'PAGO_MOVIL';
    ELSE
      payment_method := 'TRANSFER';
    END IF;
    
    -- Insertar venta
    INSERT INTO sales (id, store_id, cash_session_id, sold_at, exchange_rate, currency, totals, payment, customer_id, sold_by_user_id)
    VALUES (
      sale_id,
      '550e8400-e29b-41d4-a716-446655440000'::UUID,
      CASE WHEN sale_date >= NOW() - INTERVAL '1 day' THEN '990e8400-e29b-41d4-a716-446655440001'::UUID ELSE NULL END,
      sale_date,
      exchange_rate,
      currency_val,
      jsonb_build_object(
        'subtotal_bs', total_bs * 0.95,
        'subtotal_usd', total_usd * 0.95,
        'discount_bs', total_bs * 0.05,
        'discount_usd', total_usd * 0.05,
        'total_bs', total_bs,
        'total_usd', total_usd
      ),
      jsonb_build_object(
        'method', payment_method,
        'cash_payment_bs', CASE WHEN payment_method = 'CASH_BS' THEN total_bs ELSE NULL END,
        'cash_payment_usd', CASE WHEN payment_method = 'CASH_USD' THEN total_usd ELSE NULL END
      ),
      CASE WHEN RANDOM() < 0.3 THEN ('aa0e8400-e29b-41d4-a716-44665544000' || (1 + FLOOR(RANDOM() * 5)::INTEGER)::TEXT)::UUID ELSE NULL END,
      CASE WHEN RANDOM() < 0.5 THEN '660e8400-e29b-41d4-a716-446655440002'::UUID ELSE '660e8400-e29b-41d4-a716-446655440003'::UUID END
    ) ON CONFLICT (id) DO NOTHING;
    
    -- Insertar items de venta (1-5 productos por venta)
    FOR j IN 1..(1 + FLOOR(RANDOM() * 4)::INTEGER) LOOP
      SELECT * INTO product_record FROM products 
      WHERE store_id = '550e8400-e29b-41d4-a716-446655440000' 
      ORDER BY RANDOM() 
      LIMIT 1;
      
      IF product_record IS NOT NULL THEN
        sale_item_id := gen_random_uuid();
        qty := 1 + FLOOR(RANDOM() * 5)::INTEGER;
        
        INSERT INTO sale_items (id, sale_id, product_id, qty, unit_price_bs, unit_price_usd, discount_bs, discount_usd)
        VALUES (
          sale_item_id,
          sale_id,
          product_record.id,
          qty,
          product_record.price_bs,
          product_record.price_usd,
          product_record.price_bs * qty * 0.05,
          product_record.price_usd * qty * 0.05
        ) ON CONFLICT (id) DO NOTHING;
        
        -- Registrar movimiento de inventario (venta)
        INSERT INTO inventory_movements (id, store_id, product_id, movement_type, qty_delta, unit_cost_bs, unit_cost_usd, happened_at)
        VALUES (
          gen_random_uuid(),
          '550e8400-e29b-41d4-a716-446655440000',
          product_record.id,
          'sold',
          -qty,
          product_record.cost_bs,
          product_record.cost_usd,
          sale_date
        ) ON CONFLICT (id) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- 7. DEUDAS Y PAGOS
-- ============================================

-- Deudas abiertas
INSERT INTO debts (id, store_id, sale_id, customer_id, created_at, amount_bs, amount_usd, status) VALUES
('bb0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', NULL, 'aa0e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '15 days', 500.00, 10.00, 'open'),
('bb0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', NULL, 'aa0e8400-e29b-41d4-a716-446655440004', NOW() - INTERVAL '20 days', 750.00, 15.00, 'partial'),
('bb0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', NULL, 'aa0e8400-e29b-41d4-a716-446655440002', NOW() - INTERVAL '10 days', 300.00, 6.00, 'open')
ON CONFLICT (id) DO NOTHING;

-- Pagos de deudas
INSERT INTO debt_payments (id, store_id, debt_id, paid_at, amount_bs, amount_usd, method, note) VALUES
('cc0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'bb0e8400-e29b-41d4-a716-446655440002', NOW() - INTERVAL '5 days', 250.00, 5.00, 'CASH_BS', 'Pago parcial'),
('cc0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'bb0e8400-e29b-41d4-a716-446655440002', NOW() - INTERVAL '2 days', 250.00, 5.00, 'PAGO_MOVIL', 'Segundo pago parcial')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 8. MÉTRICAS EN TIEMPO REAL
-- ============================================

INSERT INTO real_time_metrics (id, store_id, metric_type, metric_name, metric_value, previous_value, change_percentage, period_type, period_start, period_end, metadata, created_at) VALUES
-- Ventas del día
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'sales', 'daily_sales_count', 25, 22, 13.64, 'day', DATE_TRUNC('day', NOW()), DATE_TRUNC('day', NOW()) + INTERVAL '1 day', '{"currency": "mixed"}'::jsonb, NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'revenue', 'daily_revenue_bs', 12500.00, 11000.00, 13.64, 'day', DATE_TRUNC('day', NOW()), DATE_TRUNC('day', NOW()) + INTERVAL '1 day', NULL, NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'revenue', 'daily_revenue_usd', 250.00, 220.00, 13.64, 'day', DATE_TRUNC('day', NOW()), DATE_TRUNC('day', NOW()) + INTERVAL '1 day', NULL, NOW()),

-- Ventas de la semana
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'sales', 'weekly_sales_count', 150, 140, 7.14, 'week', DATE_TRUNC('week', NOW()), DATE_TRUNC('week', NOW()) + INTERVAL '1 week', NULL, NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'revenue', 'weekly_revenue_bs', 75000.00, 70000.00, 7.14, 'week', DATE_TRUNC('week', NOW()), DATE_TRUNC('week', NOW()) + INTERVAL '1 week', NULL, NOW()),

-- Inventario
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'inventory', 'low_stock_products_count', 2, 1, 100.00, 'current', NOW() - INTERVAL '1 hour', NOW(), '{"threshold": 20}'::jsonb, NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'inventory', 'total_products_value_bs', 45000.00, 48000.00, -6.25, 'current', NOW() - INTERVAL '1 hour', NOW(), NULL, NOW()),

-- Ticket promedio
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'sales', 'avg_ticket_bs', 500.00, 480.00, 4.17, 'day', DATE_TRUNC('day', NOW()), DATE_TRUNC('day', NOW()) + INTERVAL '1 day', NULL, NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'sales', 'avg_ticket_usd', 10.00, 9.60, 4.17, 'day', DATE_TRUNC('day', NOW()), DATE_TRUNC('day', NOW()) + INTERVAL '1 day', NULL, NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 9. UMBRALES DE ALERTAS
-- ============================================

INSERT INTO alert_thresholds (id, store_id, alert_type, metric_name, threshold_value, comparison_operator, severity, is_active, notification_channels, created_by, created_at, updated_at) VALUES
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'stock_low', 'product_stock', 20, 'less_than', 'medium', true, '["in_app", "push"]'::jsonb, '660e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '30 days', NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'revenue_drop', 'daily_revenue_bs', 8000.00, 'less_than', 'high', true, '["in_app", "push", "email"]'::jsonb, '660e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '30 days', NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'sale_anomaly', 'daily_sales_count', 5, 'less_than', 'critical', true, '["in_app", "push"]'::jsonb, '660e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '30 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 10. ALERTAS EN TIEMPO REAL
-- ============================================

INSERT INTO real_time_alerts (id, store_id, threshold_id, alert_type, severity, title, message, metric_name, current_value, threshold_value, entity_type, entity_id, is_read, metadata, created_at) VALUES
-- Alerta de stock bajo
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 
 (SELECT id FROM alert_thresholds WHERE alert_type = 'stock_low' LIMIT 1),
 'stock_low', 'medium', 'Stock Bajo: Café 250g',
 'El producto Café 250g tiene solo 15 unidades en stock, por debajo del umbral de 20 unidades.',
 'product_stock', 15, 20, 'product', '770e8400-e29b-41d4-a716-446655440015', false, '{"product_name": "Café 250g"}'::jsonb, NOW() - INTERVAL '2 hours'),

(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000',
 (SELECT id FROM alert_thresholds WHERE alert_type = 'stock_low' LIMIT 1),
 'stock_low', 'medium', 'Stock Bajo: Sal 1kg',
 'El producto Sal 1kg tiene solo 12 unidades en stock, por debajo del umbral de 20 unidades.',
 'product_stock', 12, 20, 'product', '770e8400-e29b-41d4-a716-446655440016', false, '{"product_name": "Sal 1kg"}'::jsonb, NOW() - INTERVAL '1 hour'),

-- Alerta de deuda vencida
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', NULL,
 'debt_overdue', 'high', 'Deuda Vencida: Pedro Martínez',
 'El cliente Pedro Martínez tiene una deuda de 500.00 BS (10.00 USD) pendiente desde hace 15 días.',
 'debt_amount_bs', 500.00, 0, 'debt', 'bb0e8400-e29b-41d4-a716-446655440001', false, '{"customer_name": "Pedro Martínez", "days_overdue": 15}'::jsonb, NOW() - INTERVAL '3 hours')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 11. NOTIFICACIONES
-- ============================================

INSERT INTO notifications (id, store_id, user_id, notification_type, category, title, message, icon, action_url, action_label, priority, severity, entity_type, entity_id, metadata, is_read, is_delivered, delivery_channels, created_at) VALUES
-- Notificaciones para el owner
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001', 'alert', 'stock_low', 'Stock Bajo Detectado', '2 productos están por debajo del umbral de stock mínimo', 'warning', '/inventory', 'Ver Inventario', 'high', 'medium', NULL, NULL, '{"count": 2}'::jsonb, false, true, '["in_app", "push"]'::jsonb, NOW() - INTERVAL '2 hours'),

(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001', 'info', 'sale_completed', 'Nueva Venta Realizada', 'Se completó una venta de 750.00 BS (15.00 USD)', 'check-circle', '/sales', 'Ver Venta', 'normal', NULL, 'sale', NULL, NULL, false, true, '["in_app"]'::jsonb, NOW() - INTERVAL '30 minutes'),

(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001', 'warning', 'debt_overdue', 'Deuda Vencida', 'Pedro Martínez tiene una deuda pendiente de 15 días', 'alert-triangle', '/debts', 'Ver Deudas', 'high', 'high', 'debt', 'bb0e8400-e29b-41d4-a716-446655440001', '{"customer_name": "Pedro Martínez"}'::jsonb, false, true, '["in_app", "push"]'::jsonb, NOW() - INTERVAL '3 hours'),

-- Notificaciones para cajeros
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440002', 'success', 'sale_completed', 'Venta Exitosa', 'Venta completada: 500.00 BS', 'check-circle', NULL, NULL, 'normal', NULL, 'sale', NULL, NULL, false, true, '["in_app"]'::jsonb, NOW() - INTERVAL '15 minutes'),

(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440003', 'info', 'cash_session', 'Recordatorio de Cierre', 'Recuerda cerrar la caja al finalizar tu turno', 'clock', '/cash', 'Ir a Caja', 'normal', NULL, 'cash_session', NULL, NULL, false, false, '["in_app"]'::jsonb, NOW() - INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;

-- Badges de notificaciones
INSERT INTO notification_badges (id, store_id, user_id, category, unread_count, last_notification_at, updated_at) VALUES
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001', NULL, 3, NOW() - INTERVAL '15 minutes', NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001', 'stock_low', 1, NOW() - INTERVAL '2 hours', NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001', 'debt_overdue', 1, NOW() - INTERVAL '3 hours', NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440002', NULL, 1, NOW() - INTERVAL '15 minutes', NOW())
ON CONFLICT (store_id, user_id, category) DO UPDATE SET unread_count = EXCLUDED.unread_count, updated_at = EXCLUDED.updated_at;

-- ============================================
-- 12. DATOS DE ML (Predicciones, Recomendaciones, Anomalías)
-- ============================================

-- Predicciones de demanda
INSERT INTO demand_predictions (id, store_id, product_id, predicted_date, predicted_quantity, confidence_score, model_version, features, created_at, updated_at) VALUES
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440001', CURRENT_DATE + INTERVAL '7 days', 45.5, 85.5, 'v1.0', '{"historical_avg": 42.3, "trend": "increasing"}'::jsonb, NOW() - INTERVAL '1 day', NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440006', CURRENT_DATE + INTERVAL '7 days', 120.0, 90.0, 'v1.0', '{"historical_avg": 115.0, "trend": "stable"}'::jsonb, NOW() - INTERVAL '1 day', NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440009', CURRENT_DATE + INTERVAL '7 days', 80.0, 88.0, 'v1.0', '{"historical_avg": 75.0, "trend": "increasing"}'::jsonb, NOW() - INTERVAL '1 day', NOW())
ON CONFLICT (store_id, product_id, predicted_date) DO NOTHING;

-- Recomendaciones de productos
INSERT INTO product_recommendations (id, store_id, source_product_id, recommended_product_id, recommendation_type, score, reason, metadata, created_at, updated_at) VALUES
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440002', 'collaborative', 85.5, 'Frecuentemente comprados juntos', '{"co_occurrence": 0.75}'::jsonb, NOW() - INTERVAL '1 day', NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440005', 'collaborative', 78.0, 'Frecuentemente comprados juntos', '{"co_occurrence": 0.65}'::jsonb, NOW() - INTERVAL '1 day', NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', NULL, '770e8400-e29b-41d4-a716-446655440006', 'content_based', 92.0, 'Producto popular esta semana', '{"popularity_score": 0.92}'::jsonb, NOW() - INTERVAL '1 day', NOW())
ON CONFLICT (store_id, source_product_id, recommended_product_id, recommendation_type) DO NOTHING;

-- Anomalías detectadas
INSERT INTO detected_anomalies (id, store_id, anomaly_type, entity_type, entity_id, severity, score, description, detected_at, metadata, created_at) VALUES
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'sale_amount', 'sale', NULL, 'medium', 75.5, 'Venta inusualmente alta detectada: 5000.00 BS', NOW() - INTERVAL '2 days', '{"amount": 5000.00, "avg_amount": 500.00}'::jsonb, NOW() - INTERVAL '2 days'),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'product_movement', 'product', '770e8400-e29b-41d4-a716-446655440015', 'high', 88.0, 'Movimiento inusual de stock en Café 250g', NOW() - INTERVAL '1 day', '{"movement": -50, "avg_movement": -5}'::jsonb, NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- Métricas de modelos ML
INSERT INTO ml_model_metrics (id, store_id, model_type, model_version, metric_name, metric_value, evaluation_date, metadata, created_at) VALUES
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'demand_prediction', 'v1.0', 'mae', 3.25, CURRENT_DATE, '{"mean_absolute_error": 3.25}'::jsonb, NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'demand_prediction', 'v1.0', 'rmse', 4.50, CURRENT_DATE, '{"root_mean_squared_error": 4.50}'::jsonb, NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'recommendation', 'v1.0', 'precision', 0.85, CURRENT_DATE, '{"precision_at_k": 0.85}'::jsonb, NOW()),
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'anomaly_detection', 'v1.0', 'f1_score', 0.78, CURRENT_DATE, '{"f1_score": 0.78}'::jsonb, NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 13. HEATMAPS DE VENTAS
-- ============================================

-- Generar datos de heatmap para los últimos 7 días
DO $$
DECLARE
  heatmap_date DATE;
  hour_val INTEGER;
  sales_count INTEGER;
  total_bs NUMERIC;
  total_usd NUMERIC;
BEGIN
  FOR i IN 0..6 LOOP
    heatmap_date := CURRENT_DATE - i;
    FOR hour_val IN 8..20 LOOP
      sales_count := 1 + FLOOR(RANDOM() * 5)::INTEGER;
      total_bs := sales_count * (250.0 + (RANDOM() * 2250.0));
      total_usd := total_bs / 55.0;
      
      INSERT INTO sales_heatmap (id, store_id, date, hour, day_of_week, sales_count, total_amount_bs, total_amount_usd, avg_ticket_bs, avg_ticket_usd, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        '550e8400-e29b-41d4-a716-446655440000',
        heatmap_date,
        hour_val,
        EXTRACT(DOW FROM heatmap_date)::INTEGER,
        sales_count,
        total_bs,
        total_usd,
        total_bs / sales_count,
        total_usd / sales_count,
        NOW(),
        NOW()
      ) ON CONFLICT (store_id, date, hour) DO UPDATE SET
        sales_count = EXCLUDED.sales_count,
        total_amount_bs = EXCLUDED.total_amount_bs,
        total_amount_usd = EXCLUDED.total_amount_usd,
        avg_ticket_bs = EXCLUDED.avg_ticket_bs,
        avg_ticket_usd = EXCLUDED.avg_ticket_usd,
        updated_at = EXCLUDED.updated_at;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- 14. MÉTRICAS COMPARATIVAS
-- ============================================

INSERT INTO comparative_metrics (id, store_id, metric_type, current_period_start, current_period_end, previous_period_start, previous_period_end, current_value, previous_value, change_amount, change_percentage, trend, metadata, calculated_at) VALUES
-- Comparación semanal
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'revenue', 
 CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '1 day',
 CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '8 days',
 75000.00, 70000.00, 5000.00, 7.14, 'increasing', NULL, NOW()),

(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'sales_count',
 CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '1 day',
 CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '8 days',
 150, 140, 10, 7.14, 'increasing', NULL, NOW()),

-- Comparación mensual
(gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'revenue',
 DATE_TRUNC('month', CURRENT_DATE), DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day',
 DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month', DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day',
 300000.00, 280000.00, 20000.00, 7.14, 'increasing', NULL, NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- RESUMEN
-- ============================================

SELECT 
  '✅ Datos de prueba creados exitosamente' AS status,
  (SELECT COUNT(*) FROM stores WHERE id = '550e8400-e29b-41d4-a716-446655440000') AS stores,
  (SELECT COUNT(*) FROM profiles WHERE id IN ('660e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440003')) AS users,
  (SELECT COUNT(*) FROM products WHERE store_id = '550e8400-e29b-41d4-a716-446655440000') AS products,
  (SELECT COUNT(*) FROM sales WHERE store_id = '550e8400-e29b-41d4-a716-446655440000') AS sales,
  (SELECT COUNT(*) FROM customers WHERE store_id = '550e8400-e29b-41d4-a716-446655440000') AS customers,
  (SELECT COUNT(*) FROM debts WHERE store_id = '550e8400-e29b-41d4-a716-446655440000') AS debts,
  (SELECT COUNT(*) FROM real_time_metrics WHERE store_id = '550e8400-e29b-41d4-a716-446655440000') AS metrics,
  (SELECT COUNT(*) FROM real_time_alerts WHERE store_id = '550e8400-e29b-41d4-a716-446655440000') AS alerts,
  (SELECT COUNT(*) FROM notifications WHERE store_id = '550e8400-e29b-41d4-a716-446655440000') AS notifications;

COMMIT;

-- ============================================
-- INFORMACIÓN DE ACCESO
-- ============================================
-- 
-- Tienda ID: 550e8400-e29b-41d4-a716-446655440000
-- Nombre: Supermercado Demo LA-CAJA
--
-- Usuarios:
-- - Owner: 660e8400-e29b-41d4-a716-446655440001 (Juan Pérez)
-- - Cashier: 660e8400-e29b-41d4-a716-446655440002 (María González)
-- - Cashier: 660e8400-e29b-41d4-a716-446655440003 (Carlos Rodríguez)
--
-- Datos creados:
-- - 16 productos en diferentes categorías
-- - ~150 ventas históricas (últimos 30 días)
-- - 5 clientes
-- - 3 deudas (2 abiertas, 1 parcial)
-- - Métricas en tiempo real
-- - Alertas activas
-- - Notificaciones
-- - Datos de ML (predicciones, recomendaciones, anomalías)
-- - Heatmaps de ventas (últimos 7 días)
-- - Métricas comparativas
-- ============================================

