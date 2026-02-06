# Sprint 6.2 - CRDT MAX (Ejecucion End-to-End)

**Objetivo:** convergencia formal con CRDTs por entidad, deltas compactados, compaction y verificacion automatica. Enfocado a offline-first, escalabilidad y reduccion de payload.

---

## 1) Alcance y no-alcance

### Alcance
- Contratos CRDT por entidad (merge/applyDelta) con deltas.
- Sync por deltas + digest causal.
- Compaction de eventos (snapshots + GC).
- Verificacion automatica de convergencia (hash/snapshot).
- Compatibilidad con escrow/inventario y caja.

### No-alcance (por ahora)
- CRDTs para modulos legacy sin event stream.
- Auto-merge semantico de cambios complejos de precio (solo LWW).
- Reescritura total de entidades no criticas.

---

## 2) Arquitectura objetivo

### CRDT Core
- **PN-Counter:** caja e inventario (deltas +/-).
- **LWW-Register:** precios, metadata basica.
- **OR-Set / AW-Set:** tags/flags.
- **RGA/LSEQ:** logs y auditoria.

### Sync
- **Delta-CRDT:** solo cambios atomicos.
- **Causal Digest:** resumen de causalidad para minimizar payload.
- **Idempotencia:** request_id + delta_id.

### Compaction
- **Snapshots:** estado CRDT por store_id y timestamp.
- **GC:** eliminar eventos absorbidos por snapshot.
- **Watermark:** checkpoint por entidad/store.

### Verificacion
- Job periodico de recalculo + hash.
- Alertas si drift > 0 y opcional autorepair.

---

## 3) Streams de trabajo (E2E)

### Stream A: Contratos CRDT
1. Definir interface `CRDT<TState, TDelta>`.
2. Definir `CRDTEnvelope` y validaciones:
   - entity, entity_id, store_id, delta_id, request_id, clock, delta, hash.
3. Implementar merge/applyDelta por entidad:
   - CashBalance (PN-Counter)
   - InventoryStock (PN-Counter)
   - Price (LWW)
   - Metadata (LWW)
   - Tags (OR-Set)
   - AuditLog (RGA/LSEQ)
4. Tests unitarios + property tests (conmutatividad, asociatividad, idempotencia).

### Stream B: Delta Sync
1. `delta_payload` obligatorio en eventos criticos.
2. `full_payload_hash` para integridad.
3. Digest causal en `/sync/push` response.
4. Cliente envia digest y solicita faltantes.
5. Metricas: `digest_hits`, `digest_misses`, `delta_batch_size`.

### Stream C: Compaction
1. Tabla `crdt_snapshots` (store_id, entity, version, hash, state, created_at).
2. Job `snapshot_create` cada N eventos o cada T minutos.
3. Job `event_gc` elimina eventos absorbidos por snapshot.
4. Guardar `snapshot_watermark`.

### Stream D: Verificacion
1. Job `crdt_verify` recalcula y compara hash.
2. Alertas de drift.
3. Auto-repair por config (rebuild + snapshot).

### Stream E: Escrow + CRDT
1. `StockDeltaApplied` soporta `from_escrow` y `quota_id`.
2. Consumo escrow primero, luego warehouse.
3. Dedupe por request_id (server + queue).
4. Strict/no-oversell enforceable.

### Stream F: Observabilidad
1. Metricas: `crdt_snapshot_created`, `crdt_verify_drift`, `sync_digest_hits`, `delta_rejected`.
2. Logs detallados de merge por entidad (debug flag).

---

## 4) PoCs de validacion

### PoC 1: Convergencia formal (10k eventos)
- 3 nodos offline, reorden y reintentos.
- Resultado: mismo hash de estado en todos los nodos.

### PoC 2: Compaction
- Generar 1M eventos, crear snapshot y borrar 95% del historial.
- Estado final identico.

### PoC 3: Escrow + CRDT
- 3 dispositivos consumiendo cuotas en paralelo.
- Estado converge y no duplica stock.

---

## 5) Criterios de aceptacion (DoD)
- Convergencia 100% en chaos test.
- Payload reducido >= 70% vs sync completo.
- Compaction elimina >= 90% del historial sin perder estado.
- Drift detectado y corregido en < 1 ciclo.
- Escrow e inventario coherentes (no oversell en strict).

---

## 6) Referencias
- ADR: `docs/architecture/adr/ADR-008-crdt-max-compaction.md`
- Tasks: `docs/roadmap/SPRINT_6_2_CRDT_MAX_TASKS.md`
- Checklist: `docs/roadmap/SPRINT_6_2_CRDT_MAX_CHECKLIST.md`
- Diagrama: `docs/architecture/DIAGRAMA_CRDT_MAX.md`
