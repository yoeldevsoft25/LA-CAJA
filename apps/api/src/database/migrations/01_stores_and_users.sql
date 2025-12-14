-- ============================================
-- 1. TENANCY Y USUARIOS
-- ============================================
-- Crea las tablas base para tiendas, perfiles y miembros

-- Tabla de tiendas
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE stores IS 'Tiendas del sistema';
COMMENT ON COLUMN stores.id IS 'ID único de la tienda';
COMMENT ON COLUMN stores.name IS 'Nombre de la tienda';

-- Tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'Perfiles de usuarios del sistema';
COMMENT ON COLUMN profiles.id IS 'ID único del usuario (user_id)';
COMMENT ON COLUMN profiles.full_name IS 'Nombre completo del usuario';

-- Enum para roles de tienda (si no existe)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_role') THEN
    CREATE TYPE store_role AS ENUM ('owner', 'cashier');
  END IF;
END $$;

COMMENT ON TYPE store_role IS 'Roles disponibles: owner (dueño) o cashier (cajero)';

-- Tabla de miembros de tienda (relación many-to-many)
CREATE TABLE IF NOT EXISTS store_members (
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role store_role NOT NULL,
  pin_hash TEXT, -- Solo para cashier si quieres login con PIN
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, user_id)
);

COMMENT ON TABLE store_members IS 'Relación entre usuarios y tiendas con sus roles';
COMMENT ON COLUMN store_members.store_id IS 'ID de la tienda';
COMMENT ON COLUMN store_members.user_id IS 'ID del usuario';
COMMENT ON COLUMN store_members.role IS 'Rol del usuario en la tienda';
COMMENT ON COLUMN store_members.pin_hash IS 'Hash del PIN para cajeros (opcional)';

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_store_members_store_id ON store_members(store_id);
CREATE INDEX IF NOT EXISTS idx_store_members_user_id ON store_members(user_id);

-- Verificar que se crearon correctamente
SELECT 'Tablas de tenancy y usuarios creadas correctamente' AS status;

