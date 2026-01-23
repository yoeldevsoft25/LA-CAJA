# Packages Codemap - LA-CAJA

**Última Actualización:** 2026-01-22

---

## Packages Compartidos

El proyecto usa un monorepo con workspaces. Los packages compartidos están en `packages/`.

---

## @la-caja/domain

**Ubicación:** `packages/domain/`

**Propósito:** Reglas de negocio puras, eventos, tipos de dominio

**Estructura:**
```
packages/domain/
├── src/
│   ├── events/
│   │   ├── event.factory.ts    # Factory de eventos
│   │   └── event.types.ts      # Tipos de eventos
│   └── index.ts                # Exports principales
```

**Exports Principales:**
- `BaseEvent` - Tipo base de evento
- `EventFactory` - Factory para crear eventos
- Tipos de eventos: `ProductCreatedEvent`, `SaleCreatedEvent`, etc.
- Tipos de dominio: `StoreRole`, `Currency`, `PaymentMethod`

**Uso:**
- Backend: Generación de eventos
- Frontend: Tipos compartidos
- Sync: Estructura de eventos

---

## @la-caja/sync

**Ubicación:** `packages/sync/`

**Propósito:** Motor de sincronización offline-first (CRDT, colas, circuit breakers)

**Estructura:**
```
packages/sync/
├── src/
│   ├── sync-queue.ts           # Cola de sincronización
│   ├── vector-clock.ts         # Vector clocks para CRDT
│   ├── circuit-breaker.ts      # Circuit breaker pattern
│   ├── cache-manager.ts         # Gestión de caché
│   ├── retry-strategy.ts       # Estrategias de reintento
│   ├── batch-sync.ts           # Sincronización por lotes
│   ├── sync-metrics.ts         # Métricas de sincronización
│   └── index.ts                # Exports principales
```

**Exports Principales:**
- `SyncQueue` - Cola de eventos para sincronizar
- `VectorClockManager` - Gestión de vector clocks
- `CircuitBreaker` - Circuit breaker para requests
- `CacheManager` - Gestión de caché local
- `SyncMetricsCollector` - Métricas de sync

**Uso:**
- Frontend: `sync.service.ts` usa estos componentes
- Backend: Puede usar para validación de sync

---

## @la-caja/application

**Ubicación:** `packages/application/`

**Propósito:** Casos de uso (orquestación)

**Estructura:**
```
packages/application/
├── src/
│   └── index.ts                # Exports principales
```

**Estado:** Mínimo uso actual

**Nota:** Reportado como no usado por knip, requiere verificación

---

## Dependencias entre Packages

```
@la-caja/domain (sin dependencias)
    ↑
@la-caja/sync (depende de domain)
    ↑
@la-caja/application (depende de domain, sync)
```

---

## Uso en Apps

### Backend (apps/api)

- Usa `@la-caja/domain` para tipos de eventos
- Puede usar `@la-caja/sync` para validación

### Frontend (apps/pwa)

- Usa `@la-caja/domain` para tipos compartidos
- Usa `@la-caja/sync` extensivamente en `sync.service.ts`

### Desktop (apps/desktop)

- Usa `@la-caja/domain` para tipos compartidos
- Puede usar `@la-caja/sync` para sync offline

---

## Build Order

1. `@la-caja/domain` (sin dependencias)
2. `@la-caja/sync` (depende de domain)
3. `@la-caja/application` (depende de domain, sync)
4. Apps (dependen de packages)

---

**Ver también:**
- [Backend Codemap](./backend.md)
- [Frontend Codemap](./frontend.md)
