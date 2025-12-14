# Sprint 1 - API de Autenticación

## Endpoints Implementados

### 1. Crear Tienda (Owner)

**POST** `/auth/stores`

Crea una nueva tienda y asocia un owner (por ahora usa un UUID temporal para desarrollo).

```json
{
  "name": "Mi Tienda"
}
```

**Respuesta:**
```json
{
  "store": {
    "id": "uuid",
    "name": "Mi Tienda",
    "created_at": "2025-12-13T..."
  },
  "member": {
    "store_id": "uuid",
    "user_id": "uuid",
    "role": "owner",
    "pin_hash": null,
    "created_at": "2025-12-13T..."
  }
}
```

### 2. Crear Cajero (Requiere autenticación)

**POST** `/auth/cashiers`

Solo el owner de la tienda puede crear cajeros. Requiere token JWT en el header.

**Header:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "store_id": "uuid-de-la-tienda",
  "full_name": "Juan Pérez",
  "pin": "1234"
}
```

**Respuesta:**
```json
{
  "id": "uuid-del-cajero",
  "full_name": "Juan Pérez",
  "created_at": "2025-12-13T..."
}
```

### 3. Login con PIN (Cajero)

**POST** `/auth/login`

Login rápido para cajeros usando store_id y PIN.

**Body:**
```json
{
  "store_id": "uuid-de-la-tienda",
  "pin": "1234"
}
```

**Respuesta:**
```json
{
  "access_token": "jwt-token",
  "user_id": "uuid-del-cajero",
  "store_id": "uuid-de-la-tienda",
  "role": "cashier",
  "full_name": "Juan Pérez"
}
```

## Pruebas con PowerShell

### 1. Crear una tienda

```powershell
$body = @{
    name = "Mi Primera Tienda"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/auth/stores `
    -Method POST `
    -Body $body `
    -ContentType "application/json" `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
```

### 2. Crear un cajero (requiere el store_id del paso 1)

```powershell
$storeId = "PEGA-AQUI-EL-UUID-DE-LA-TIENDA"
$token = "PEGA-AQUI-EL-TOKEN-JWT-SI-TIENES-UNO"

$body = @{
    store_id = $storeId
    full_name = "Juan Pérez"
    pin = "1234"
} | ConvertTo-Json

$headers = @{
    Authorization = "Bearer $token"
}

# Nota: Por ahora puedes omitir el token para desarrollo
Invoke-WebRequest -Uri http://localhost:3000/auth/cashiers `
    -Method POST `
    -Body $body `
    -ContentType "application/json" `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
```

### 3. Login con PIN

```powershell
$storeId = "PEGA-AQUI-EL-UUID-DE-LA-TIENDA"

$body = @{
    store_id = $storeId
    pin = "1234"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri http://localhost:3000/auth/login `
    -Method POST `
    -Body $body `
    -ContentType "application/json" `
    -UseBasicParsing

$response.Content | ConvertFrom-Json | ConvertTo-Json

# Guarda el access_token para usarlo en otros endpoints
$authData = $response.Content | ConvertFrom-Json
$token = $authData.access_token
Write-Host "Token: $token"
```

## Notas

- El PIN debe tener entre 4 y 6 caracteres
- Los PINs se hashean con bcrypt antes de guardarse
- El token JWT expira según `JWT_EXPIRES_IN` en el `.env` (por defecto 7 días)
- Para usar endpoints protegidos, incluye el token en el header: `Authorization: Bearer <token>`

