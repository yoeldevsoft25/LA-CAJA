# Sprint 9 - API de Precios Rápidos + Masivo

## Endpoints Implementados

Todos los endpoints requieren autenticación JWT (Bearer token).

### 1. Cambio Rápido de Precio Individual

**PATCH** `/products/:id/price`

Cambia el precio de un producto individual de forma rápida.

**Body:**
```json
{
  "price_bs": 30.00,
  "price_usd": 0.82
}
```

**Respuesta:**
```json
{
  "id": "uuid",
  "name": "Producto",
  "price_bs": 30.00,
  "price_usd": 0.82,
  ...
}
```

### 2. Cambio Masivo de Precios

**PUT** `/products/prices/bulk`

Cambia precios de múltiples productos a la vez. Soporta dos modos:

#### Modo 1: Por Lista de Productos

Especifica exactamente qué precios cambiar para cada producto.

**Body:**
```json
{
  "items": [
    {
      "product_id": "uuid-1",
      "price_bs": 25.00,
      "price_usd": 0.68
    },
    {
      "product_id": "uuid-2",
      "price_bs": 50.00,
      "price_usd": 1.37
    }
  ],
  "rounding": "0.5"
}
```

#### Modo 2: Por Categoría con Porcentaje

Aplica un cambio porcentual a todos los productos de una categoría.

**Body:**
```json
{
  "category": "Bebidas",
  "percentage_change": 10,
  "rounding": "0.1"
}
```

Esto aumenta todos los precios de la categoría "Bebidas" en un 10% con redondeo a 0.1.

**Parámetros:**
- `items` (opcional): Array de productos con sus nuevos precios
- `category` (opcional): Categoría para cambio masivo por porcentaje
- `percentage_change` (opcional): Porcentaje de cambio (positivo = aumento, negativo = disminución)
- `rounding` (opcional): Tipo de redondeo
  - `none`: Sin redondeo
  - `0.1`: Redondeo a 0.1 (ej: 25.34 → 25.3)
  - `0.5`: Redondeo a 0.5 (ej: 25.34 → 25.5)
  - `1`: Redondeo a entero (ej: 25.34 → 25)

**Respuesta:**
```json
{
  "updated": 15,
  "products": [
    {
      "id": "uuid",
      "name": "Producto 1",
      "price_bs": 25.50,
      "price_usd": 0.70,
      ...
    },
    ...
  ]
}
```

## Ejemplos de Uso (PowerShell)

### Cambio rápido individual

```powershell
$token = "tu-token-jwt"
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

$productId = "uuid-del-producto"

$body = @{
    price_bs = 30.00
    price_usd = 0.82
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/products/$productId/price" `
    -Method PATCH `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Cambio masivo por lista

```powershell
$body = @{
    items = @(
        @{
            product_id = "uuid-1"
            price_bs = 25.00
            price_usd = 0.68
        },
        @{
            product_id = "uuid-2"
            price_bs = 50.00
            price_usd = 1.37
        }
    )
    rounding = "0.5"
} | ConvertTo-Json -Depth 3

Invoke-WebRequest -Uri http://localhost:3000/products/prices/bulk `
    -Method PUT `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Cambio masivo por categoría (aumento 10%)

```powershell
$body = @{
    category = "Bebidas"
    percentage_change = 10
    rounding = "0.1"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/products/prices/bulk `
    -Method PUT `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Cambio masivo por categoría (disminución 5%)

```powershell
$body = @{
    category = "Alimentos"
    percentage_change = -5
    rounding = "1"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/products/prices/bulk `
    -Method PUT `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing
```

## Características

### Cambio Individual
- Cambio rápido de precio de un producto
- Actualiza BS y USD simultáneamente
- Validación: precios no pueden ser negativos

### Cambio Masivo
- **Por lista**: Control exacto sobre cada producto
- **Por categoría**: Aplica cambio porcentual a toda la categoría
- **Redondeo**: Opciones flexibles de redondeo
- Solo actualiza productos activos (`is_active = true`)

### Redondeo
- `none`: Precio exacto calculado
- `0.1`: Redondea a décimas (0.1, 0.2, 0.3, etc.)
- `0.5`: Redondea a medios (0.5, 1.0, 1.5, etc.)
- `1`: Redondea a enteros (1, 2, 3, etc.)

## Notas Importantes

- Solo se actualizan productos activos
- Los precios no pueden ser negativos
- El cambio porcentual se aplica sobre el precio actual
- El redondeo se aplica después del cálculo porcentual
- El cambio masivo por categoría requiere que los productos tengan categoría asignada

