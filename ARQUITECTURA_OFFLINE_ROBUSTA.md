# 🏗️ Arquitectura Offline Robusta y Escalable

## 📋 Tabla de Contenidos
1. [Principios Fundamentales](#principios-fundamentales)
2. [Capas de la Arquitectura](#capas-de-la-arquitectura)
3. [Estrategia de Sincronización](#estrategia-de-sincronización)
4. [Manejo de Conflictos](#manejo-de-conflictos)
5. [Optimizaciones](#optimizaciones)
6. [Monitoreo y Observabilidad](#monitoreo-y-observabilidad)

---

## 🎯 Principios Fundamentales

### 1. **Offline-First Absoluto**
- ✅ La app funciona completamente offline
- ✅ Todas las operaciones se guardan localmente primero
- ✅ El servidor es solo un "backup" y fuente de sincronización
- ✅ La UI siempre refleja el estado local (nunca "cargando...")

### 2. **Event Sourcing como Fuente de Verdad**
- ✅ Cada acción genera un evento inmutable
- ✅ El estado se reconstruye aplicando eventos
- ✅ Permite auditoría completa
- ✅ Facilita resolución de conflictos

### 3. **Sincronización Asíncrona y Resiliente**
- ✅ Sync en background (no bloquea UI)
- ✅ Cola de eventos con prioridades
- ✅ Reintentos inteligentes con backoff exponencial
- ✅ Batching para eficiencia

---

## 🏛️ Capas de la Arquitectura

### **Capa 1: Domain Layer (packages/domain)**
```
packages/domain/
├── events/
│   ├── product.events.ts
│   ├── sale.events.ts
│   └── inventory.events.ts
├── aggregates/
│   ├── Product.ts
│   ├── Sale.ts
│   └── Inventory.ts
└── rules/
    └── business-rules.ts
```

**Responsabilidades:**
- Definición de eventos (tipos, schemas)
- Reglas de negocio puras
- Validación de eventos
- **Sin dependencias de DB o HTTP**

### **Capa 2: Application Layer (packages/application)**
```
packages/application/
├── use-cases/
│   ├── create-sale.use-case.ts
│   ├── update-product.use-case.ts
│   └── sync-events.use-case.ts
└── services/
    └── event-store.service.ts
```

**Responsabilidades:**
- Orquestación de casos de uso
- Aplicar reglas de negocio
- Generar eventos
- **Depende solo de Domain**

### **Capa 3: Sync Layer (packages/sync)**
```
packages/sync/
├── sync-queue.ts          # Cola de sincronización
├── sync-strategy.ts       # Estrategias de sync
├── conflict-resolver.ts   # Resolución de conflictos
└── sync-status.ts         # Estado de sincronización
```

**Responsabilidades:**
- Gestión de cola de eventos
- Estrategias de sincronización
- Resolución de conflictos
- **Independiente de UI y DB específica**

### **Capa 4: Infrastructure Layer (apps/*)**
```
apps/pwa/src/
├── db/
│   ├── database.ts        # Dexie/IndexedDB
│   └── repositories/
│       └── event.repository.ts
├── services/
│   ├── sync.service.ts    # Adaptador para packages/sync
│   └── api.service.ts     # HTTP client
└── hooks/
    └── use-sync.ts        # React hook
```

**Responsabilidades:**
- Adaptadores para IndexedDB/SQLite
- Adaptadores HTTP
- UI hooks
- **Implementa interfaces de Application/Sync**

---

## 🔄 Estrategia de Sincronización

### **1. Cola de Eventos con Prioridades**

```typescript
// packages/sync/src/sync-queue.ts

export enum EventPriority {
  CRITICAL = 100,  // Ventas, pagos
  HIGH = 50,       // Inventario, caja
  NORMAL = 25,     // Productos, clientes
  LOW = 10         // Configuración, logs
}

interface QueuedEvent {
  event: BaseEvent;
  priority: EventPriority;
  createdAt: number;
  attemptCount: number;
  lastAttemptAt?: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
}

export class SyncQueue {
  private queue: QueuedEvent[] = [];
  private isSyncing = false;
  
  // Agregar evento a la cola
  enqueue(event: BaseEvent, priority: EventPriority = EventPriority.NORMAL) {
    this.queue.push({
      event,
      priority,
      createdAt: Date.now(),
      attemptCount: 0,
      status: 'pending'
    });
    
    // Ordenar por prioridad (mayor primero)
    this.queue.sort((a, b) => b.priority - a.priority);
    
    // Intentar sync si no está en progreso
    this.trySync();
  }
  
  // Obtener batch de eventos para sincronizar
  getBatch(maxSize: number = 50): BaseEvent[] {
    const pending = this.queue.filter(e => e.status === 'pending');
    return pending.slice(0, maxSize).map(e => e.event);
  }
}
```

### **2. Estrategia de Reintentos (Exponential Backoff)**

```typescript
// packages/sync/src/retry-strategy.ts

export class RetryStrategy {
  private baseDelay = 1000; // 1 segundo
  private maxDelay = 60000; // 1 minuto
  private maxAttempts = 5;
  
  calculateDelay(attemptCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(
      this.baseDelay * Math.pow(2, attemptCount),
      this.maxDelay
    );
    
    // Agregar jitter aleatorio (±20%) para evitar thundering herd
    const jitter = delay * 0.2 * (Math.random() - 0.5);
    return Math.floor(delay + jitter);
  }
  
  shouldRetry(attemptCount: number, error: Error): boolean {
    if (attemptCount >= this.maxAttempts) return false;
    
    // No reintentar errores de validación (4xx)
    if (error.name === 'ValidationError') return false;
    
    // Reintentar errores de red, timeout, servidor (5xx)
    return true;
  }
}
```

### **3. Batching Inteligente**

```typescript
// packages/sync/src/batch-sync.ts

export class BatchSync {
  private batchSize = 50;
  private batchTimeout = 5000; // 5 segundos
  private pendingBatch: BaseEvent[] = [];
  private timeoutId?: NodeJS.Timeout;
  
  addEvent(event: BaseEvent) {
    this.pendingBatch.push(event);
    
    // Enviar inmediatamente si el batch está lleno
    if (this.pendingBatch.length >= this.batchSize) {
      this.flush();
      return;
    }
    
    // O enviar después del timeout
    if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => {
        this.flush();
      }, this.batchTimeout);
    }
  }
  
  async flush() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    
    if (this.pendingBatch.length === 0) return;
    
    const batch = [...this.pendingBatch];
    this.pendingBatch = [];
    
    await this.syncBatch(batch);
  }
}
```

### **4. Sincronización en Background (Service Worker)**

```typescript
// apps/pwa/src/sw/sync-handler.ts

// Service Worker para sincronización en background
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'sync-events') {
    event.waitUntil(syncEventsInBackground());
  }
});

async function syncEventsInBackground() {
  const db = new LaCajaDB();
  const pendingEvents = await db.localEvents
    .where('sync_status')
    .equals('pending')
    .toArray();
  
  if (pendingEvents.length === 0) return;
  
  // Sincronizar en batches
  const batchSize = 50;
  for (let i = 0; i < pendingEvents.length; i += batchSize) {
    const batch = pendingEvents.slice(i, i + batchSize);
    await syncBatch(batch);
  }
}
```

---

## ⚔️ Manejo de Conflictos

### **Tipos de Conflictos**

1. **Concurrent Modification (Edición simultánea)**
   - Múltiples dispositivos editan el mismo producto
   - **Solución**: Last-Write-Wins con timestamp o Merge Strategy

2. **Deleted vs Modified**
   - Dispositivo A elimina, Dispositivo B modifica
   - **Solución**: Regla de negocio (ej: "delete gana" o "modify gana")

3. **Sequence Gaps**
   - Eventos fuera de orden por problemas de red
   - **Solución**: Buffering y reordenamiento

### **Estrategias de Resolución**

```typescript
// packages/sync/src/conflict-resolver.ts

export enum ConflictResolution {
  LAST_WRITE_WINS = 'last-write-wins',
  FIRST_WRITE_WINS = 'first-write-wins',
  MERGE = 'merge',
  MANUAL = 'manual', // Requiere intervención humana
  REJECT = 'reject'
}

export class ConflictResolver {
  resolve(
    localEvent: BaseEvent,
    serverEvent: BaseEvent,
    type: string
  ): ConflictResolution {
    // Reglas específicas por tipo de evento
    switch (type) {
      case 'ProductUpdated':
        // Para productos, Last-Write-Wins es razonable
        return ConflictResolution.LAST_WRITE_WINS;
        
      case 'StockAdjusted':
        // Para inventario, merge de ajustes
        return ConflictResolution.MERGE;
        
      case 'SaleCreated':
        // Ventas nunca deberían tener conflicto (son nuevas)
        return ConflictResolution.REJECT;
        
      default:
        return ConflictResolution.LAST_WRITE_WINS;
    }
  }
  
  merge(localEvent: BaseEvent, serverEvent: BaseEvent): BaseEvent {
    // Implementar merge según tipo de evento
    // Por ejemplo, para StockAdjusted:
    // - Combinar ajustes: local.adjustment + server.adjustment
    return {
      ...localEvent,
      payload: {
        ...localEvent.payload,
        adjustment: 
          (localEvent.payload.adjustment || 0) + 
          (serverEvent.payload.adjustment || 0)
      }
    };
  }
}
```

### **Implementación en Servidor**

```typescript
// apps/api/src/sync/sync.service.ts (mejora)

async push(dto: PushSyncDto): Promise<PushSyncResponseDto> {
  // ... código existente ...
  
  // Detectar conflictos potenciales
  for (const event of dto.events) {
    if (event.type.includes('Updated')) {
      const existingEvent = await this.findConflictingEvent(event);
      if (existingEvent) {
        // Marcar como conflicto y devolver metadata
        rejected.push({
          event_id: event.event_id,
          seq: event.seq,
          code: 'CONFLICT',
          message: 'Conflicto detectado',
          conflict_with: existingEvent.event_id,
          resolution_hint: 'last-write-wins'
        });
        continue;
      }
    }
  }
  
  // ... resto del código ...
}
```

---

## 🚀 Optimizaciones

### **1. IndexedDB Optimizado**

```typescript
// apps/pwa/src/db/database.ts (mejora)

export class LaCajaDB extends Dexie {
  localEvents!: Table<LocalEvent, number>;
  
  constructor() {
    super('LaCajaDB');
    
    this.version(1).stores({
      // Índices optimizados para queries comunes
      localEvents: `
        ++id,
        event_id,
        store_id,
        device_id,
        seq,
        type,
        sync_status,
        created_at,
        [sync_status+created_at],  // Índice compuesto para queries
        [store_id+device_id+sync_status]  // Índice compuesto
      `,
      kv: 'key'
    });
  }
  
  // Query optimizada para obtener eventos pendientes
  async getPendingEvents(limit: number = 50): Promise<LocalEvent[]> {
    return this.localEvents
      .where('[sync_status+created_at]')
      .between(['pending', -Infinity], ['pending', Infinity])
      .limit(limit)
      .toArray();
  }
}
```

### **2. Read Models Locales (CQRS)**

```typescript
// apps/pwa/src/db/read-models.ts

// Proyectar eventos localmente para queries rápidas
export class LocalReadModels {
  async projectEvent(event: LocalEvent) {
    switch (event.type) {
      case 'ProductCreated':
      case 'ProductUpdated':
        await this.updateProductReadModel(event);
        break;
      case 'SaleCreated':
        await this.updateSalesReadModel(event);
        break;
      // ... más proyecciones
    }
  }
  
  // Query rápida sin reconstruir desde eventos
  async getProduct(id: string) {
    return this.db.products.get(id);
  }
}
```

### **3. Compresión de Eventos**

```typescript
// Para eventos grandes, comprimir antes de sincronizar
import pako from 'pako';

async function compressEvents(events: BaseEvent[]): Promise<Uint8Array> {
  const json = JSON.stringify(events);
  return pako.deflate(json);
}

// En el servidor, descomprimir
async function decompressEvents(compressed: Uint8Array): Promise<BaseEvent[]> {
  const json = pako.inflate(compressed, { to: 'string' });
  return JSON.parse(json);
}
```

### **4. Compresión de Eventos Históricos**

```typescript
// Archivar eventos antiguos para liberar espacio
async function archiveOldEvents(maxAge: number = 90 * 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAge;
  const oldEvents = await db.localEvents
    .where('created_at')
    .below(cutoff)
    .and(e => e.sync_status === 'synced')
    .toArray();
  
  // Comprimir y mover a tabla de archivo
  const compressed = await compressEvents(oldEvents);
  await db.archivedEvents.bulkAdd(oldEvents.map(e => ({
    ...e,
    compressed_data: compressed
  })));
  
  // Eliminar de tabla principal
  await db.localEvents.bulkDelete(oldEvents.map(e => e.id!));
}
```

---

## 📊 Monitoreo y Observabilidad

### **Métricas Clave**

```typescript
// packages/sync/src/sync-metrics.ts

export interface SyncMetrics {
  // Estado
  pendingEvents: number;
  syncedEvents: number;
  failedEvents: number;
  
  // Performance
  avgSyncDuration: number;
  lastSyncDuration: number;
  lastSyncAt: number;
  
  // Errores
  errorRate: number;
  lastError?: string;
  
  // Throughput
  eventsPerMinute: number;
  bytesPerSecond: number;
}

export class SyncMetricsCollector {
  private metrics: SyncMetrics = {
    pendingEvents: 0,
    syncedEvents: 0,
    failedEvents: 0,
    avgSyncDuration: 0,
    lastSyncDuration: 0,
    lastSyncAt: 0,
    errorRate: 0,
    eventsPerMinute: 0,
    bytesPerSecond: 0
  };
  
  recordSync(duration: number, eventCount: number, bytes: number) {
    this.metrics.lastSyncDuration = duration;
    this.metrics.lastSyncAt = Date.now();
    this.metrics.syncedEvents += eventCount;
    
    // Calcular promedio móvil
    this.metrics.avgSyncDuration = 
      (this.metrics.avgSyncDuration * 0.9) + (duration * 0.1);
    
    // Calcular throughput
    const minutes = duration / 60000;
    this.metrics.eventsPerMinute = eventCount / minutes;
    this.metrics.bytesPerSecond = bytes / (duration / 1000);
  }
  
  recordError(error: Error) {
    this.metrics.failedEvents++;
    this.metrics.lastError = error.message;
    
    // Calcular error rate (últimos 100 eventos)
    const total = this.metrics.syncedEvents + this.metrics.failedEvents;
    this.metrics.errorRate = this.metrics.failedEvents / total;
  }
}
```

### **Logging Estructurado**

```typescript
// packages/sync/src/sync-logger.ts

export class SyncLogger {
  log(event: 'sync_start' | 'sync_success' | 'sync_error', data: any) {
    console.log(JSON.stringify({
      timestamp: Date.now(),
      event,
      ...data,
      // Agregar contexto
      device_id: this.deviceId,
      store_id: this.storeId
    }));
  }
}
```

---

## 🔒 Seguridad

### **1. Validación de Eventos**

```typescript
// packages/domain/src/events/event-validator.ts

export class EventValidator {
  validate(event: BaseEvent): ValidationResult {
    // Validar estructura
    if (!event.event_id || !event.type || !event.payload) {
      return { valid: false, error: 'Estructura inválida' };
    }
    
    // Validar schema según tipo
    const schema = this.getSchemaForType(event.type);
    const result = schema.validate(event.payload);
    
    if (!result.valid) {
      return { valid: false, error: result.errors };
    }
    
    // Validar timestamp (no debe estar en el futuro)
    if (event.created_at > Date.now() + 60000) {
      return { valid: false, error: 'Timestamp inválido' };
    }
    
    return { valid: true };
  }
}
```

### **2. Rate Limiting en Cliente**

```typescript
// Prevenir spam de eventos
class EventRateLimiter {
  private events: number[] = [];
  private maxEvents = 100;
  private windowMs = 60000; // 1 minuto
  
  canEmit(): boolean {
    const now = Date.now();
    // Limpiar eventos fuera de ventana
    this.events = this.events.filter(t => now - t < this.windowMs);
    
    return this.events.length < this.maxEvents;
  }
  
  record() {
    this.events.push(Date.now());
  }
}
```

---

## 📈 Plan de Implementación

### **Fase 1: Mejoras Inmediatas (1-2 semanas)**
1. ✅ Implementar cola de sincronización con prioridades
2. ✅ Agregar reintentos con exponential backoff
3. ✅ Implementar batching inteligente
4. ✅ Mejorar índices de IndexedDB

### **Fase 2: Conflictos y Resiliencia (2-3 semanas)**
1. ✅ Implementar detección de conflictos
2. ✅ Estrategias de resolución básicas
3. ✅ Service Worker para sync en background
4. ✅ Métricas y logging

### **Fase 3: Optimizaciones Avanzadas (3-4 semanas)**
1. ✅ Read models locales (CQRS)
2. ✅ Compresión de eventos
3. ✅ Archivo de eventos antiguos
4. ✅ Optimizaciones de red (compresión, diffs)

### **Fase 4: Escalabilidad (4+ semanas)**
1. ✅ Sincronización incremental
2. ✅ P2P sync entre dispositivos
3. ✅ Cache inteligente de read models
4. ✅ Prefetching predictivo

---

## 🎯 Resultado Esperado

Con esta arquitectura lograrás:

✅ **99.9% de disponibilidad offline**  
✅ **Sincronización eficiente** (< 5s para 100 eventos)  
✅ **Resolución automática de la mayoría de conflictos**  
✅ **Escalable a millones de eventos**  
✅ **Observable y debuggable**  
✅ **Mantenible y testeable**

---

## 📚 Recursos Adicionales

- [Offline First Handbook](https://offlinefirst.org/)
- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)
- [Service Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
