# @la-caja/sync

Motor de sincronización robusto y escalable para el sistema POS offline-first.

## Características

- ✅ **Cola de sincronización con prioridades** - Eventos críticos primero
- ✅ **Reintentos inteligentes** - Exponential backoff con jitter
- ✅ **Batching inteligente** - Agrupa eventos para eficiencia
- ✅ **Métricas y observabilidad** - Tracking completo del proceso
- ✅ **Manejo de estados** - Pending, syncing, synced, failed, conflict

## Uso Básico

```typescript
import { SyncQueue, SyncMetricsCollector } from '@la-caja/sync';
import { BaseEvent } from '@la-caja/domain';

// Crear cola de sincronización
const syncQueue = new SyncQueue(async (events: BaseEvent[]) => {
  // Callback que sincroniza con el servidor
  const response = await fetch('/api/sync/push', {
    method: 'POST',
    body: JSON.stringify({ events }),
  });
  
  return response.ok 
    ? { success: true }
    : { success: false, error: new Error('Sync failed') };
});

// Agregar eventos
const event: BaseEvent = {
  event_id: 'uuid',
  type: 'SaleCreated',
  // ... resto del evento
};

syncQueue.enqueue(event);
```

## Prioridades

Los eventos se ordenan automáticamente por prioridad:

- **CRITICAL**: SaleCreated, DebtPaymentRecorded, CashSessionClosed
- **HIGH**: StockReceived, StockAdjusted, CashSessionOpened
- **NORMAL**: ProductCreated, ProductUpdated, CustomerCreated (default)
- **LOW**: Configuración, logs

## Reintentos

El sistema usa exponential backoff automático:

- Intento 1: 1 segundo
- Intento 2: 2 segundos
- Intento 3: 4 segundos
- Intento 4: 8 segundos
- Intento 5: 16 segundos (máximo)

## Métricas

```typescript
const metrics = syncQueue.getMetrics();
console.log(metrics.syncedEvents);
console.log(metrics.avgSyncDuration);
console.log(metrics.errorRate);
```

## API

Ver `src/index.ts` para exports completos.
