# Sprint 6.2 - CRDT MAX (Checklist de Ejecucion)

## Preparacion
- [ ] ADR-008 aprobado
- [ ] Feature flag `crdt_max` definido
- [ ] Entidades objetivo confirmadas
- [ ] Versionado de eventos CRDT definido

## Contratos CRDT
- [ ] PN-Counter (cash/inventory) listo
- [ ] LWW-Register (price/metadata) listo
- [ ] OR-Set (tags) listo
- [ ] RGA/LSEQ (audit logs) listo
- [ ] CRDTEnvelope validado (delta_id + request_id)
- [ ] Property tests (conmutativo/asociativo/idempotente)

## Sync Delta
- [ ] delta_payload obligatorio
- [ ] full_payload_hash validado
- [ ] Digest causal implementado
- [ ] digest_hits/misses metricas

## Compaction
- [ ] Tabla `crdt_snapshots` creada
- [ ] Job snapshot activo
- [ ] Job GC activo
- [ ] Watermark por entidad/store

## Verificacion
- [ ] Job crdt_verify activo
- [ ] Alertas de drift
- [ ] Auto-repair (si config)

## Escrow + Inventario
- [ ] Consumo escrow primero
- [ ] Strict/no-oversell enforceable
- [ ] Dedupe request_id en stock/escrow

## Pruebas
- [ ] Chaos test 10k eventos OK
- [ ] Compaction test OK
- [ ] Convergencia final OK
- [ ] Escrow converge OK

## Rollout
- [ ] Piloto activado
- [ ] Monitoreo 7 dias
- [ ] Go/No-Go
