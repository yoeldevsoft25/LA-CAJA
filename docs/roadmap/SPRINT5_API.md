# Sprint 5 - API de Caja (Cash Sessions)

## Endpoints Implementados

Todos los endpoints requieren autenticación JWT (Bearer token).

### 1. Abrir Sesión de Caja

**POST** `/cash/sessions/open`

Abre una nueva sesión de caja. Solo puede haber una sesión abierta a la vez.

**Body:**
```json
{
  "cash_bs": 100.00,
  "cash_usd": 10.00,
  "note": "Apertura de caja del día"
}
```

**Respuesta:**
```json
{
  "id": "uuid",
  "store_id": "uuid",
  "opened_by": "uuid",
  "opened_at": "2025-12-13T...",
  "opening_amount_bs": 100.00,
  "opening_amount_usd": 10.00,
  "closed_at": null,
  "closed_by": null,
  "expected": null,
  "counted": null,
  "note": "Apertura de caja del día"
}
```

**Errores:**
- `400 Bad Request`: Si ya existe una sesión abierta

### 2. Obtener Sesión Actual

**GET** `/cash/sessions/current`

Obtiene la sesión de caja actualmente abierta (si existe).

**Respuesta:**
```json
{
  "id": "uuid",
  "store_id": "uuid",
  "opened_by": "uuid",
  "opened_at": "2025-12-13T...",
  "opening_amount_bs": 100.00,
  "opening_amount_usd": 10.00,
  ...
}
```

O `null` si no hay sesión abierta.

### 3. Cerrar Sesión de Caja

**POST** `/cash/sessions/:id/close`

Cierra una sesión de caja y calcula el cuadre (esperado vs contado).

**Body:**
```json
{
  "counted_bs": 150.00,
  "counted_usd": 12.00,
  "note": "Cuadre correcto"
}
```

**Respuesta:**
```json
{
  "id": "uuid",
  "store_id": "uuid",
  "opened_by": "uuid",
  "opened_at": "2025-12-13T...",
  "closed_at": "2025-12-13T...",
  "closed_by": "uuid",
  "opening_amount_bs": 100.00,
  "opening_amount_usd": 10.00,
  "expected": {
    "cash_bs": 150.00,
    "cash_usd": 12.00
  },
  "counted": {
    "cash_bs": 150.00,
    "cash_usd": 12.00
  },
  "note": "Cuadre correcto"
}
```

**Características:**
- Calcula automáticamente el efectivo esperado basado en:
  - Monto inicial de apertura
  - Ventas pagadas en efectivo (CASH_BS, CASH_USD, SPLIT con cash)
- No incluye en el efectivo: PAGO_MOVIL, TRANSFER, OTHER, FIAO
- Diferencia = counted - expected

**Errores:**
- `404 Not Found`: Si la sesión no existe o ya está cerrada

### 4. Resumen de Sesión

**GET** `/cash/sessions/:id/summary`

Obtiene un resumen detallado de una sesión (abierta o cerrada) con todas las ventas y desglose por método de pago.

**Respuesta:**
```json
{
  "session": { ... },
  "sales_count": 25,
  "sales": {
    "total_bs": 1250.00,
    "total_usd": 34.25,
    "by_method": {
      "CASH_BS": 800.00,
      "CASH_USD": 20.00,
      "PAGO_MOVIL": 300.00,
      "TRANSFER": 100.00,
      "OTHER": 50.00,
      "FIAO": 0,
      "SPLIT": 0
    }
  },
  "cash_flow": {
    "opening_bs": 100.00,
    "opening_usd": 10.00,
    "sales_bs": 800.00,
    "sales_usd": 20.00,
    "expected_bs": 900.00,
    "expected_usd": 30.00
  },
  "closing": {
    "expected": {
      "cash_bs": 900.00,
      "cash_usd": 30.00
    },
    "counted": {
      "cash_bs": 895.00,
      "cash_usd": 30.00
    },
    "difference_bs": -5.00,
    "difference_usd": 0.00,
    "note": "Falta 5 BS"
  }
}
```

### 5. Listar Sesiones

**GET** `/cash/sessions?limit=50&offset=0`

Lista todas las sesiones de caja (abiertas y cerradas) ordenadas por fecha de apertura descendente.

**Query Parameters:**
- `limit` (opcional): Límite de resultados (default: 50)
- `offset` (opcional): Offset para paginación (default: 0)

**Respuesta:**
```json
{
  "sessions": [...],
  "total": 150
}
```

## Ejemplos de Uso (PowerShell)

### Abrir sesión de caja

```powershell
$token = "tu-token-jwt"
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

$body = @{
    cash_bs = 100.00
    cash_usd = 10.00
    note = "Apertura de caja"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/cash/sessions/open `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Obtener sesión actual

```powershell
Invoke-WebRequest -Uri http://localhost:3000/cash/sessions/current `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Crear venta (vinculada a la sesión)

```powershell
# Primero obtener la sesión actual
$sessionResponse = Invoke-WebRequest -Uri http://localhost:3000/cash/sessions/current -Headers $headers -UseBasicParsing
$session = $sessionResponse.Content | ConvertFrom-Json

# Crear venta con cash_session_id
$saleBody = @{
    items = @(@{ product_id = "uuid"; qty = 2; discount_bs = 0; discount_usd = 0 })
    exchange_rate = 36.50
    currency = "BS"
    payment_method = "CASH_BS"
    cash_session_id = $session.id
} | ConvertTo-Json -Depth 3

Invoke-WebRequest -Uri http://localhost:3000/sales `
    -Method POST `
    -Body $saleBody `
    -Headers $headers `
    -UseBasicParsing
```

### Cerrar sesión y cuadrar

```powershell
$sessionId = "uuid-de-la-sesion"

$body = @{
    counted_bs = 150.00
    counted_usd = 12.00
    note = "Cuadre correcto"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/cash/sessions/$sessionId/close" `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Obtener resumen de sesión

```powershell
$sessionId = "uuid-de-la-sesion"

Invoke-WebRequest -Uri "http://localhost:3000/cash/sessions/$sessionId/summary" `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

## Notas Importantes

- Solo puede haber una sesión de caja abierta a la vez por tienda
- El cálculo de efectivo esperado solo incluye:
  - Monto inicial de apertura
  - Ventas en CASH_BS
  - Ventas en CASH_USD
  - Parte en efectivo de ventas SPLIT
- Las ventas deben incluir `cash_session_id` para ser asociadas a la sesión
- Al cerrar, se calcula automáticamente la diferencia entre lo esperado y lo contado

