# Sprint 6.2 - CRDT MAX (Checklist de Ejecucion)

## Preparacion
- [ ] ADR-008 aprobado
- [ ] Feature flag `crdt_max` definido
- [ ] Entidades objetivo confirmadas

## Contratos CRDT
- [ ] PN-Counter (cash/inventory) listo
- [ ] LWW-Register (price/metadata) listo
- [ ] OR-Set (tags) listo
- [ ] RGA/LSEQ (audit logs) listo

## Sync Delta
- [ ] delta_payload obligatorio
- [ ] full_payload_hash validado
- [ ] Digest causal implementado

## Compaction
- [ ] Tabla `crdt_snapshots` creada
- [ ] Job snapshot activo
- [ ] Job GC activo

## Verificacion
- [ ] Job crdt_verify activo
- [ ] Alertas de drift
- [ ] Auto-repair (si config)

## Pruebas
- [ ] Chaos test 10k eventos OK
- [ ] Compaction test OK
- [ ] Convergencia final OK

## Rollout
- [ ] Piloto activado
- [ ] Monitoreo 7 dias
- [ ] Go/No-Go
