# Sprint 6 - API de Fiao MVP (Clientes y Deudas)

## Endpoints Implementados

Todos los endpoints requieren autenticación JWT (Bearer token).

## Módulo de Clientes

### 1. Crear Cliente

**POST** `/customers`

**Body:**
```json
{
  "name": "Juan Pérez",
  "phone": "0424-1234567",
  "note": "Cliente frecuente"
}
```

**Respuesta:**
```json
{
  "id": "uuid",
  "store_id": "uuid",
  "name": "Juan Pérez",
  "phone": "0424-1234567",
  "note": "Cliente frecuente",
  "updated_at": "2025-12-13T..."
}
```

### 2. Listar Clientes

**GET** `/customers?search=juan`

**Query Parameters:**
- `search` (opcional): Búsqueda por nombre o teléfono

**Respuesta:**
```json
[
  {
    "id": "uuid",
    "name": "Juan Pérez",
    "phone": "0424-1234567",
    ...
  }
]
```

### 3. Obtener Cliente por ID

**GET** `/customers/:id`

### 4. Actualizar Cliente

**PUT** `/customers/:id`

**Body:**
```json
{
  "name": "Juan Carlos Pérez",
  "phone": "0424-7654321",
  "note": "Cliente VIP"
}
```

## Módulo de Deudas (Fiao)

### 1. Crear Deuda desde Venta

**POST** `/debts/from-sale/:saleId`

**Body:**
```json
{
  "customer_id": "uuid-del-cliente"
}
```

**Características:**
- La venta debe ser tipo `FIAO`
- Crea automáticamente una deuda con el monto de la venta

**Respuesta:**
```json
{
  "id": "uuid",
  "store_id": "uuid",
  "sale_id": "uuid",
  "customer_id": "uuid",
  "created_at": "2025-12-13T...",
  "amount_bs": 150.00,
  "amount_usd": 4.11,
  "status": "open"
}
```

### 2. Registrar Pago de Deuda

**POST** `/debts/:id/payments`

**Body:**
```json
{
  "amount_bs": 50.00,
  "amount_usd": 1.37,
  "method": "CASH_BS",
  "note": "Primer abono"
}
```

**Validaciones:**
- No puede exceder el monto de la deuda
- Actualiza automáticamente el status a `paid` si se completa el pago
- Métodos de pago: `CASH_BS`, `CASH_USD`, `PAGO_MOVIL`, `TRANSFER`, `OTHER`

**Respuesta:**
```json
{
  "debt": {
    "id": "uuid",
    "status": "open",
    "amount_bs": 150.00,
    "payments": [...]
  },
  "payment": {
    "id": "uuid",
    "debt_id": "uuid",
    "paid_at": "2025-12-13T...",
    "amount_bs": 50.00,
    "method": "CASH_BS"
  }
}
```

### 3. Obtener Deudas por Cliente

**GET** `/debts/customer/:customerId?include_paid=false`

**Query Parameters:**
- `include_paid` (opcional): Incluir deudas pagadas (default: false)

**Respuesta:**
```json
[
  {
    "id": "uuid",
    "amount_bs": 150.00,
    "status": "open",
    "payments": [...],
    "sale": {...}
  }
]
```

### 4. Resumen de Deudas por Cliente

**GET** `/debts/customer/:customerId/summary`

**Respuesta:**
```json
{
  "total_debt_bs": 300.00,
  "total_debt_usd": 8.22,
  "total_paid_bs": 50.00,
  "total_paid_usd": 1.37,
  "remaining_bs": 250.00,
  "remaining_usd": 6.85,
  "open_debts_count": 2,
  "total_debts_count": 3
}
```

### 5. Listar Todas las Deudas

**GET** `/debts?status=open`

**Query Parameters:**
- `status` (opcional): Filtrar por estado (`open`, `partial`, `paid`)

### 6. Obtener Deuda por ID

**GET** `/debts/:id`

Incluye relaciones: `customer`, `sale`, `payments`

## Flujo Completo: Venta a Fiao

### 1. Crear Cliente (si no existe)

```powershell
$body = @{
    name = "Juan Pérez"
    phone = "0424-1234567"
} | ConvertTo-Json

$customerResponse = Invoke-WebRequest -Uri http://localhost:3000/customers `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing
$customer = $customerResponse.Content | ConvertFrom-Json
```

### 2. Crear Venta tipo FIAO

```powershell
$saleBody = @{
    items = @(@{ product_id = "uuid"; qty = 2; discount_bs = 0 })
    exchange_rate = 36.50
    currency = "BS"
    payment_method = "FIAO"
    customer_id = $customer.id
} | ConvertTo-Json -Depth 3

$saleResponse = Invoke-WebRequest -Uri http://localhost:3000/sales `
    -Method POST `
    -Body $saleBody `
    -Headers $headers `
    -UseBasicParsing
$sale = $saleResponse.Content | ConvertFrom-Json
```

### 3. Crear Deuda desde la Venta

```powershell
$debtBody = @{
    customer_id = $customer.id
} | ConvertTo-Json

$debtResponse = Invoke-WebRequest -Uri "http://localhost:3000/debts/from-sale/$($sale.id)" `
    -Method POST `
    -Body $debtBody `
    -Headers $headers `
    -UseBasicParsing
$debt = $debtResponse.Content | ConvertFrom-Json
```

### 4. Registrar Pago Parcial

```powershell
$paymentBody = @{
    amount_bs = 50.00
    amount_usd = 1.37
    method = "CASH_BS"
    note = "Primer abono"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/debts/$($debt.id)/payments" `
    -Method POST `
    -Body $paymentBody `
    -Headers $headers `
    -UseBasicParsing
```

### 5. Consultar Resumen del Cliente

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/debts/customer/$($customer.id)/summary" `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json
```

## Notas Importantes

- Las ventas tipo FIAO **NO** se suman al efectivo de la caja
- Los pagos de deudas pueden ser parciales
- El sistema valida que los pagos no excedan el monto de la deuda
- El status se actualiza automáticamente:
  - `open`: Sin pagos
  - `partial`: Pagos parciales
  - `paid`: Completamente pagada
- Se puede buscar clientes por nombre o teléfono

