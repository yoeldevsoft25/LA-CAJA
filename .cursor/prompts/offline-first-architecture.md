# 🚀 OFFLINE-FIRST WORLD-CLASS ARCHITECTURE - LA CAJA POS

## TABLA DE CONTENIDOS
1. [Visión General](#visión-general)
2. [Arquitectura de 3 Capas](#arquitectura-de-3-capas)
3. [Vector Clocks y Ordenamiento Causal](#vector-clocks)
4. [CRDT (Conflict-free Replicated Data Types)](#crdt)
5. [Operational Transformation](#operational-transformation)
6. [Sync Engine con Retry Inteligente](#sync-engine)
7. [Circuit Breaker Pattern](#circuit-breaker)
8. [Compresión Delta](#compresión-delta)
9. [Cache Estratificado L1/L2/L3](#cache-estratificado)
10. [Implementación Completa](#implementación)

---

## VISIÓN GENERAL

**Objetivo**: Crear el sistema POS offline-first más robusto del mundo, capaz de:
- ✅ Funcionar 100% offline durante semanas
- ✅ Sincronizar automáticamente cuando hay red
- ✅ Resolver conflictos de forma inteligente (automática + manual)
- ✅ Soportar múltiples dispositivos por tienda
- ✅ Garantizar consistencia eventual sin pérdida de datos
- ✅ Optimizar ancho de banda (compresión delta)
- ✅ Proteger el servidor (circuit breaker, rate limiting)

---

## ARQUITECTURA DE 3 CAPAS

### **L1: Memory Cache (Hot Data)**
- **Qué almacena**: Datos ultra-calientes (último turno)
- **TTL**: 5 minutos
- **Tamaño**: ~5-10 MB
- **Ejemplos**:
  - Productos vendidos en última hora
  - Sesión de caja actual
  - Precios y promociones activas
  - Cliente activo en pantalla

### **L2: IndexedDB (Warm Data + Pending Queue)**
- **Qué almacena**:
  - Eventos pendientes de sync (con metadata)
  - Read models proyectados localmente
  - Vector clock del dispositivo
  - Historial de sincronización
- **TTL**: 30 días
- **Tamaño**: ~100-500 MB
- **Ejemplos**:
  - Todas las ventas de último mes
  - Inventario completo de la tienda
  - Clientes y deudas activas
  - Configuración del POS

### **L3: Service Worker Cache (Static Assets)**
- **Qué almacena**: Assets estáticos
- **TTL**: Hasta que se actualice la app
- **Tamaño**: ~10-20 MB
- **Ejemplos**:
  - Código de la app (JS, CSS)
  - Imágenes de productos
  - Iconos y fuentes
  - Configuración inicial

---

## VECTOR CLOCKS

### **¿Qué son?**
Vector Clocks son estructuras de datos que permiten determinar el **orden causal** entre eventos en sistemas distribuidos.

### **Problema a resolver**
```
Dispositivo A (offline):  ProductUpdated(name="Coca Cola 1L")   @ 10:00
Dispositivo B (offline):  ProductUpdated(name="Coca-Cola 1000ml") @ 10:05

¿Cuál es la versión correcta cuando ambos sincronizan?
```

### **Solución con Vector Clocks**
```typescript
// Cada evento tiene un vector clock
Event A: {
  event_id: "uuid-a",
  type: "ProductUpdated",
  vector_clock: { deviceA: 42, deviceB: 10 },  // A conoce hasta seq 10 de B
  payload: { name: "Coca Cola 1L" }
}

Event B: {
  event_id: "uuid-b",
  type: "ProductUpdated",
  vector_clock: { deviceA: 40, deviceB: 17 },  // B conoce hasta seq 40 de A
  payload: { name: "Coca-Cola 1000ml" }
}

// Al sincronizar, el servidor compara:
// A.deviceA (42) > B.deviceA (40)  ✅ A es posterior
// B.deviceB (17) > A.deviceB (10)  ✅ B es posterior
// → CONFLICTO CONCURRENTE (split-brain)
```

### **Tipos de relaciones causales**
1. **A → B** (A happened-before B): `A.clock[i] ≤ B.clock[i]` para todo i
2. **A || B** (A concurrent con B): Ninguno es posterior al otro → CONFLICTO

---

## CRDT (Conflict-free Replicated Data Types)

### **Estrategia por tipo de dato**

#### **1. Last-Write-Wins (LWW) Register**
**Uso**: Campos simples que pueden sobrescribirse
**Ejemplos**: Nombre de producto, dirección de cliente, configuración

```typescript
// Estructura
interface LWWRegister<T> {
  value: T;
  timestamp: number;  // Epoch ms del cliente
  device_id: string;

  // Merge automático
  merge(other: LWWRegister<T>): LWWRegister<T> {
    if (other.timestamp > this.timestamp) return other;
    if (other.timestamp < this.timestamp) return this;
    // Tie-breaker: mayor device_id gana
    return other.device_id > this.device_id ? other : this;
  }
}

// Aplicación
ProductName {
  value: "Coca Cola 1L",
  timestamp: 1704067200000,  // 2024-01-01 10:00:00
  device_id: "device-a"
}

// Conflicto con:
ProductName {
  value: "Coca-Cola 1000ml",
  timestamp: 1704067500000,  // 2024-01-01 10:05:00
  device_id: "device-b"
}

// Resultado automático (merge):
ProductName {
  value: "Coca-Cola 1000ml",  // Gana el más reciente
  timestamp: 1704067500000,
  device_id: "device-b"
}
```

#### **2. Add-Wins Set (AWSet)**
**Uso**: Colecciones donde agregar siempre gana
**Ejemplos**: Movimientos de inventario, ítems de venta, pagos de deuda

```typescript
// Estructura
interface AWSet<T> {
  adds: Map<string, { value: T, timestamp: number }>;
  removes: Set<string>;

  // Add siempre gana sobre Remove
  merge(other: AWSet<T>): AWSet<T> {
    return {
      adds: new Map([...this.adds, ...other.adds]),
      removes: new Set([...this.removes, ...other.removes])
    };
  }

  // Query
  values(): T[] {
    return Array.from(this.adds.values())
      .filter(entry => !this.removes.has(entry.value.id))
      .map(entry => entry.value);
  }
}

// Aplicación: Inventario
Device A (offline): StockReceived(+10 units)
Device B (offline): StockAdjusted(-5 units)

// Ambos eventos se agregan al AWSet
// Resultado final: +10 -5 = +5 units
```

#### **3. Multi-Value Register (MVR)**
**Uso**: Cuando no se puede decidir automáticamente
**Ejemplos**: Precio de producto modificado concurrentemente

```typescript
// Estructura
interface MVRegister<T> {
  values: Set<{ value: T, timestamp: number, device_id: string }>;

  // No hace merge automático, retorna TODOS los valores concurrentes
  merge(other: MVRegister<T>): MVRegister<T> {
    return {
      values: new Set([...this.values, ...other.values])
    };
  }
}

// Aplicación: Precio concurrente
Device A: PriceChanged(price_bs: 5.00)
Device B: PriceChanged(price_bs: 5.50)

// Resultado: MVRegister con 2 valores
// → El servidor crea un ConflictEvent para resolución manual
```

#### **4. Counter CRDT (G-Counter)**
**Uso**: Contadores que solo incrementan
**Ejemplos**: Total de ventas del día, stock recibido acumulado

```typescript
// Estructura
interface GCounter {
  counts: Map<string, number>;  // device_id → count

  increment(device_id: string, amount: number): void {
    this.counts.set(device_id, (this.counts.get(device_id) || 0) + amount);
  }

  merge(other: GCounter): GCounter {
    const merged = new Map(this.counts);
    for (const [device, count] of other.counts) {
      merged.set(device, Math.max(merged.get(device) || 0, count));
    }
    return { counts: merged };
  }

  value(): number {
    return Array.from(this.counts.values()).reduce((sum, c) => sum + c, 0);
  }
}
```

---

## OPERATIONAL TRANSFORMATION

### **¿Cuándo usar OT?**
Cuando CRDT no puede resolver automáticamente (ej: textos, notas)

### **Ejemplo: Nota de venta editada concurrentemente**
```typescript
// Estado inicial
note: "Entrega mañana"

// Device A (offline): INSERT(" 8am") → "Entrega mañana 8am"
// Device B (offline): INSERT(" a domicilio") → "Entrega mañana a domicilio"

// Operaciones:
Op A: { type: 'INSERT', position: 16, text: ' 8am' }
Op B: { type: 'INSERT', position: 16, text: ' a domicilio' }

// OT Transform:
// - Op A se aplica primero (timestamp)
// - Op B se transforma: position = 16 + length(' 8am') = 20
// - Resultado: "Entrega mañana 8am a domicilio"
```

### **Implementación básica**
```typescript
interface Operation {
  type: 'INSERT' | 'DELETE';
  position: number;
  text?: string;
  length?: number;
}

function transform(op1: Operation, op2: Operation): Operation {
  if (op1.type === 'INSERT' && op2.type === 'INSERT') {
    if (op1.position <= op2.position) {
      return { ...op2, position: op2.position + op1.text.length };
    }
  }
  // ... más casos
  return op2;
}
```

---

## SYNC ENGINE

### **Retry Exponencial con Jitter**
```typescript
class SyncEngine {
  private retryDelays = [1000, 2000, 4000, 8000, 16000, 32000, 60000]; // ms
  private maxRetries = 7;

  async syncWithRetry(events: Event[]): Promise<void> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        await this.push(events);
        return; // Success!
      } catch (error) {
        if (attempt === this.maxRetries - 1) throw error;

        // Exponential backoff + jitter
        const baseDelay = this.retryDelays[attempt];
        const jitter = Math.random() * 0.4 - 0.2; // ±20%
        const delay = baseDelay * (1 + jitter);

        console.log(`Retry ${attempt + 1}/${this.maxRetries} in ${delay}ms`);
        await this.sleep(delay);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### **Batch Dinámico**
```typescript
class SyncEngine {
  private minBatchSize = 10;
  private maxBatchSize = 100;

  async syncPendingEvents(): Promise<void> {
    const pending = await this.getPendingEvents();

    // Ajustar batch según red
    const batchSize = this.calculateBatchSize();

    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);
      await this.syncWithRetry(batch);
    }
  }

  private calculateBatchSize(): number {
    const connection = (navigator as any).connection;
    if (!connection) return this.minBatchSize;

    // 4G/WiFi → batch grande, 3G → batch pequeño
    if (connection.effectiveType === '4g') return this.maxBatchSize;
    if (connection.effectiveType === '3g') return 50;
    return this.minBatchSize;
  }
}
```

---

## CIRCUIT BREAKER

### **Estados del Circuit Breaker**
```
CLOSED (normal) → 5 fallos consecutivos → OPEN (rechaza requests)
                                            ↓ (30s timeout)
                                         HALF_OPEN (prueba 1 request)
                                            ↓ (success)
                                         CLOSED
```

### **Implementación**
```typescript
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime: number = 0;

  private readonly failureThreshold = 5;
  private readonly timeout = 30000; // 30s
  private readonly successThreshold = 2; // para HALF_OPEN → CLOSED

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // OPEN: rechazar inmediatamente
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = CircuitState.HALF_OPEN;
        this.failureCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.failureCount = 0;
      this.state = CircuitState.CLOSED;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.error('Circuit breaker opened after', this.failureCount, 'failures');
    }
  }
}
```

---

## COMPRESIÓN DELTA

### **¿Qué es?**
En vez de enviar el evento completo, solo enviar los campos que cambiaron.

### **Ejemplo**
```typescript
// Sin compresión (178 bytes)
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "ProductUpdated",
  "payload": {
    "product_id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Coca Cola 1L",
    "price_bs": 5.00,
    "price_usd": 1.50,
    "active": true,
    "stock": 100
  }
}

// Con compresión delta (82 bytes) - 54% reducción
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "ProductUpdated",
  "delta": {
    "product_id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Coca Cola 1L"  // Solo lo que cambió
  }
}
```

### **Implementación**
```typescript
function createDeltaPayload(previous: any, current: any): any {
  const delta: any = {};

  for (const key in current) {
    if (current[key] !== previous[key]) {
      delta[key] = current[key];
    }
  }

  // Siempre incluir ID para identificar recurso
  delta.product_id = current.product_id;

  return delta;
}

// Uso
const previous = await getProduct(productId);
const updated = { ...previous, name: "Coca Cola 1L" };
const delta = createDeltaPayload(previous, updated);

await createEvent({
  type: 'ProductUpdated',
  delta,  // Solo campos cambiados
  full_payload_hash: hash(updated)  // Para validación
});
```

---

## CACHE ESTRATIFICADO

### **Estrategia de invalidación**
```typescript
class CacheManager {
  private l1Cache: Map<string, any> = new Map(); // Memory
  private l2Cache: IDBDatabase; // IndexedDB

  async get(key: string): Promise<any> {
    // 1. Buscar en L1 (memory)
    if (this.l1Cache.has(key)) {
      return this.l1Cache.get(key);
    }

    // 2. Buscar en L2 (IndexedDB)
    const l2Value = await this.getFromIndexedDB(key);
    if (l2Value) {
      // Promover a L1
      this.l1Cache.set(key, l2Value);
      return l2Value;
    }

    // 3. No encontrado, fetch del servidor
    const value = await this.fetchFromServer(key);
    await this.set(key, value);
    return value;
  }

  async set(key: string, value: any): Promise<void> {
    // Guardar en ambas capas
    this.l1Cache.set(key, value);
    await this.setInIndexedDB(key, value);

    // Evicción LRU si L1 está lleno
    if (this.l1Cache.size > 1000) {
      const firstKey = this.l1Cache.keys().next().value;
      this.l1Cache.delete(firstKey);
    }
  }

  async invalidate(key: string): Promise<void> {
    this.l1Cache.delete(key);
    await this.deleteFromIndexedDB(key);
  }
}
```

---

## IMPLEMENTACIÓN

Ahora vamos a implementar todo esto en el backend de LA CAJA.

### **Paso 1: Migración de Base de Datos**

```sql
-- apps/api/src/database/migrations/35_offline_first_world_class.sql

-- 1. Agregar vector clocks a eventos
ALTER TABLE events ADD COLUMN IF NOT EXISTS vector_clock JSONB DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS causal_dependencies TEXT[] DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS conflict_status TEXT DEFAULT 'resolved';
ALTER TABLE events ADD COLUMN IF NOT EXISTS delta_payload JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS full_payload_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_events_conflict_status ON events(store_id, conflict_status);
CREATE INDEX IF NOT EXISTS idx_events_vector_clock ON events USING GIN(vector_clock);

-- 2. Tabla de estado de sincronización por dispositivo
CREATE TABLE IF NOT EXISTS device_sync_state (
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  device_id UUID NOT NULL,
  last_synced_at TIMESTAMPTZ,
  last_synced_seq BIGINT DEFAULT 0,
  vector_clock JSONB DEFAULT '{}',
  pending_conflicts_count INT DEFAULT 0,
  health_status TEXT DEFAULT 'healthy', -- healthy/degraded/critical
  circuit_breaker_state TEXT DEFAULT 'CLOSED', -- CLOSED/OPEN/HALF_OPEN
  circuit_breaker_failure_count INT DEFAULT 0,
  circuit_breaker_last_failure_at TIMESTAMPTZ,
  last_sync_duration_ms INT,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, device_id)
);

CREATE INDEX idx_device_sync_state_health ON device_sync_state(store_id, health_status);
CREATE INDEX idx_device_sync_state_conflicts ON device_sync_state(store_id, pending_conflicts_count) WHERE pending_conflicts_count > 0;

-- 3. Tabla de conflictos pendientes
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  event_id_a UUID NOT NULL REFERENCES events(event_id),
  event_id_b UUID NOT NULL REFERENCES events(event_id),
  conflict_type TEXT NOT NULL, -- concurrent_update/split_brain/causal_violation
  entity_type TEXT NOT NULL, -- product/sale/customer/etc
  entity_id UUID NOT NULL,
  resolution_strategy TEXT, -- auto_lww/auto_awset/manual/ot
  resolution_status TEXT DEFAULT 'pending', -- pending/resolved/escalated
  resolution_value JSONB,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID, -- user_id que resolvió manualmente
  priority TEXT DEFAULT 'medium', -- critical/high/medium/low
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_conflicts_pending ON sync_conflicts(store_id, resolution_status) WHERE resolution_status = 'pending';
CREATE INDEX idx_sync_conflicts_priority ON sync_conflicts(store_id, priority, created_at DESC);
CREATE INDEX idx_sync_conflicts_entity ON sync_conflicts(store_id, entity_type, entity_id);

-- 4. Tabla de métricas de sincronización
CREATE TABLE IF NOT EXISTS sync_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  device_id UUID NOT NULL,
  sync_started_at TIMESTAMPTZ NOT NULL,
  sync_completed_at TIMESTAMPTZ,
  events_pushed INT DEFAULT 0,
  events_accepted INT DEFAULT 0,
  events_rejected INT DEFAULT 0,
  events_conflicted INT DEFAULT 0,
  payload_size_bytes INT DEFAULT 0,
  compression_ratio DECIMAL(5,2), -- 0.54 = 54% reducción
  network_latency_ms INT,
  server_processing_ms INT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_metrics_store_device ON sync_metrics(store_id, device_id, sync_started_at DESC);
CREATE INDEX idx_sync_metrics_failed ON sync_metrics(store_id, success) WHERE success = FALSE;

COMMENT ON TABLE device_sync_state IS 'Estado de sincronización por dispositivo (vector clocks, health, circuit breaker)';
COMMENT ON TABLE sync_conflicts IS 'Conflictos pendientes de resolución (automática o manual)';
COMMENT ON TABLE sync_metrics IS 'Métricas de rendimiento de sincronización';
```

---

## RESUMEN DE CAMBIOS

### **Backend (NestJS)**
1. ✅ Migración con vector clocks, device sync state, conflicts
2. 🚧 CRDT service (LWW, AWSet, MVR, GCounter)
3. 🚧 Vector clock service (merge, compare, detect concurrency)
4. 🚧 Conflict resolution service (auto + manual)
5. 🚧 Sync controller v2 (con delta compression)
6. 🚧 Circuit breaker guard
7. 🚧 Rate limiter por device_id

### **Frontend (Cliente)**
1. 🚧 Cache manager L1/L2/L3
2. 🚧 Sync engine con retry exponencial + jitter
3. 🚧 Circuit breaker client-side
4. 🚧 Delta compression encoder
5. 🚧 Conflict UI para resolución manual

---

## PRÓXIMOS PASOS

¿Quieres que implemente alguno de estos componentes ahora? Recomiendo empezar por:

1. **Vector Clock Service** - Base para todo el sistema
2. **CRDT Service** - Resolución automática de conflictos
3. **Sync Controller V2** - Endpoint mejorado con vector clocks
4. **Conflict Resolution Service** - Lógica de resolución

¿Por cuál empezamos? 🚀
