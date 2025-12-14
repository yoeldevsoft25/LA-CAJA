# Sprint 11 - Sync Resiliente (Backend)

## Mejoras Implementadas

Este sprint se enfoca principalmente en frontend (UX, teclado, optimización POS), pero incluye mejoras en el backend para hacer el sync más resiliente y observable.

## Nuevos Endpoints

### 1. Estado de Sincronización

**GET** `/sync/status?device_id=uuid`

Obtiene el estado actual de sincronización para un dispositivo específico.

**Query Parameters:**
- `device_id` (requerido): UUID del dispositivo

**Headers:**
- `Authorization: Bearer <token>` (requerido)

**Respuesta:**
```json
{
  "store_id": "uuid",
  "device_id": "uuid",
  "last_synced_at": "2025-12-13T10:30:00Z",
  "last_event_seq": 150,
  "pending_events_count": 0,
  "last_sync_duration_ms": null,
  "last_sync_error": null
}
```

**Campos:**
- `last_synced_at`: Última vez que se sincronizó (timestamp del servidor)
- `last_event_seq`: Última secuencia de evento procesada por el servidor
- `pending_events_count`: Número estimado de eventos pendientes (calculado en cliente)
- `last_sync_duration_ms`: Duración del último sync en milisegundos (calculado en cliente)
- `last_sync_error`: Último error de sincronización (manejado en cliente)

### 2. Última Secuencia Procesada

**GET** `/sync/last-seq?device_id=uuid`

Obtiene la última secuencia de evento procesada para un dispositivo. Útil para determinar desde qué punto debe sincronizar el cliente.

**Query Parameters:**
- `device_id` (requerido): UUID del dispositivo

**Headers:**
- `Authorization: Bearer <token>` (requerido)

**Respuesta:**
```json
{
  "last_seq": 150
}
```

## Mejoras en Sync Push

### Manejo de Errores Mejorado

- Errores en proyecciones no afectan el guardado de eventos
- Errores se registran en logs pero no fallan el sync completo
- Eventos válidos se procesan aunque algunos fallen

### Idempotencia

- Los eventos duplicados se aceptan idempotentemente
- No se reprocesan eventos ya guardados
- Compatible con reintentos del cliente

## Ejemplos de Uso (PowerShell)

### Obtener estado de sync

```powershell
$token = "tu-token-jwt"
$deviceId = "uuid-del-dispositivo"
$headers = @{ Authorization = "Bearer $token" }

Invoke-WebRequest -Uri "http://localhost:3000/sync/status?device_id=$deviceId" `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### Obtener última secuencia

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/sync/last-seq?device_id=$deviceId" `
    -Headers $headers `
    -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
```

## Uso en Cliente (Sincronización Resiliente)

El cliente puede usar estos endpoints para:

1. **Verificar estado antes de sync:**
   - Obtener `last_seq` para saber desde dónde sincronizar
   - Evitar sincronizar eventos ya procesados

2. **Monitorear sync:**
   - Verificar `last_synced_at` para saber cuándo fue la última sincronización exitosa
   - Mostrar estado en UI (cola visible)

3. **Reintentos inteligentes:**
   - Si falla el sync, reintentar solo eventos no procesados
   - Basarse en `last_seq` para determinar qué eventos faltan

## Notas Importantes

- Los endpoints requieren autenticación JWT
- El `device_id` debe ser proporcionado por el cliente
- `pending_events_count` y `last_sync_duration_ms` se calculan en el cliente
- El servidor solo registra eventos recibidos exitosamente
- Los errores de proyección no afectan el guardado de eventos

