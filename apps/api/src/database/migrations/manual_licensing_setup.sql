-- 1. Create Enums
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'license_status_enum') THEN
        CREATE TYPE license_status_enum AS ENUM ('active', 'past_due', 'suspended', 'cancelled', 'trial');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_period_enum') THEN
        CREATE TYPE subscription_period_enum AS ENUM ('monthly', 'yearly', 'lifetime');
    END IF;
END $$;

-- 2. Create "license_plans" table
CREATE TABLE IF NOT EXISTS license_plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  price_monthly numeric(10, 2) DEFAULT 0,
  price_yearly numeric(10, 2) DEFAULT 0,
  currency text DEFAULT 'USD',
  features jsonb DEFAULT '[]'::jsonb,
  limits jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Create "store_licenses" table
CREATE TABLE IF NOT EXISTS store_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  plan_code text REFERENCES license_plans(code),
  status license_status_enum DEFAULT 'active',
  billing_period subscription_period_enum DEFAULT 'monthly',
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  grace_days integer DEFAULT 3,
  custom_limits jsonb DEFAULT '{}'::jsonb,
  custom_features jsonb DEFAULT '[]'::jsonb,
  last_check_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookup of active license
CREATE INDEX IF NOT EXISTS idx_store_licenses_store_status ON store_licenses(store_id, status);

-- 4. Create "license_usage" table
CREATE TABLE IF NOT EXISTS license_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  metric text NOT NULL,
  used integer DEFAULT 0,
  period_start timestamptz,
  period_end timestamptz,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_store_metric_period UNIQUE (store_id, metric, period_end)
);

-- 5. Seed Data: Default Plans (Venezuelan Market Strategy)

-- Freemium (Emprendedor)
INSERT INTO license_plans (code, name, description, price_monthly, limits, features)
VALUES (
  'FREEMIUM', 
  'Emprendedor', 
  'Ideal para iniciar. Control básico.', 
  0, 
  '{"users": 1, "products": 100, "invoices_per_month": 50, "stores": 1}', 
  '["offline_mode"]'
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features;

-- Básico (Negocio)
INSERT INTO license_plans (code, name, description, price_monthly, limits, features)
VALUES (
  'BASICO', 
  'Negocio', 
  'Para negocios en crecimiento. Facturación Fiscal.', 
  25.00, 
  '{"users": 3, "products": 2000, "invoices_per_month": 1000, "stores": 1}', 
  '["offline_mode", "fiscal_printing", "inventory_advanced"]'
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features;

-- Empresarial (Ilimitado)
INSERT INTO license_plans (code, name, description, price_monthly, limits, features)
VALUES (
  'EMPRESARIAL', 
  'Empresario', 
  'Sin límites. Multi-sucursal y AI.', 
  60.00, 
  '{"users": 9999, "products": 999999, "invoices_per_month": 999999, "stores": 99}', 
  '["offline_mode", "fiscal_printing", "inventory_advanced", "accounting", "ai_analytics", "multi_store"]'
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features;
