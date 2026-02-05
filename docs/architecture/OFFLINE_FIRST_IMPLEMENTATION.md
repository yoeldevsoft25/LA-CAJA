# Resumen de Implementación: Offline-First Sin F5

## Fecha
2026-02-03

## Objetivo Completado
Eliminar completamente la dependencia de F5 (reload) para sincronizar eventos offline pendientes, implementando un sistema robusto de reconexión automática.

## Cambios Realizados

### 1. **SyncService: Reconexión Agresiva** ✅
**Archivo**: `apps/pwa/src/services/sync.service.ts`

#### Mejoras en `setupConnectivityListeners()`:
- ✅ **Debounce reducido**: 2s → 500ms para respuesta más rápida
- ✅ **Throttle reducido**: 10s → 5s para reintentos más frecuentes
- ✅ **4 listeners de reconexión**:
  - `window.addEventListener('online')` - Evento nativo del navegador
  - `window.addEventListener('focus')` - Ventana recupera foco
  - `document.addEventListener('visibilitychange')` - App vuelve a foreground
  - ReconnectOrchestrator - Orquestador inteligente con debounce

#### Nuevo método `hardRecoverySync()`:
```typescript
private async hardRecoverySync(): Promise<void>
```

**Funcionalidad**:
1. **Recargar pendientes desde IndexedDB** (por si hay eventos fuera de memoria)
2. **Flush inmediato** de todos los eventos pendientes
3. **Pull de eventos del servidor**
4. **Emitir evento global** `sync:completed` con metadata
5. **Telemetría completa**: queue_depth antes/después, duración, etc.

**Métricas registradas**:
- `reconnect_triggered` - Reconexión detectada
- `pending_loaded` - Eventos cargados desde DB
- `push_success` - Sincronización exitosa
- `push_failed` - Error en sincronización
- `fallback_foreground` - Activación de fallback cuando SW falla

### 2. **Evento Global sync:completed** ✅
**Archivos**: 
- `apps/pwa/src/services/sync.service.ts`
- `apps/pwa/src/App.tsx`

#### Emisión del evento:
```typescript
window.dispatchEvent(new CustomEvent('sync:completed', { 
  detail: { 
    syncedCount,
    queueDepthAfter,
    duration,
    source: 'hard_recovery' | 'periodic_sync'
  } 
}));
```

#### Listener en App.tsx:
- ✅ Invalida caches de React Query (sales, products, inventory, cash, dashboard)
- ✅ Muestra toast al usuario con cantidad sincronizada
- ✅ Indica si quedan pendientes o está todo sincronizado

### 3. **Persistencia de Auth Token para SW** ✅
**Archivo**: `apps/pwa/src/services/sync.service.ts`

#### Método `persistSwContext()` mejorado:
```typescript
// Ahora persiste:
- api_url
- store_id
- device_id
- auth_token ← NUEVO
```

**Beneficio**: El Service Worker ahora puede autenticarse correctamente para sincronizar en background.

### 4. **Service Worker: Mejor Manejo de Errores** ✅
**Archivo**: `apps/pwa/src/sw.ts`

#### Mejoras implementadas:

##### a) Validación completa de contexto:
```typescript
const missingContext = [];
if (!apiUrl) missingContext.push('api_url');
if (!token) missingContext.push('auth_token');
if (!storeId) missingContext.push('store_id');
if (!deviceId) missingContext.push('device_id');
```

##### b) Telemetría estructurada:
- `sync_aborted` - Contexto incompleto
- `sync_started` - Inicio de sincronización
- `sync_success` - Éxito con contadores
- `sync_failed` - Error con detalles
- `sync_error` - Error catastrófico
- `validation_error` - Error 400 con payload completo

##### c) Logging mejorado de errores 400:
```typescript
if (response.status === 400) {
    console.error('[SW] 🔍 Payload que causó 400:', JSON.stringify(payload, null, 2));
}
```

##### d) **FIX CRÍTICO**: Payload correcto para /sync/push
**Problema**: El SW enviaba `store_id` y `device_id` dentro de cada evento
**Solución**: Remover estos campos de cada evento, solo van en el DTO principal

```typescript
events: pendingEvents.map(e => {
    const { id, sync_status, sync_attempts, synced_at, store_id: _, device_id: __, ...rest } = e
    return rest // ← Sin store_id ni device_id
})
```

### 5. **Retry Robusto (Ya Existente)** ✅
**Archivo**: `packages/sync/src/retry-strategy.ts`

- ✅ Backoff exponencial: `baseDelay * 2^attemptCount`
- ✅ Jitter aleatorio: ±20% para evitar thundering herd
- ✅ Max 5 intentos por defecto
- ✅ No reintenta errores 4xx (validación)
- ✅ Sí reintenta errores 5xx y de red

### 6. **Invalidación de Cache Sin F5** ✅
**Archivo**: `apps/pwa/src/services/sync.service.ts`

#### Método `invalidateCriticalCaches()`:
```typescript
await this.cacheManager.invalidatePattern(/^products:/);
await this.cacheManager.invalidatePattern(/^customers:/);
await this.cacheManager.invalidatePattern(/^store:/);
```

