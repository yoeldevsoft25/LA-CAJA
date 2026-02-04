# RFC: Offline-First World-Class v2

- Estado: Proposed
- Fecha: 2026-02-04
- Owner: Platform Sync Team
- Alcance: `apps/pwa`, `apps/api`, `packages/sync`, `packages/offline-core`

## 1) Objetivo

Llevar el sistema a un nivel "offline-first extremo" para operar dias sin servidor, con:

1. Cero perdida de eventos.
2. Idempotencia estricta extremo a extremo.
3. Reconciliacion deterministica al reconectar.
4. Tolerancia a cortes de 4h+ sin degradar UX critica de caja/ventas.

## 2) Hallazgos bloqueantes (estado actual)

1. Motor de conflicto con match fragil de tipo de evento (riesgo de conflictos no detectados).
2. `push` no atomico para `events + usage` (riesgo de inconsistencia).
3. Cursor `pull` solo por timestamp con `MoreThan` (riesgo de saltar eventos de borde).
4. Outbox local sin unicidad fuerte por `event_id` y con paths de duplicado.
5. Contrato de `seq` inconsistente (`seq: 0` en varios productores, no normalizado al encolar).
6. `failed -> pending` automatico en init (riesgo de poison events infinitos).
7. Query local de pendientes O(n) (`toArray + sort + slice`) bajo backlog grande.

## 3) Principios de diseno

1. Source of truth de mutaciones: log de eventos.
2. Exactly-once effect: por idempotencia + upserts + constraints.
3. Pull/push con cursor estable y monotono (no ambiguo por tiempo).
4. Fallar seguro: errores permanentes a cuarentena (DLQ), no reintento infinito.
5. Compatibilidad gradual: protocolo v1/v2 durante rollout.

## 4) Arquitectura objetivo

### 4.1 Outbox local v2 (PWA)

- Mantener IndexedDB como journal durable.
- Endurecer schema con unicidad de `event_id`.
- Separar estados:
  - `pending`
  - `retrying`
  - `synced`
  - `conflict`
  - `dead` (permanente / cuarentena)
- Agregar metadatos:
  - `next_retry_at`
  - `last_error_code`
  - `last_error_message`
  - `acked_at`

Schema propuesto (Dexie v7):

```ts
localEvents:
  "++id,&event_id,[store_id+device_id+seq],seq,type,sync_status,created_at,[sync_status+created_at],[sync_status+next_retry_at]"
```

### 4.2 Asignacion de secuencia local deterministica

- Unificar generacion `seq` en `syncService.enqueueEvent()`.
- Ignorar `seq` entrante si `<= 0`.
- Asignar `seq` con contador atomico por `(store_id, device_id)` usando transaccion Dexie + KV:
  - key: `seq_counter:{store_id}:{device_id}`

Resultado: todos los productores pueden emitir `seq: 0`, pero nunca sale del outbox sin seq valido.

### 4.3 Protocolo Sync v2

#### Push

- `POST /sync/push`
- Idempotencia por `event_id` (ya existe en server).
- Respuesta v2:
  - `accepted[]`
  - `rejected[]`
  - `conflicted[]`
  - `server_vector_clock`
  - `ack_cursor` (tuple estable para pull)

#### Pull

- Cursor compuesto, no solo tiempo:
  - `cursor = (received_at, event_id)`
- Query estable:
  - `(received_at > t) OR (received_at = t AND event_id > id)`
- Orden total:
  - `ORDER BY received_at ASC, event_id ASC`

Con esto no hay perdidas por empates de timestamp.

### 4.4 Ingesta transaccional en backend

En `push`:

1. Abrir transaccion DB.
2. Persistir eventos (idempotente).
3. Aplicar side-effects de cuotas/contadores.
4. Commit.
5. Encolar proyecciones async post-commit.

Si falla cualquier paso previo al commit: rollback total.

### 4.5 Conflictos y causalidad

- Corregir deteccion de tipo de entidad (case-insensitive robusto).
- En respuesta de push retornar `server_vector_clock` real.
- Mantener CRDT para auto-resolucion, pero con rutas claras a `manual` y estado `conflict`.

### 4.6 Retry y DLQ

- Errores `4xx` de validacion => `dead` directo (no reintento ciego).
- Errores `5xx/network` => retry exponencial con jitter + `next_retry_at`.
- Reprocesamiento de `dead` solo manual/operador (accion explicita).

### 4.7 Anti-entropy creativo (nivel elite)

Agregar mecanismo de verificacion de convergencia por segmentos (piloto):

