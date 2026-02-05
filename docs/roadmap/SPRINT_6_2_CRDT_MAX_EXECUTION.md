# Sprint 6.2 - CRDT MAX (Ejecucion End-to-End)

**Objetivo:** convergencia formal con CRDTs por entidad, deltas compactados, compaction y verificacion automatica.

---

## 1) Alcance y no-alcance

### Alcance
- Contratos CRDT por entidad (merge/applyDelta).
- Sync por deltas + digest causal.
- Compaction de eventos (snapshots + GC).
- Verificacion automatica de convergencia (hash/snapshot).

### No-alcance (por ahora)
- CRDTs para configuraciones raras o modulos legacy sin event stream.
- Auto-merge semantico de cambios complejos de precio (solo LWW).

---

## 2) Arquitectura objetivo

### CRDT Core
- **PN-Counter:** caja e inventario.
- **LWW-Register:** precios, metadata basica.
- **OR-Set / AW-Set:** tags/flags.
- **RGA/LSEQ:** logs y auditoria.

### Sync
- **Delta-CRDT:** solo cambios.
- **Causal Digest:** resumen de causalidad para minimizar payload.

### Compaction
- **Snapshots:** estado CRDT por store_id y timestamp.
- **GC:** eliminar eventos absorbidos por snapshot.

### Verificacion
- Job periodico de recalculo + hash.
- Alertas si drift > 0.

---

## 3) Streams de trabajo

### Stream A: Contratos CRDT
1. Definir interface `CRDT<TState, TDelta>`.
2. Implementar merge/applyDelta por entidad:
   - CashBalance
   - InventoryStock
   - Price
   - Metadata
   - AuditLog

### Stream B: Delta Sync
1. `delta_payload` obligatorio en eventos criticos.
2. `full_payload_hash` para integridad.
3. Digest causal en respuesta de `/sync/push`.

### Stream C: Compaction
1. Tabla `crdt_snapshots` (store_id, entity, version, hash, state).
2. Job de snapshot cada N eventos.
3. GC de eventos previos ya absorbidos.

### Stream D: Verificacion
1. Job `crdt_verify` recalcula y compara hash.
2. Alertas de drift y auto-repair si config lo permite.

### Stream E: Observabilidad
1. Metricas: `crdt_snapshot_created`, `crdt_verify_drift`, `sync_digest_hits`.
2. Logs detallados de merge por entidad.

---

## 4) PoCs de validacion

### PoC 1: Convergencia formal (10k eventos)
- 3 nodos offline, reorden y reintentos.
- Resultado: mismo hash de estado en todos los nodos.

### PoC 2: Compaction
- Generar 1M eventos, crear snapshot y borrar 95% del historial.
- Estado final identico.

---

## 5) Criterios de aceptacion (DoD)
- Convergencia 100% en chaos test.
- Payload reducido >= 70% vs sync completo.
- Compaction elimina >= 90% del historial sin perder estado.
- Drift detectado y corregido en < 1 ciclo.

---

## 6) Referencias
- ADR: `docs/architecture/adr/ADR-008-crdt-max-compaction.md`
- Tasks: `docs/roadmap/SPRINT_6_2_CRDT_MAX_TASKS.md`
- Checklist: `docs/roadmap/SPRINT_6_2_CRDT_MAX_CHECKLIST.md`
- Diagrama: `docs/architecture/DIAGRAMA_CRDT_MAX.md`
