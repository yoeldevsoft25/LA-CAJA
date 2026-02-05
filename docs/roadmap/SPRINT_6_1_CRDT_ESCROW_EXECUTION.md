# Sprint 6.1 - Convergencia CRDT + Escrow (Ejecucion End-to-End)

**Objetivo:** consistencia eventual fuerte sin intervencion manual en caja e inventario, manteniendo offline-first real.

---

## 1) Alcance y no-alcance

### Alcance
- Caja: Ledger inmutable + PN-Counter derivado.
- Inventario: deltas semanticos + escrow de stock por SKU/nodo.
- Idempotencia universal en eventos y colas.
- Causalidad estricta para eventos de control de caja (Lamport).
- Reduccion de MVR: solo metadata no conmutativa.

### No-alcance (por ahora)
- CRDTs para precios complejos con reglas de negocio multi-actor.
- Convergencia total para dominios no-criticos (config, catalogo extendido).

---

## 2) Arquitectura objetivo (resumen)

**Caja**
- **Ledger**: eventos `CashLedgerEntryCreated` (source of truth).
- **PN-Counter**: saldo derivado para UI/operacion.
- **Control**: `CashSessionOpened/Closed` con Lamport clocks.

**Inventario**
- **Deltas**: eventos `StockDeltaApplied` con `qty_delta` (+/-).
- **Escrow**: `StockQuotaGranted` / `StockQuotaTransferred`.
- **Politica**: oversell opcional configurable por tienda.

---

## 3) Diseño de eventos (schemas)

### Caja
- `CashLedgerEntryCreated`
  - `event_id`, `request_id`, `store_id`, `device_id`, `seq`, `vector_clock`
  - `payload`: `entry_id`, `type` (sale|expense|adjustment), `amount_bs`, `amount_usd`, `currency`, `cash_session_id`, `sold_at`

### Inventario
- `StockDeltaApplied`
  - `payload`: `movement_id`, `product_id`, `warehouse_id`, `qty_delta`, `reason`, `ref` (sale_id/transfer_id)

### Escrow
- `StockQuotaGranted`
  - `payload`: `quota_id`, `product_id`, `device_id`, `qty_granted`, `expires_at?`
- `StockQuotaTransferred`
  - `payload`: `from_device_id`, `to_device_id`, `product_id`, `qty` 

### Control caja (Lamport)
- `CashSessionOpened`
- `CashSessionClosed`

---

## 4) Trabajo end-to-end por streams

### Stream A: Backend (API + DB)
1. **Migraciones**
   - Tabla `cash_ledger_entries` (ledger inmutable).
   - Tabla `stock_escrow` (cuotas por SKU/nodo).
   - Indices por `store_id`, `product_id`, `device_id`.

2. **Eventos**
   - Validacion estricta de `event_id` y `request_id` (idempotencia).
   - Dedupe server-side en `events` y en colas BullMQ.

3. **Proyecciones**
   - `CashLedgerEntryCreated` -> PN-Counter + saldo por tienda/sesion.
   - `StockDeltaApplied` -> InventoryMovement + stock actual.

4. **Escrow API**
   - `POST /inventory/escrow/grant`
   - `POST /inventory/escrow/transfer`
   - `GET /inventory/escrow/status`

### Stream B: Sync Engine (PWA + Desktop)
1. Emitir **deltas semanticos** en inventario (no estados finales).
2. Aplicar **limite por cuota** offline. Si excede, bloquear o pedir transferencia (online).
3. Idempotencia en reintentos locales (request_id persistente).

### Stream C: UI/UX
1. Caja muestra saldo derivado + indicador de "convergencia".
2. Inventario muestra cuota local disponible por SKU cuando offline.
3. Politica de oversell configurable por tienda (warning UI).

### Stream D: Observabilidad
1. Metricas: `escrow_quota_usage`, `stock_delta_applied`, `ledger_dedupe_hits`.
2. Alertas: cuota agotada, drift entre ledger y saldo.

---

## 5) PoC de validacion

### PoC 1: Caja (PN-Counter)
- 3 dispositivos offline, 100 transacciones concurrentes.
- Resultado: saldo converge 100%, sin conflictos.

### PoC 2: Inventario (Escrow + Deltas)
- Stock limitado (5 unidades), 3 dispositivos offline.
- Resultado: con escrow no hay oversell; con politica negativa, deficit exacto.

---

## 6) Criterios de aceptacion (DoD)
- Convergencia 100% en PoC.
- Dedupe efectivo: eventos duplicados = 0.
- Reduccion de uso de red >= 40% (delta vs entidad completa).
- Oversell = 0 con escrow activo.

## 6.1) Checklist tecnico (tareas por PR)
Ver `docs/roadmap/SPRINT_6_1_CRDT_ESCROW_TASKS.md`.

---

## 7) Plan de rollout
1. Feature flag por tienda (opt-in).
2. Migracion progresiva de cajas activas.
3. Activar escrow solo para SKUs de alta rotacion al inicio.

---

## 8) Riesgos y mitigacion
- **Escrow insuficiente**: fallback a transferencia online o bloqueo controlado.
- **Dedupe incompleto**: backfill de request_id y validacion en colas.
- **UX de cuota**: capacitar a tiendas y mostrar estado claro.