1. Particionar eventos por `store_id + dia + bucket`.
2. Calcular `segment_hash` (hash estable de `event_id + full_payload_hash` ordenado).
3. Endpoint de comparacion de segmentos cliente-servidor.
4. Si mismatch, solicitar "repair pull" solo del segmento.

Esto detecta divergencia silenciosa incluso cuando los flujos normales parecen sanos.

## 5) Cambios concretos por modulo

### PWA

- `apps/pwa/src/db/database.ts`
  - Version 7 con `&event_id`, `next_retry_at`, `dead`.
  - Reescribir `getPendingEvents()` para usar indice compuesto (sin `toArray + sort` global).
- `apps/pwa/src/services/sync.service.ts`
  - Asignador central de `seq`.
  - No resetear `failed` automaticamente en init.
  - Bucle de drenado de backlog hasta vaciar o limite de tiempo.
  - Manejo de `dead` + telemetria diferenciada.
- `apps/pwa/src/sw.ts`
  - Handshake de token fresco via `postMessage` o refresh controlado.
  - No marcar `failed` permanente por expiracion temporal de token sin clasificacion.

### API

- `apps/api/src/sync/sync.service.ts`
  - Transaccion completa para `save events + usage increments`.
  - Cursor pull compuesto (`received_at`,`event_id`).
  - Retornar `server_vector_clock`.
  - Fix de deteccion de conflicto por tipo.
- `apps/api/src/sync/dto/push-sync.dto.ts`
  - Extender response dto con `server_vector_clock` y `ack_cursor`.
- `apps/api/src/database/migrations/*`
  - Crear indices para pull cursor estable.
  - Reforzar indice unico `(store_id, device_id, seq)` tras normalizar datos.

### Tests

- `apps/pwa/e2e/offline.spec.ts`
  - Actualizar version DB y casos reales de cola/sync.
- Nuevos chaos tests:
  - backlog 10k eventos
  - duplicados masivos
  - reloj desfasado
  - corte durante push
  - token expirado en SW

## 6) Plan de implementacion (3 semanas)

## Semana 1 - Integridad dura (must)

1. Outbox v2: unicidad `event_id`, estados, indices.
2. Asignador central de `seq`.
3. Push backend transaccional.
4. Pull cursor compuesto.
5. Fix conflict matching case-insensitive.

Entrega: cero perdida en pruebas de borde de cursor + no inconsistencias de cuota.

## Semana 2 - Resiliencia operacional

1. DLQ (`dead`) + clasificacion de errores.
2. Reintentos con `next_retry_at`.
3. Drenado de backlog por ventanas (no hard-limit 1000 fijo).
4. Hardening SW auth.

Entrega: reconexion 4h con backlog alto sin loops ni estancamiento.

## Semana 3 - Anti-entropy y excelencia

1. Segment hash y endpoint de reconciliacion.
2. Repair pull por segmento.
3. Dashboard de convergencia y alarmas.

Entrega: deteccion automatica de divergencia silenciosa.

## 7) Criterios de aceptacion (Definition of Done)

1. Event loss = 0 en 100k eventos simulados (multi-dispositivo).
2. Duplicados de `event_id` en server = 0 (rechazados/idempotentes).
3. p95 de recovery tras 4h offline < 120s para 5k eventos.
4. Cero saltos de pull en test de empates de timestamp.
5. Poison event no bloquea cola general.
6. Convergencia validada por anti-entropy sin mismatch no explicado.

## 8) Riesgos y mitigaciones

1. Riesgo: migracion de outbox en clientes con datos legacy.
   - Mitigacion: migracion progresiva y fallback de lectura dual.
2. Riesgo: constraint unico `(store_id,device_id,seq)` falla por datos viejos.
   - Mitigacion: script de limpieza previo + rollout por tenant.
3. Riesgo: complejidad operativa de anti-entropy.
   - Mitigacion: piloto por una tienda antes de global.

## 9) Decisiones fuera de alcance (por ahora)

1. Reemplazo total de CRDT por OT.
2. Multi-master cross-region server-side.
3. Encriptacion E2E por evento en cliente.

---

## Checklist de ejecucion inmediata

1. Crear migracion Dexie v7 en `apps/pwa/src/db/database.ts`.
2. Implementar `allocateSeq()` y forzar uso en `enqueueEvent()`.
3. Refactor transaccional de `push` en backend.
4. Implementar cursor compuesto en `pull`.
5. Agregar pruebas de regresion para cursor e idempotencia.