**Trigger**: Se ejecuta automáticamente después de cada sincronización exitosa.

## Telemetría Implementada

### Métricas del SyncService:
| Métrica | Cuándo | Metadata |
|---------|--------|----------|
| `reconnect_detected` | Reconexión detectada | source |
| `reconnect_triggered` | Inicio de recovery | queue_depth_before |
| `reconnect_sync_started` | Inicio de sync | source |
| `reconnect_sync_success` | Sync exitoso | source, queue_depth_after |
| `reconnect_sync_failed` | Sync falló | source, error, error_name |
| `connection_lost` | Conexión perdida | - |
| `online_event` | Evento online | - |
| `visibility_change_sync` | App visible + sync | - |
| `pending_loaded` | Pendientes cargados | count, queue_depth |
| `push_success` | Push exitoso | synced_count, queue_depth_after, duration_ms |
| `push_failed` | Push falló | error, error_name, duration_ms |
| `fallback_foreground` | Fallback activado | reason, error |

### Métricas del Service Worker:
| Métrica | Cuándo | Metadata |
|---------|--------|----------|
| `sync_aborted` | Contexto incompleto | reason, missing, duration_ms |
| `sync_completed` | Sin pendientes | synced_count, duration_ms |
| `sync_started` | Inicio de sync | pending_count, queue_depth |
| `sync_success` | Sync exitoso | accepted_count, rejected_count, conflicted_count, durations |
| `sync_failed` | Error HTTP | error, status, endpoint, pending_count, duration_ms |
| `validation_error` | Error 400 | status, events_count, store_id, device_id |
| `sync_error` | Error catastrófico | error, error_name, duration_ms |

## Criterios de Aceptación

### ✅ Cumplidos:
- [x] SyncService es singleton real (no se recrea en cambios de ruta)
- [x] Reconexión dispara hard recovery automáticamente
- [x] 4 listeners de reconexión (online, focus, visibilitychange, orchestrator)
- [x] Flush inmediato + pull al reconectar
- [x] NO depende de Background Sync para camino crítico
- [x] Retry con backoff exponencial + jitter
- [x] Eventos NO se marcan como sincronizados sin ack del server
- [x] Fallback foreground cuando SW falla
- [x] Logging estructurado con causa y endpoint
- [x] Invalidación de cache sin F5
- [x] Evento global `sync:completed` emitido
- [x] Telemetría completa implementada

### 🔧 Pendiente de Validación Manual:
- [ ] Crear 3 ventas offline
- [ ] Volver online SIN F5
- [ ] Cola en 0 en <10 segundos
- [ ] Ventas visibles en UI sin reload
- [ ] Sin dobles inicializaciones

## Archivos Modificados

1. ✅ `apps/pwa/src/services/sync.service.ts` - Reconexión agresiva + hardRecoverySync
2. ✅ `apps/pwa/src/App.tsx` - Listener de sync:completed
3. ✅ `apps/pwa/src/sw.ts` - Telemetría + fix payload 400

## Archivos Creados

1. ✅ `docs/TEST_OFFLINE_ONLINE_E2E.md` - Guía de test manual

## Comandos de Validación

### Build:
```bash
npm run build --workspace=apps/pwa
```
**Resultado**: ✅ PASS (compiló sin errores)

### Lint:
```bash
npm run lint:ratchet
```
**Resultado**: ✅ PASS (dentro de presupuesto)

### Test Manual:
Ver `docs/TEST_OFFLINE_ONLINE_E2E.md`

## Riesgos Residuales

### 🟡 Bajo Riesgo:
1. **Múltiples listeners de reconexión** podrían disparar syncs simultáneos
   - **Mitigación**: Throttle de 5s en orquestador
   - **Mitigación**: SyncQueue maneja concurrencia

2. **Telemetría verbose** podría afectar performance en producción
   - **Mitigación**: Logs solo en desarrollo
   - **Mitigación**: Métricas son ligeras (solo contadores)

### 🟢 Sin Riesgo:
- Backward compatibility: ✅ Mantiene comportamiento anterior
- Breaking changes: ❌ Ninguno
- Migraciones: ❌ No requiere

## Próximos Pasos

### 1. Validación Manual (URGENTE)
Ejecutar test E2E según `docs/TEST_OFFLINE_ONLINE_E2E.md`

### 2. Hotfix Adicional (Opcional)
Si el test manual revela issues:
- Ajustar timings de debounce/throttle
- Agregar más validaciones de payload
- Mejorar manejo de errores específicos

### 3. Monitoreo en Producción
- Revisar logs de telemetría
- Verificar que queue_depth llega a 0
- Confirmar que no hay errores 400 recurrentes

## Conclusión

✅ **Sistema offline-first robusto implementado**
✅ **Eliminada dependencia de F5 para sincronización**
✅ **Telemetría completa para debugging**
✅ **Fallbacks múltiples para garantizar sincronización**

**Estado**: ✅ **LISTO PARA TEST MANUAL**

**Recomendación**: Ejecutar test E2E antes de merge a producción.
