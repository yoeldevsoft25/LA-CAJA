# Sprint 3 - API de Inventario

## Endpoints Implementados

Todos los endpoints requieren autenticación JWT (Bearer token).

### 1. Entrada de Stock (Stock Received)

**POST** `/inventory/stock/received`

Registra una entrada de stock (compra, devolución de proveedor, etc.).

**Body:**
```json
{
  "product_id": "uuid",
  "qty": 50,
  "unit_cost_bs": 4.00,
  "unit_cost_usd": 0.11,
  "note": "Compra proveedor XYZ",
  "ref": {
    "supplier": "Proveedor ABC",
    "invoice": "FAC-001"
  }
}
```

**Respuesta:**
```json
{
  "id": "uuid",
  "store_id": "uuid",
  "product_id": "uuid",
  "movement_type": "received",
  "qty_delta": 50,
  "unit_cost_bs": "4.00",
  "unit_cost_usd": "0.11",
  "note": "Compra proveedor XYZ",
  "ref": { "supplier": "Proveedor ABC", "invoice": "FAC-001" },
  "happened_at": "2025-12-13T..."
}
```

### 2. Ajuste de Stock

**POST** `/inventory/stock/adjust`

Registra un ajuste de stock (pérdidas, daños, conteo físico, etc.).

**Body:**
```json
{
  "product_id": "uuid",
  "qty_delta": -2,
  "reason": "damage",
  "note": "Se dañaron 2 unidades"
}
```

**Reasons disponibles:**
- `loss` - Pérdida
- `damage` - Daño
- `count` - Conteo físico
- `other` - Otro

**qty_delta:**
- Positivo: Aumenta el stock
- Negativo: Disminuye el stock

### 3. Estado de Stock

**GET** `/inventory/stock/status?product_id=uuid`

Obtiene el estado actual del stock. Si no se especifica `product_id`, devuelve todos los productos de la tienda.

**Query Parameters:**
- `product_id` (opcional): Filtrar por producto específico
- `search` (opcional): Buscar por nombre, SKU o código de barras
- `low_stock_only` (opcional): `true` para solo stock bajo
- `limit` (opcional): Tamaño de página
- `offset` (opcional): Desplazamiento

**Respuesta (sin paginación):**
```json
[
  {
    "product_id": "uuid",
    "product_name": "Coca Cola 1.5L",
    "current_stock": 48,
    "low_stock_threshold": 10,
    "is_low_stock": false
  },
  {
    "product_id": "uuid",
    "product_name": "Pepsi 2L",
    "current_stock": 5,
    "low_stock_threshold": 10,
    "is_low_stock": true
  }
]
```

**Respuesta (con paginación):**
```json
{
  "items": [
    {
      "product_id": "uuid",
      "product_name": "Coca Cola 1.5L",
      "current_stock": 48,
      "low_stock_threshold": 10,
      "is_low_stock": false
    }
  ],
  "total": 5227
}
```

### 4. Productos con Stock Bajo

**GET** `/inventory/stock/low`

Devuelve solo los productos que están por debajo del umbral de stock bajo.

**Respuesta:**
```json
[
  {
    "product_id": "uuid",
    "product_name": "Pepsi 2L",
    "current_stock": 5,
    "low_stock_threshold": 10,
    "is_low_stock": true
  }
]
```

### 5. Stock de un Producto Específico

**GET** `/inventory/stock/:productId`

Obtiene el stock actual de un producto específico.

**Respuesta:**
```json
{
  "product_id": "uuid",
  "current_stock": 48
}
```

### 6. Historial de Movimientos

**GET** `/inventory/movements?product_id=uuid&limit=50&offset=0`

Obtiene el historial de movimientos de inventario.

**Query Parameters:**
- `product_id` (opcional): Filtrar por producto
- `limit` (opcional): Límite de resultados (default: 50)
- `offset` (opcional): Offset para paginación (default: 0)

**Respuesta:**
```json
{
  "movements": [
    {
      "id": "uuid",
      "movement_type": "received",
      "qty_delta": 50,
      "happened_at": "2025-12-13T...",
      ...
    }
  ],
  "total": 25
}
```

## Ejemplos de Uso (PowerShell)

### Registrar entrada de stock

```powershell
$token = "tu-token-jwt"
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
$productId = "uuid-del-producto"

$body = @{
    product_id = $productId
    qty = 50
    unit_cost_bs = 4.00
    unit_cost_usd = 0.11
    note = "Compra proveedor XYZ"
    ref = @{
        supplier = "Proveedor ABC"
        invoice = "FAC-001"
    }
} | ConvertTo-Json -Depth 3

Invoke-WebRequest -Uri http://localhost:3000/inventory/stock/received `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
```

### Ajustar stock (pérdida)

```powershell
$body = @{
    product_id = $productId
    qty_delta = -2
    reason = "damage"
    note = "Se dañaron 2 unidades"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/inventory/stock/adjust `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
```

### Ver estado de stock

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/inventory/stock/status" `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
```

### Ver productos con stock bajo

```powershell
Invoke-WebRequest -Uri http://localhost:3000/inventory/stock/low `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
```

### Ver historial de movimientos

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/inventory/movements?product_id=$productId&limit=20" `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
```
