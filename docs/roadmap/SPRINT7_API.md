# Sprint 7 - API de Sync Engine v1

## Endpoint Implementado

### POST /sync/push

Sincroniza eventos del cliente al servidor. Implementa deduplicación, validación y persistencia.

**Autenticación:** Requiere JWT Bearer token

**Request:**
```json
{
  "store_id": "uuid",
  "device_id": "uuid",
  "client_version": "1.0.0",
  "events": [
    {
      "event_id": "uuid",
      "store_id": "uuid",
      "device_id": "uuid",
      "seq": 1,
      "type": "SaleCreated",
      "version": 1,
      "created_at": 1734048000000,
      "actor": {
        "user_id": "uuid",
        "role": "cashier"
      },
      "payload": {
        "sale_id": "uuid",
        "totals": {...},
        ...
      }
    }
  ]
}
```

**Response:**
```json
{
  "accepted": [
    {
      "event_id": "uuid",
      "seq": 1
    }
  ],
  "rejected": [
    {
      "event_id": "uuid",
      "seq": 2,
      "code": "VALIDATION_ERROR",
      "message": "Evento inválido: campos requeridos faltantes"
    }
  ],
  "server_time": 1734048100000,
  "last_processed_seq": 1
}
```

## Características Implementadas

### 1. Deduplicación (Dedupe)

- Los eventos se deduplican por `event_id`
- Si un `event_id` ya existe, se acepta idempotentemente sin reprocesar
- Esto permite reintentos seguros sin duplicar eventos

### 2. Validaciones

- **Campos requeridos:** `event_id`, `type`, `payload`, `actor`
- **Actor válido:** `actor.user_id` y `actor.role` requeridos
- **Tipos conocidos:** Solo acepta tipos de eventos conocidos
- **Consistencia:** `store_id` y `device_id` deben coincidir entre evento y request

**Tipos de eventos conocidos:**
- `ProductCreated`
- `ProductUpdated`
- `ProductDeactivated`
- `PriceChanged`
- `StockReceived`
- `StockAdjusted`
- `SaleCreated`
- `CashSessionOpened`
- `CashSessionClosed`
- `CustomerCreated`
- `CustomerUpdated`
- `DebtCreated`
- `DebtPaymentRecorded`

### 3. Persistencia

- Todos los eventos aceptados se guardan en la tabla `events`
- Guardado en batch para mejor rendimiento
- Campos guardados:
  - `event_id` (PK)
  - `store_id`, `device_id`
  - `seq`, `type`, `version`
  - `created_at` (timestamp del cliente)
  - `actor_user_id`, `actor_role`
  - `payload` (JSONB)
  - `received_at` (timestamp del servidor)

### 4. Autenticación

- El endpoint requiere autenticación JWT
- El `store_id` del token debe coincidir con el del request

## Códigos de Error

- `VALIDATION_ERROR`: Evento no cumple validaciones
  - Campos requeridos faltantes
  - Tipo de evento desconocido
  - Actor inválido
  - `store_id`/`device_id` inconsistentes
- `PROCESSING_ERROR`: Error al procesar el evento

## Ejemplo de Uso (PowerShell)

```powershell
$token = "tu-token-jwt"
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

$storeId = "uuid-store"
$deviceId = "uuid-device"

$body = @{
    store_id = $storeId
    device_id = $deviceId
    client_version = "1.0.0"
    events = @(
        @{
            event_id = [guid]::NewGuid().ToString()
            store_id = $storeId
            device_id = $deviceId
            seq = 1
            type = "SaleCreated"
            version = 1
            created_at = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            actor = @{
                user_id = "uuid-user"
                role = "cashier"
            }
            payload = @{
                sale_id = "uuid-sale"
                totals = @{
                    total_bs = 100.00
                    total_usd = 2.74
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri http://localhost:3000/sync/push `
    -Method POST `
    -Body $body `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

## Reintentos

El cliente puede reintentar el mismo batch de eventos de forma segura:
- Los eventos ya aceptados se aceptan idempotentemente
- Solo los eventos nuevos se procesan y guardan
- Los eventos rechazados deben corregirse antes de reintentar

## Notas Importantes

- Los eventos se guardan en la tabla `events` (event store)
- La proyección a read models se implementará en el Sprint 8
- El `seq` es incremental local por dispositivo
- El `created_at` es el timestamp del cliente (epoch ms)
- El `received_at` es el timestamp del servidor cuando se guardó

