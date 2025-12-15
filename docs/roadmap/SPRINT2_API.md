# Sprint 2 - API de Productos

## Endpoints Implementados

Todos los endpoints requieren autenticación JWT (Bearer token).

### 1. Crear Producto

**POST** `/products`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "name": "Coca Cola 1.5L",
  "category": "Bebidas",
  "sku": "COCA-001",
  "barcode": "7891234567890",
  "price_bs": 5.50,
  "price_usd": 0.15,
  "cost_bs": 4.00,
  "cost_usd": 0.11,
  "low_stock_threshold": 10
}
```

**Respuesta:**
```json
{
  "id": "uuid",
  "store_id": "uuid",
  "name": "Coca Cola 1.5L",
  "category": "Bebidas",
  "sku": "COCA-001",
  "barcode": "7891234567890",
  "price_bs": "5.50",
  "price_usd": "0.15",
  "cost_bs": "4.00",
  "cost_usd": "0.11",
  "low_stock_threshold": 10,
  "is_active": true,
  "updated_at": "2025-12-13T..."
}
```

### 2. Listar Productos (con búsqueda)

**GET** `/products?search=coca&category=Bebidas&is_active=true&limit=20&offset=0`

**Query Parameters:**
- `search` (opcional): Búsqueda por nombre, SKU o barcode
- `category` (opcional): Filtrar por categoría
- `is_active` (opcional): Filtrar por activos/inactivos
- `limit` (opcional): Límite de resultados (default: todos)
- `offset` (opcional): Offset para paginación

**Respuesta:**
```json
{
  "products": [...],
  "total": 25
}
```

### 3. Obtener Producto por ID

**GET** `/products/:id`

**Respuesta:**
```json
{
  "id": "uuid",
  "name": "Coca Cola 1.5L",
  ...
}
```

### 4. Actualizar Producto

**PATCH** `/products/:id`

**Body (campos opcionales):**
```json
{
  "name": "Coca Cola 2L",
  "category": "Bebidas",
  "sku": "COCA-002",
  "low_stock_threshold": 15,
  "is_active": true
}
```

### 5. Cambiar Precio

**POST** `/products/:id/price`

**Body:**
```json
{
  "price_bs": 6.00,
  "price_usd": 0.17,
  "reason": "manual",
  "rounding": "0.5"
}
```

**Opciones de rounding:**
- `none`: Sin redondeo
- `0.1`: Redondea a 0.1
- `0.5`: Redondea a 0.5
- `1`: Redondea al entero

### 6. Desactivar Producto

**POST** `/products/:id/deactivate`

**Respuesta:**
```json
{
  "id": "uuid",
  "is_active": false,
  ...
}
```

### 7. Importar desde CSV

**POST** `/products/import/csv`

**Body:**
```json
{
  "csv": "name,category,sku,barcode,price_bs,price_usd,cost_bs,cost_usd\nCoca Cola,Bebidas,COCA-001,7891234567890,5.50,0.15,4.00,0.11\nPepsi,Bebidas,PEPSI-001,7891234567891,5.00,0.14,3.80,0.10"
}
```

**Formato CSV esperado:**
```csv
name,category,sku,barcode,price_bs,price_usd,cost_bs,cost_usd
Coca Cola 1.5L,Bebidas,COCA-001,7891234567890,5.50,0.15,4.00,0.11
Pepsi 2L,Bebidas,PEPSI-001,7891234567891,5.00,0.14,3.80,0.10
```

**Respuesta:**
```json
{
  "created": 2,
  "errors": []
}
```

## Ejemplos de Uso (PowerShell)

### Crear un producto

```powershell
$token = "tu-token-jwt"
$headers = @{ Authorization = "Bearer $token" }
$body = @{
    name = "Coca Cola 1.5L"
    category = "Bebidas"
    sku = "COCA-001"
    barcode = "7891234567890"
    price_bs = 5.50
    price_usd = 0.15
    cost_bs = 4.00
    cost_usd = 0.11
    low_stock_threshold = 10
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/products `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -ContentType "application/json" `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
```

### Buscar productos

```powershell
$token = "tu-token-jwt"
$headers = @{ Authorization = "Bearer $token" }

Invoke-WebRequest -Uri "http://localhost:3000/products?search=coca&limit=10" `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
```

### Importar desde CSV

```powershell
$token = "tu-token-jwt"
$csv = @"
name,category,sku,price_bs,price_usd,cost_bs,cost_usd
Coca Cola 1.5L,Bebidas,COCA-001,5.50,0.15,4.00,0.11
Pepsi 2L,Bebidas,PEPSI-001,5.00,0.14,3.80,0.10
Pan Bimbo,Alimentos,PAN-001,2.50,0.07,1.80,0.05
"@

$body = @{ csv = $csv } | ConvertTo-Json
$headers = @{ Authorization = "Bearer $token" }

Invoke-WebRequest -Uri http://localhost:3000/products/import/csv `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -ContentType "application/json" `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
```

