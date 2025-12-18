# 🔐 Credenciales de Usuarios de Prueba

## 📋 Información de Acceso

### Tienda Demo
- **ID**: `550e8400-e29b-41d4-a716-446655440000`
- **Nombre**: "Supermercado Demo LA-CAJA"

---

## 👥 Usuarios

### 1. Owner (Dueño)
- **ID Usuario**: `660e8400-e29b-41d4-a716-446655440001`
- **Nombre**: Juan Pérez - Owner
- **Rol**: `owner`
- **PIN**: `1234`
- **Permisos**: Acceso completo a todas las funcionalidades

### 2. Cashier (Cajera)
- **ID Usuario**: `660e8400-e29b-41d4-a716-446655440002`
- **Nombre**: María González - Cajera
- **Rol**: `cashier`
- **PIN**: `5678`
- **Permisos**: Acceso a POS, ventas, caja

### 3. Cashier (Cajero)
- **ID Usuario**: `660e8400-e29b-41d4-a716-446655440003`
- **Nombre**: Carlos Rodríguez - Cajero
- **Rol**: `cashier`
- **PIN**: `9012`
- **Permisos**: Acceso a POS, ventas, caja

---

## 🔑 Cómo Iniciar Sesión

### Endpoint de Login
```
POST /auth/login
```

### Body de la Petición
```json
{
  "store_id": "550e8400-e29b-41d4-a716-446655440000",
  "pin": "1234"
}
```

### Ejemplo con cURL
```bash
# Login como Owner
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "store_id": "550e8400-e29b-41d4-a716-446655440000",
    "pin": "1234"
  }'

# Login como Cajera
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "store_id": "550e8400-e29b-41d4-a716-446655440000",
    "pin": "5678"
  }'

# Login como Cajero
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "store_id": "550e8400-e29b-41d4-a716-446655440000",
    "pin": "9012"
  }'
```

### Respuesta Exitosa
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "660e8400-e29b-41d4-a716-446655440001",
  "store_id": "550e8400-e29b-41d4-a716-446655440000",
  "role": "owner",
  "full_name": "Juan Pérez - Owner"
}
```

---

## 📱 Uso en Frontend

### PWA / Desktop App

1. Abre la aplicación
2. Selecciona la tienda: **"Supermercado Demo LA-CAJA"**
3. Ingresa el PIN correspondiente:
   - Owner: `1234`
   - Cajera: `5678`
   - Cajero: `9012`
4. Haz clic en "Iniciar Sesión"

---

## ⚠️ Notas Importantes

1. **PINs de Prueba**: Estos PINs son solo para desarrollo y pruebas. **NO uses estos PINs en producción**.

2. **Seguridad**: Los PINs están hasheados con bcrypt en la base de datos. Los valores mostrados aquí son los PINs en texto plano para facilitar las pruebas.

3. **Cambiar PINs**: Si necesitas cambiar los PINs, puedes:
   - Usar el endpoint de creación de cajeros (solo owner)
   - O actualizar directamente en la base de datos usando bcrypt

4. **Validación**: Los PINs deben tener entre 4 y 6 caracteres según la validación del sistema.

---

## 🔄 Generar Nuevos Hashes de PIN

Si necesitas generar nuevos hashes de PIN, puedes usar Node.js:

```javascript
const bcrypt = require('bcrypt');

async function generatePinHash(pin) {
  const hash = await bcrypt.hash(pin, 10);
  console.log(`PIN: ${pin}`);
  console.log(`Hash: ${hash}`);
  return hash;
}

// Ejemplo
generatePinHash('1234');
// Output: $2b$10$7mzvb3IUc/4XNZDHbNHrdu5s/lEKx2sf4yKZ1eEILxa0u/AdbKr7O
```

O usar el servicio de autenticación del backend que ya tiene esta funcionalidad.

---

## 📊 Resumen Rápido

| Usuario | PIN | Rol | ID Usuario |
|---------|-----|-----|------------|
| Juan Pérez | `1234` | owner | `660e8400-e29b-41d4-a716-446655440001` |
| María González | `5678` | cashier | `660e8400-e29b-41d4-a716-446655440002` |
| Carlos Rodríguez | `9012` | cashier | `660e8400-e29b-41d4-a716-446655440003` |

**Store ID**: `550e8400-e29b-41d4-a716-446655440000`

---

**Última actualización**: 2025-12-18

