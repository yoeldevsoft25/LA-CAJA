# Sprint 6.2 - CRDT MAX (Tareas tecnicas E2E)

Checklist ejecutable por PR. Orden sugerido por dependencia.

---

## 0) Preparacion
- [ ] Aprobar ADR-008.
- [ ] Definir entidades objetivo y CRDT asignado.
- [ ] Feature flag global `crdt_max` por store.

---

## 1) Contratos CRDT
- [ ] Crear `packages/crdt` con interface `CRDT<TState, TDelta>`.
- [ ] Implementar PN-Counter (cash/inventory).
- [ ] Implementar LWW-Register (price/metadata).
- [ ] Implementar OR-Set (tags).
- [ ] Implementar RGA/LSEQ (audit log).
- [ ] Tests unitarios por CRDT.

---

## 2) Delta-CRDTs
- [ ] Hacer `delta_payload` obligatorio en eventos criticos.
- [ ] Validar `full_payload_hash` en sync ingest.
- [ ] Rechazar eventos con hash invalido.

---

## 3) Causal Digest Sync
- [ ] Agregar digest causal en `/sync/push` response.
- [ ] Cliente: enviar digest y solo deltas faltantes.
- [ ] Metricas de `digest_hits`.

---

## 4) Compaction & GC
- [ ] Tabla `crdt_snapshots` (store_id, entity, version, hash, state).
- [ ] Job `snapshot_create` cada N eventos.
- [ ] Job `event_gc` elimina eventos ya absorbidos.

---

## 5) Verificacion de Convergencia
- [ ] Job `crdt_verify` recalcula estado desde eventos + compara hash.
- [ ] Alertas en drift.
- [ ] Auto-repair opcional por config.

---

## 6) Observabilidad
- [ ] Metricas: snapshot_created, verify_drift, digest_hits.
- [ ] Logs de merge por entidad (debug).

---

## 7) Testing / QA
- [ ] Chaos test 10k eventos reordenados.
- [ ] Compaction test 1M eventos -> snapshot -> GC.
- [ ] Integracion offline -> sync -> converge.

---

## 8) Rollout
- [ ] Activar `crdt_max` solo en tiendas piloto.
- [ ] Monitoreo intensivo durante 7 dias.
- [ ] Plan de rollback.
