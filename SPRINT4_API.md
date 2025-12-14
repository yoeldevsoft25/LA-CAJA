# Sprint 4 - API de Ventas (POS)

## Endpoints Implementados

Todos los endpoints requieren autenticación JWT (Bearer token).

### 1. Crear Venta (POS)

**POST** `/sales`

Crea una venta completa con carrito, calcula totales, y descuenta stock automáticamente.

**Body:**
```json
{
  "items": [
    {
      "product_id": "uuid",
      "qty": 2,
      "discount_bs": 0,
      "discount_usd": 0
    },
    {
      "product_id": "uuid",
      "qty": 1,
      "discount_bs": 0.50,
      "discount_usd": 0.01
    }
  ],
  "exchange_rate": 36.50,
  "currency": "BS",
  "payment_method": "CASH_BS",
  "cash_session_id": "uuid-opcional",
  "note": "Cliente frecuente"
}
```

**Opciones de currency:**
- `BS` - Solo Bolívares
- `USD` - Solo Dólares
- `MIXED` - Mixto

**Opciones de payment_method:**
- `CASH_BS` - Efectivo Bolívares
- `CASH_USD` - Efectivo Dólares
- `PAGO_MOVIL` - Pago Móvil
- `TRANSFER` - Transferencia
- `OTHER` - Otro
- `SPLIT` - Pago mixto (requiere `split`)
- `FIAO` - Fiado (requiere `customer_id`)

**Para SPLIT:**
```json
{
  "items": [...],
  "exchange_rate": 36.50,
  "currency": "MIXED",
  "payment_method": "SPLIT",
  "split": {
    "cash_bs": 50.00,
    "cash_usd": 0,
    "pago_movil_bs": 30.00,
    "transfer_bs": 0,
    "other_bs": 0
  }
}
```

**Para FIAO:**
```json
{
  "items": [...],
  "exchange_rate": 36.50,
  "currency": "BS",
  "payment_method": "FIAO",
  "customer_id": "uuid-del-cliente"
}
```

**Respuesta:**
```json
{
  "id": "uuid",
  "store_id": "uuid",
  "sold_at": "2025-12-13T...",
  "exchange_rate": 36.50,
  "currency": "BS",
  "totals": {
    "subtotal_bs": 100.00,
    "subtotal_usd": 2.74,
    "discount_bs": 0.50,
    "discount_usd": 0.01,
    "total_bs": 99.50,
    "total_usd": 2.73
  },
  "payment": {
    "method": "CASH_BS",
    "split": null
  },
  "items": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "qty": 2,
      "unit_price_bs": 50.00,
      "unit_price_usd": 1.37,
      "discount_bs": 0,
      "discount_usd": 0,
      "product": {
        "id": "uuid",
        "name": "Coca Cola 1.5L",
        ...
      }
    }
  ]
}
```

**Características:**
- ✅ Valida stock disponible antes de crear la venta
- ✅ Descuenta stock automáticamente (movimiento tipo 'sold')
- ✅ Usa transacciones para garantizar consistencia
- ✅ Calcula totales automáticamente
- ✅ Maneja descuentos por item
- ✅ Soporta múltiples medios de pago

### 2. Listar Ventas

**GET** `/sales?limit=50&offset=0&date_from=2025-12-01&date_to=2025-12-31`

**Query Parameters:**
- `limit` (opcional): Límite de resultados (default: 50)
- `offset` (opcional): Offset para paginación (default: 0)
- `date_from` (opcional): Fecha desde (ISO format)
- `date_to` (opcional): Fecha hasta (ISO format)

**Respuesta:**
```json
{
  "sales": [...],
  "total": 150
}
```

### 3. Obtener Venta por ID

**GET** `/sales/:id`

**Respuesta:**
```json
{
  "id": "uuid",
  "items": [...],
  ...
}
```

## Ejemplos de Uso (PowerShell)

### Crear una venta simple

```powershell
$token = "tu-token-jwt"
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

# Obtener productos primero
$productsResponse = Invoke-WebRequest -Uri "http://localhost:3000/products" -Headers $headers -UseBasicParsing
$products = ($productsResponse.Content | ConvertFrom-Json).products

$body = @{
    items = @(
        @{
            product_id = $products[0].id
            qty = 2
            discount_bs = 0
            discount_usd = 0
        }
    )
    exchange_rate = 36.50
    currency = "BS"
    payment_method = "CASH_BS"
} | ConvertTo-Json -Depth 3

Invoke-WebRequest -Uri http://localhost:3000/sales `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Crear venta con múltiples items y descuento

```powershell
$body = @{
    items = @(
        @{
            product_id = "uuid-producto-1"
            qty = 3
            discount_bs = 1.50
        },
        @{
            product_id = "uuid-producto-2"
            qty = 1
            discount_bs = 0
        }
    )
    exchange_rate = 36.50
    currency = "BS"
    payment_method = "CASH_BS"
    note = "Cliente preferencial"
} | ConvertTo-Json -Depth 3

Invoke-WebRequest -Uri http://localhost:3000/sales `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Crear venta con pago mixto (SPLIT)

```powershell
$body = @{
    items = @(...)
    exchange_rate = 36.50
    currency = "MIXED"
    payment_method = "SPLIT"
    split = @{
        cash_bs = 50.00
        pago_movil_bs = 30.00
        transfer_bs = 0
        cash_usd = 0
        other_bs = 0
    }
} | ConvertTo-Json -Depth 3
```

## Notas Importantes

- El stock se descuenta automáticamente al crear la venta
- Si no hay stock suficiente, la venta falla con error 400
- Todas las operaciones son transaccionales (todo o nada)
- Los movimientos de inventario tipo 'sold' se crean automáticamente
- La tasa de cambio debe proporcionarse en cada venta

