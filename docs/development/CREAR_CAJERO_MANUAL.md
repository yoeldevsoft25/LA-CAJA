# Crear Cajero Manualmente (Desarrollo)

Como el endpoint de crear cajero requiere autenticación de owner, puedes crear un cajero manualmente desde pgAdmin:

## Opción 1: SQL Directo en pgAdmin

```sql
-- 1. Crear el perfil del cajero
INSERT INTO profiles (id, full_name, created_at)
VALUES (
  gen_random_uuid(), 
  'Juan Pérez - Cajero',
  NOW()
);

-- 2. Obtener el ID del perfil creado
-- (Copia el ID que se generó)

-- 3. Hashear el PIN (usa bcrypt - puedes usar un generador online o Node.js)
-- PIN "1234" hasheado: $2b$10$EjemploHashAqui...

-- 4. Crear el store_member como cashier
-- Reemplaza:
--   - 'TU_STORE_ID' con el store_id de tu tienda
--   - 'TU_USER_ID' con el ID del perfil creado
--   - 'TU_PIN_HASH' con el hash del PIN

INSERT INTO store_members (store_id, user_id, role, pin_hash, created_at)
VALUES (
  'TU_STORE_ID',  -- Reemplaza con tu store_id
  'TU_USER_ID',   -- Reemplaza con el user_id del paso 2
  'cashier',
  '$2b$10$EjemploHashAqui...',  -- Hash del PIN "1234"
  NOW()
);
```

## Opción 2: Usar Node.js para generar el hash

```javascript
const bcrypt = require('bcrypt');

async function generateHash() {
  const hash = await bcrypt.hash('1234', 10);
  console.log('Hash:', hash);
}

generateHash();
```

## Opción 3: Script SQL completo

Ejecuta esto en pgAdmin (ajusta el store_id):

```sql
DO $$
DECLARE
  v_user_id UUID;
  v_store_id UUID := 'ecfac731-7049-4899-ad25-3e2572f3bd84'; -- Tu store_id
  v_pin_hash TEXT := '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'; -- Hash de "1234"
BEGIN
  -- Crear perfil
  v_user_id := gen_random_uuid();
  
  INSERT INTO profiles (id, full_name, created_at)
  VALUES (v_user_id, 'Juan Pérez - Cajero', NOW());
  
  -- Crear store member
  INSERT INTO store_members (store_id, user_id, role, pin_hash, created_at)
  VALUES (v_store_id, v_user_id, 'cashier', v_pin_hash, NOW());
  
  RAISE NOTICE 'Cajero creado con user_id: %', v_user_id;
END $$;
```

## Hash pre-generado para PIN "1234"

```
$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

Este hash corresponde al PIN "1234".

