# Sprint 12 - Backup/Restore (Backend)

## Funcionalidad Implementada

Sistema de backup y restore para productos y clientes. Permite exportar e importar datos de la tienda.

## Endpoints Implementados

Todos los endpoints requieren autenticación JWT (Bearer token) y solo pueden acceder a datos de su propia tienda (`store_id`).

### 1. Crear Backup

**GET** `/backup`

Obtiene un backup completo de productos y clientes de la tienda en formato JSON.

**Headers:**
- `Authorization: Bearer <token>` (requerido)

**Respuesta:**
```json
{
  "store_id": "uuid",
  "created_at": "2025-12-13T10:30:00.000Z",
  "products": [
    {
      "id": "uuid",
      "name": "Coca Cola 1.5L",
      "category": "Bebidas",
      "sku": "SKU001",
      "barcode": "123456789",
      "price_bs": 25.50,
      "price_usd": 0.70,
      "cost_bs": 15.00,
      "cost_usd": 0.41,
      "low_stock_threshold": 10,
      "is_active": true
    }
  ],
  "customers": [
    {
      "id": "uuid",
      "name": "Juan Pérez",
      "phone": "0424-1234567",
      "note": "Cliente frecuente"
    }
  ],
  "metadata": {
    "product_count": 150,
    "customer_count": 50
  }
}
```

### 2. Exportar Backup (Descarga)

**GET** `/backup/export`

Similar a `/backup`, pero con headers para descarga directa del archivo JSON.

**Headers:**
- `Authorization: Bearer <token>` (requerido)
- Respuesta incluye: `Content-Type: application/json`
- Respuesta incluye: `Content-Disposition: attachment; filename=backup.json`

**Respuesta:**
Archivo JSON descargable con el mismo formato que `/backup`.

### 3. Restaurar desde Backup

**POST** `/backup/restore`

Restaura productos y clientes desde un backup. Los registros existentes se actualizan, los nuevos se crean.

**Headers:**
- `Authorization: Bearer <token>` (requerido)
- `Content-Type: application/json`

**Body:**
```json
{
  "products": [
    {
      "id": "uuid",
      "name": "Coca Cola 1.5L",
      "category": "Bebidas",
      "sku": "SKU001",
      "barcode": "123456789",
      "price_bs": 25.50,
      "price_usd": 0.70,
      "cost_bs": 15.00,
      "cost_usd": 0.41,
      "low_stock_threshold": 10,
      "is_active": true
    }
  ],
  "customers": [
    {
      "id": "uuid",
      "name": "Juan Pérez",
      "phone": "0424-1234567",
      "note": "Cliente frecuente"
    }
  ]
}
```

**Nota:** Los arrays `products` y `customers` son opcionales. Puedes restaurar solo productos, solo clientes, o ambos.

**Respuesta:**
```json
{
  "restored": {
    "products": 150,
    "customers": 50
  },
  "errors": []
}
```

Si hay errores durante la restauración:
```json
{
  "restored": {
    "products": 148,
    "customers": 50
  },
  "errors": [
    "Error restaurando producto uuid-1: ...",
    "Error restaurando producto uuid-2: ..."
  ]
}
```

## Ejemplos de Uso (PowerShell)

### Crear backup

```powershell
$token = "tu-token-jwt"
$headers = @{ Authorization = "Bearer $token" }

$response = Invoke-WebRequest -Uri "http://localhost:3000/backup" `
    -Headers $headers `
    -UseBasicParsing

$backup = $response.Content | ConvertFrom-Json
$backup | ConvertTo-Json -Depth 10 | Out-File -FilePath "backup.json" -Encoding UTF8
```

### Descargar backup (export)

```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3000/backup/export" `
    -Headers $headers `
    -UseBasicParsing

$response.Content | Out-File -FilePath "backup-export.json" -Encoding UTF8
```

### Restaurar desde backup

```powershell
$backupContent = Get-Content -Path "backup.json" -Raw
$backupData = $backupContent | ConvertFrom-Json

$body = @{
    products = $backupData.products
    customers = $backupData.customers
} | ConvertTo-Json -Depth 10

$headers = @{ 
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

$response = Invoke-WebRequest -Uri "http://localhost:3000/backup/restore" `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing

$result = $response.Content | ConvertFrom-Json
Write-Host "Productos restaurados: $($result.restored.products)"
Write-Host "Clientes restaurados: $($result.restored.customers)"
if ($result.errors.Count -gt 0) {
    Write-Host "Errores: $($result.errors.Count)"
}
```

## Características

### Backup
- Incluye todos los productos de la tienda
- Incluye todos los clientes de la tienda
- Formato JSON legible y portable
- Metadatos con conteos

### Restore
- **Idempotente**: Puede ejecutarse múltiples veces sin duplicar datos
- **Actualiza existentes**: Si el ID ya existe, actualiza el registro
- **Crea nuevos**: Si el ID no existe, crea un nuevo registro
- **Manejo de errores**: Continúa restaurando aunque algunos registros fallen
- **Reporte de errores**: Retorna lista de errores para revisión

### Seguridad
- Solo puede acceder a datos de su propia tienda
- Requiere autenticación JWT
- Validación de datos antes de restaurar

## Notas Importantes

- El backup **NO incluye**:
  - Ventas (sales)
  - Deudas (debts)
  - Sesiones de caja (cash_sessions)
  - Movimientos de inventario (inventory_movements)
  - Eventos (events)
  
  Esto es intencional: el backup es para datos maestros (productos y clientes), no para transacciones históricas.

- Los IDs se preservan durante el restore, permitiendo restaurar en la misma tienda o en otra.

- El restore es **seguro**: no elimina datos existentes, solo actualiza o crea.

- Para un backup completo de la base de datos, usar las herramientas nativas de PostgreSQL (pg_dump).

## Uso en Desktop App (Tauri)

El backup/restore está diseñado para ser usado desde la app Desktop:
- **Backup**: 1 clic para exportar
- **Restore**: Seleccionar archivo JSON y restaurar
- Útil para migrar datos entre instalaciones o hacer copias de seguridad

