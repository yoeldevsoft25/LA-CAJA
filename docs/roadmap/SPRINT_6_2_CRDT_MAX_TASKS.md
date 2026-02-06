# Sprint 6.2 - CRDT MAX (Tareas tecnicas E2E)

Checklist ejecutable por PR. Orden sugerido por dependencia. Cada bloque debe cerrar con pruebas y telemetria minima.

---

## 0) Preparacion
- [ ] ADR-008 aprobado (objetivo, riesgos, limites).
- [ ] Definir entidades objetivo y CRDT asignado por entidad.
- [ ] Feature flag global `crdt_max` por store (config + default OFF).
- [ ] Versionado de eventos CRDT (`event_version`) y compatibilidad con legacy.
- [ ] Alinear naming de eventos con `packages/domain`.

---

## 1) Contratos CRDT (Core)
- [ ] Crear `packages/crdt` con interface `CRDT<TState, TDelta>`.
- [ ] Definir estructura `CRDTEnvelope`:
  - `entity`, `entity_id`, `store_id`, `delta_id`, `request_id`, `clock`, `delta`, `hash`.
- [ ] Implementar PN-Counter (cash/inventory).
- [ ] Implementar LWW-Register (price/metadata).
- [ ] Implementar OR-Set / AW-Set (tags/flags).
- [ ] Implementar RGA/LSEQ (audit log).
- [ ] Tests unitarios por CRDT (merge, applyDelta, idempotencia).
- [ ] Property tests: conmutatividad, asociatividad, idempotencia.

---

## 2) Delta-CRDTs (Schema + Validacion)
- [ ] `delta_payload` obligatorio en eventos criticos.
- [ ] `full_payload_hash` obligatorio (sha256 canonical).
- [ ] Validar `delta_id` y `request_id` en sync ingest.
- [ ] Rechazar eventos con hash invalido y emitir metricas.
- [ ] Documentar contrato deltas por entidad.

---

## 3) Causal Digest Sync
- [ ] Agregar digest causal en `/sync/push` response (`digest`, `from_event_id`).
- [ ] Cliente: enviar `digest` y solo deltas faltantes.
- [ ] Reducir payload en `sync/pull` usando digest.
- [ ] Metricas `digest_hits`, `digest_misses`, `delta_batch_size`.

---

## 4) Compaction & GC (Backend)
- [ ] Tabla `crdt_snapshots` (store_id, entity, version, hash, state, created_at).
- [ ] Job `snapshot_create` cada N eventos o T minutos.
- [ ] Job `event_gc` elimina eventos absorbidos (seguro por watermark).
- [ ] Guardar `snapshot_watermark` por entidad/store.

---

## 5) Verificacion de Convergencia
- [ ] Job `crdt_verify` recalcula estado desde eventos + compara hash.
- [ ] Alertas por drift (metrics + log).
- [ ] Auto-repair opcional por config (rebuild + snapshot).

---

## 6) Escrow + CRDT (Integracion)
- [ ] Alinear StockDeltaApplied con `from_escrow` y `quota_id`.
- [ ] Reglas de consumo: escrow primero, luego warehouse.
- [ ] Deltas de escrow con PN-Counter y dedupe por request_id.
- [ ] Validaciones server-side (strict/no-oversell).

---

## 7) Observabilidad
- [ ] Metricas: snapshot_created, verify_drift, digest_hits, delta_rejected.
- [ ] Logs de merge por entidad (debug flag).
- [ ] Dashboard de drift por store.

---

## 8) Testing / QA
- [ ] Chaos test 10k eventos reordenados (3 nodos).
- [ ] Compaction test 1M eventos -> snapshot -> GC.
- [ ] Integracion offline -> sync -> converge (PWA + API).
- [ ] Regression: legacy events siguen proyectando.

---

## 9) Rollout
- [ ] Activar `crdt_max` solo en tiendas piloto.
- [ ] Monitoreo intensivo 7 dias (drift, payload, latencia).
- [ ] Plan de rollback (flag OFF + snapshot freeze).
