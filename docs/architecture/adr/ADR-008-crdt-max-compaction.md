# ADR-008: CRDT MAX (Compaction + Verificacion de Convergencia)

## Estado
Propuesto (Sprint 6.2)

## Contexto
Sprint 6.1 implementa ledger, deltas y escrow con idempotencia. Para llevar la sincronizacion a nivel industrial, necesitamos:
- CRDTs formales por entidad (merge/applyDelta deterministas).
- Sync de deltas con digest causal (menos ancho de banda).
- Compaction y garbage collection de eventos para evitar crecimiento infinito.
- Verificacion automatica de convergencia (hash/snapshot).

## Decision
Adoptar una arquitectura CRDT MAX con 4 pilares:
1) **Contratos CRDT por entidad** (PN-Counter, LWW-Register, OR-Set, RGA/LSEQ).
2) **Delta-CRDTs reales** (delta_payload + full_payload_hash).
3) **Compaction/GC** (snapshots + pruning causal).
4) **Verificacion continua** (recalculo + comparacion de hashes).

## Consecuencias
### Positivas
- Convergencia matematica demostrable.
- Reduccion drastica de payload en sync.
- Menos drift y correcciones manuales.

### Negativas
- Mayor complejidad de implementacion.
- Necesidad de herramientas de monitoreo y tests de caos.

## Alternativas Consideradas
- Mantener ledger + deltas sin compaction: rechazado por costo acumulado.
- Confiar solo en LWW: rechazado por perdida de integridad.

## Notas de Implementacion
- Definir `crdt/` como modulo compartido con `merge(state, delta)`.
- Snapshots por store_id con hash del estado.
- Digest causal para reducir sync (Bloom/Digests).
