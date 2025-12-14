# Sprint 10 - Reportes MVP + Export

## Endpoints Implementados

Todos los endpoints requieren autenticación JWT (Bearer token).

### 1. Ventas por Día

**GET** `/reports/sales/by-day?start_date=2025-12-01&end_date=2025-12-31`

Obtiene estadísticas de ventas por día y por método de pago.

**Query Parameters:**
- `start_date` (opcional): Fecha de inicio (ISO format: YYYY-MM-DD)
- `end_date` (opcional): Fecha de fin (ISO format: YYYY-MM-DD)

**Respuesta:**
```json
{
  "total_sales": 150,
  "total_amount_bs": 15000.00,
  "total_amount_usd": 410.96,
  "by_payment_method": {
    "CASH_BS": {
      "count": 100,
      "amount_bs": 10000.00,
      "amount_usd": 273.97
    },
    "PAGO_MOVIL": {
      "count": 30,
      "amount_bs": 3000.00,
      "amount_usd": 82.19
    },
    "TRANSFER": {
      "count": 20,
      "amount_bs": 2000.00,
      "amount_usd": 54.79
    }
  },
  "daily": [
    {
      "date": "2025-12-01",
      "sales_count": 10,
      "total_bs": 1000.00,
      "total_usd": 27.40
    },
    {
      "date": "2025-12-02",
      "sales_count": 15,
      "total_bs": 1500.00,
      "total_usd": 41.10
    }
  ]
}
```

### 2. Top Productos

**GET** `/reports/sales/top-products?limit=10&start_date=2025-12-01&end_date=2025-12-31`

Obtiene los productos más vendidos ordenados por cantidad vendida.

**Query Parameters:**
- `limit` (opcional): Número de productos a retornar (default: 10)
- `start_date` (opcional): Fecha de inicio (ISO format: YYYY-MM-DD)
- `end_date` (opcional): Fecha de fin (ISO format: YYYY-MM-DD)

**Respuesta:**
```json
[
  {
    "product_id": "uuid",
    "product_name": "Coca Cola 1.5L",
    "quantity_sold": 150,
    "revenue_bs": 7500.00,
    "revenue_usd": 205.48
  },
  {
    "product_id": "uuid",
    "product_name": "Pan Bimbo",
    "quantity_sold": 120,
    "revenue_bs": 3600.00,
    "revenue_usd": 98.63
  }
]
```

### 3. Resumen de Deudas (FIAO)

**GET** `/reports/debts/summary`

Obtiene un resumen completo de las deudas (FIAO) con estadísticas y top deudores.

**Respuesta:**
```json
{
  "total_debt_bs": 5000.00,
  "total_debt_usd": 136.99,
  "total_paid_bs": 2000.00,
  "total_paid_usd": 54.79,
  "total_pending_bs": 3000.00,
  "total_pending_usd": 82.19,
  "by_status": {
    "open": 5,
    "partial": 3,
    "paid": 2
  },
  "top_debtors": [
    {
      "customer_id": "uuid",
      "customer_name": "Juan Pérez",
      "total_debt_bs": 2000.00,
      "total_debt_usd": 54.79,
      "total_paid_bs": 500.00,
      "total_paid_usd": 13.70,
      "pending_bs": 1500.00,
      "pending_usd": 41.10
    }
  ]
}
```

### 4. Exportar Ventas a CSV

**GET** `/reports/sales/export/csv?start_date=2025-12-01&end_date=2025-12-31`

Exporta las ventas en formato CSV para descarga.

**Query Parameters:**
- `start_date` (opcional): Fecha de inicio (ISO format: YYYY-MM-DD)
- `end_date` (opcional): Fecha de fin (ISO format: YYYY-MM-DD)

**Headers de Respuesta:**
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename=sales-export.csv`

**Respuesta (CSV):**
```csv
Fecha,ID Venta,Total BS,Total USD,Método de Pago,Items
2025-12-01,uuid,100.00,2.74,CASH_BS,"2x product-uuid-1; 1x product-uuid-2"
2025-12-01,uuid,50.00,1.37,PAGO_MOVIL,"1x product-uuid-3"
```

## Ejemplos de Uso (PowerShell)

### Ventas por día

```powershell
$token = "tu-token-jwt"
$headers = @{ Authorization = "Bearer $token" }

Invoke-WebRequest -Uri "http://localhost:3000/reports/sales/by-day?start_date=2025-12-01&end_date=2025-12-31" `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Top productos

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/reports/sales/top-products?limit=10" `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Resumen de deudas

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/reports/debts/summary" `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Exportar CSV

```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3000/reports/sales/export/csv?start_date=2025-12-01&end_date=2025-12-31" `
    -Headers $headers `
    -UseBasicParsing

$response.Content | Out-File -FilePath "ventas-export.csv" -Encoding UTF8
```

## Características

### Ventas por Día
- Total de ventas y montos
- Desglose por método de pago
- Desglose diario con conteo y montos

### Top Productos
- Ordenados por cantidad vendida (mayor a menor)
- Incluye ingresos generados (BS y USD)
- Filtro opcional por fecha

### Resumen de Deudas
- Total de deuda vs total pagado
- Deuda pendiente
- Conteo por status (open, partial, paid)
- Top 10 deudores con más saldo pendiente

### Export CSV
- Formato CSV estándar
- Incluye todas las ventas del rango de fechas
- Descarga directa con headers apropiados

## Notas Importantes

- Todos los reportes filtran por `store_id` del usuario autenticado
- Las fechas son opcionales: si no se especifican, se incluyen todas las ventas
- El formato de fecha es `YYYY-MM-DD` (ISO 8601)
- Los montos se redondean a 2 decimales
- El CSV usa UTF-8 encoding
- Los top deudores solo incluyen clientes con saldo pendiente > 0

