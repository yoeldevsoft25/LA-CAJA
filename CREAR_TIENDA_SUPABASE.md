# 🏪 Crear Tienda en Supabase

## Opción 1: Ejecutar Script SQL (Más rápido) ⚡

### Paso 1: Ejecutar en Supabase SQL Editor

1. Ve a Supabase → **SQL Editor** → **New query**
2. Copia y pega este SQL:

```sql
-- Crear una tienda de prueba
INSERT INTO stores (id, name, created_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Tienda de Prueba',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Crear un perfil (profile) para el cajero
INSERT INTO profiles (id, full_name, created_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Juan Pérez - Cajero',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Crear un miembro de la tienda (cajero) con PIN '1234'
INSERT INTO store_members (store_id, user_id, role, pin_hash, created_at)
VALUES (
  '11111111-1111-1111-1111-111111111111', -- Store ID
  '22222222-2222-2222-2222-222222222222', -- User ID (Profile ID)
  'cashier',
  '$2b$10$7mzvb3IUc/4XNZDHbNHrdu5s/lEKx2sf4yKZ1eEILxa0u/AdbKr7O', -- PIN: 1234
  NOW()
)
ON CONFLICT (store_id, user_id) DO NOTHING;
```

3. Haz clic en **Run**

### Paso 2: Verificar

Ejecuta esta query para verificar:

```sql
SELECT 
  s.id as store_id,
  s.name as store_name,
  p.id as profile_id,
  p.full_name,
  sm.role,
  CASE WHEN sm.pin_hash IS NOT NULL THEN 'Sí' ELSE 'No' END as has_pin
FROM stores s
JOIN store_members sm ON sm.store_id = s.id
JOIN profiles p ON p.id = sm.user_id
WHERE s.id = '11111111-1111-1111-1111-111111111111';
```

Deberías ver la tienda creada.

---

## Opción 2: Crear Tienda usando la API

### Paso 1: Crear tienda con POST request

```powershell
# En PowerShell
$body = @{
    name = "Mi Tienda"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/auth/stores -Method POST -Body $body -ContentType "application/json" | Select-Object -ExpandProperty Content
```

O usando curl:

```bash
curl -X POST http://localhost:3000/auth/stores \
  -H "Content-Type: application/json" \
  -d '{"name": "Mi Tienda"}'
```

### Paso 2: Verificar tiendas

```powershell
Invoke-WebRequest -Uri http://localhost:3000/auth/stores | Select-Object -ExpandProperty Content
```

---

## 🎯 Credenciales de Prueba

Después de ejecutar el script SQL, puedes usar:

- **PIN:** `1234`
- **Store ID:** `11111111-1111-1111-1111-111111111111`
- **User ID:** `22222222-2222-2222-2222-222222222222`

---

## ✅ Después de crear la tienda

1. **Recarga el frontend** - La tienda debería aparecer ahora
2. **Prueba el login** con el PIN: `1234`
3. **Continúa con el desarrollo**

¡Listo! 🎉
