# ADR-007: Convergencia automatica CRDT + Escrow (Caja e Inventario)

## Estado
Aprobado (Sprint 6.1)

## Contexto
Velox POS opera offline-first con sincronizacion por eventos. La convergencia actual reduce conflictos, pero en dominios criticos (caja e inventario) aun existen brechas: MVR en datos sensibles y falta de garantias formales cuando hay concurrencia offline.

## Decision
Adoptar un modelo de **convergencia automatica** basado en:
1) **Ledger inmutable** como fuente de verdad (eventos semanticos).
2) **CRDTs derivadas** para vistas operativas (PN-Counter y deltas).
3) **Escrow de stock** para preservar invariantes (no oversell) mientras offline.

### Caja
- Ledger de transacciones como verdad (inmutable).
- Saldo operacional calculado como PN-Counter derivado del ledger.
- Eventos de control (apertura/cierre) con Lamport clocks para orden causal estricto.

### Inventario
- No sincronizar estados finales (stock). Solo **movimientos** (+x / -x).
- Escrow por SKU y nodo (cupos). El nodo no puede vender fuera de cuota offline.
- Transferencia de cupos solo online.
- Opcion de politica de sobreventa para negocios que la acepten.

### MVR/LWW
- MVR solo para metadata no conmutativa.
- Precios con LWW determinista + auditoria (valor previo en ledger/audit log).

## Consecuencias
### Positivas
- Convergencia matematica sin intervencion manual en caja/inventario.
- Menor ancho de banda (delta-CRDTs).
- Mayor confianza operacional en escenarios offline.

### Negativas
- Incremento de complejidad (escrow + ledger + derivaciones).
- Necesidad de migracion y backfill de historico.
- Requiere pruebas de convergencia y simulaciones multi-nodo.

## Alternativas Consideradas
- Mantener MVR + revision humana: rechazado para dominios criticos.
- LWW global: rechazado por perdida de integridad en concurrencia.
- Bloqueo online obligatorio: rechazado por degradar offline-first.
