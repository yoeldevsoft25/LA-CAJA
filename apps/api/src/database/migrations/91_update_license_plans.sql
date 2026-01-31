-- Update License Plans to match user requirements

-- 1. Freemium (Plan actual)
INSERT INTO license_plans (code, name, description, price_monthly, price_yearly, limits, features)
VALUES (
  'FREEMIUM', 
  'Freemium', 
  'Plan gratuito para empezar', 
  0, 
  0, 
  '{"users": 1, "products": 50, "invoices_per_month": 50, "stores": 1}', 
  '["offline_mode_basic", "basic_reports"]'
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features;

-- 2. Básico ($29/mes)
INSERT INTO license_plans (code, name, description, price_monthly, price_yearly, limits, features)
VALUES (
  'BASICO', 
  'Básico', 
  'Perfecto para pequeños negocios', 
  29.00, 
  290.00, 
  '{"users": 3, "products": 500, "invoices_per_month": 1000, "stores": 1}', 
  '["3 Usuarios", "500 Productos", "1,000 Facturas/mes", "1 Tienda", "Modo Offline Completo", "Facturación Fiscal", "Inventario Básico", "Soporte WhatsApp"]'
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features;

-- 3. Profesional ($79/mes)
INSERT INTO license_plans (code, name, description, price_monthly, price_yearly, limits, features)
VALUES (
  'PROFESIONAL', 
  'Profesional', 
  'Para negocios en crecimiento', 
  79.00, 
  790.00, 
  '{"users": 10, "products": 5000, "invoices_per_month": 10000, "stores": 2}', 
  '["10 Usuarios", "5,000 Productos", "10,000 Facturas/mes", "2 Tiendas", "Todo lo del Básico", "Inventario Avanzado", "Contabilidad Básica", "Soporte Prioritario", "Acceso API"]'
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features;

-- 4. Empresarial ($199/mes)
INSERT INTO license_plans (code, name, description, price_monthly, price_yearly, limits, features)
VALUES (
  'EMPRESARIAL', 
  'Empresarial', 
  'Para grandes empresas', 
  199.00, 
  1990.00, 
  '{"users": 9999, "products": 999999, "invoices_per_month": 999999, "stores": 99}', 
  '["Usuarios Ilimitados", "Productos Ilimitados", "Facturación Ilimitada", "Hasta 99 Tiendas", "Todo lo del Profesional", "Contabilidad Completa", "IA Analytics", "Gerente de Cuenta Dedicado"]'
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features;
