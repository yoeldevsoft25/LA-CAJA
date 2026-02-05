# Sprint 6.1 - CRDT + Escrow (Tareas tecnicas E2E)

Checklist ejecutable por PR. Orden sugerido por dependencia.

---

## 0) Preparacion
- [ ] Alinear naming de eventos (schemas + payloads) con `packages/domain`.
- [ ] Definir flags de rollout por store (feature flags / config).
- [ ] ADR-007 aprobado por equipo (si cambia alcance, actualizar).

---

## 1) Backend - Datos y eventos

### 1.1 Migraciones
- [ ] Crear tabla `cash_ledger_entries` (ledger inmutable).
- [ ] Crear tabla `stock_escrow` (cuotas por SKU/nodo).
- [ ] Indices por `store_id`, `device_id`, `product_id`.
- [ ] Backfill basico (si aplica) o migracion sin downtime.

### 1.2 Eventos (schemas)
- [ ] `CashLedgerEntryCreated` (ledger)
- [ ] `StockDeltaApplied` (movimientos)
- [ ] `StockQuotaGranted` / `StockQuotaTransferred`
- [ ] Lamport clock para `CashSessionOpened/Closed`
- [ ] `request_id` obligatorio en todos los eventos criticos

### 1.3 Idempotencia
- [ ] Dedupe por `event_id` y `request_id` en sync ingest.
- [ ] Dedupe en colas BullMQ (retry no duplica estado).
- [ ] Guardas en proyecciones para no duplicar ledger/movements.

---

## 2) Backend - Proyecciones

### 2.1 Caja
- [ ] Proyeccion ledger -> PN-Counter saldo (por store + session).
- [ ] Validar coherencia ledger vs saldo.

### 2.2 Inventario
- [ ] Proyeccion `StockDeltaApplied` -> `inventory_movements`.
- [ ] Stock derivado solo por suma de movimientos.

---

## 3) Backend - Escrow API

- [ ] `POST /inventory/escrow/grant` (asigna cupos por SKU/nodo)
- [ ] `POST /inventory/escrow/transfer` (transferencia de cuota online)
- [ ] `GET /inventory/escrow/status` (estado de cupos por nodo)
- [ ] Validaciones: cuota >= 0, no exceder stock real

---

## 4) Sync Engine (PWA + Desktop)

- [ ] Emision de **deltas semanticos** (no enviar stock final).
- [ ] Enforcement de cupo local offline (no vender fuera de cuota).
- [ ] Persistir `request_id` por operacion (reintentos idem).
- [ ] Merge de vector clocks + Lamport (control events).

---

## 5) UI/UX

- [ ] Mostrar quota local disponible por SKU al estar offline.
- [ ] Mensaje de bloqueo si no hay cupo (o warning si oversell permitido).
- [ ] Indicador de convergencia (saldo/caja e inventario).

---

## 6) Observabilidad

- [ ] Metricas: `escrow_quota_usage`, `stock_delta_applied`, `ledger_dedupe_hits`.
- [ ] Logs de drift ledger vs saldo.
- [ ] Alertas si quota agotada frecuente.

---

## 7) Testing / QA

### PoC 1 (Caja)
- [ ] 3 dispositivos offline, 100 transacciones -> saldo converge 100%.

### PoC 2 (Inventario)
- [ ] Stock limitado, 3 dispositivos offline -> sin oversell con escrow.
- [ ] Variante oversell permitida -> deficit exacto.

### Pruebas automatizadas
- [ ] Unit tests de idempotencia en sync ingest.
- [ ] Integration tests de proyecciones (ledger + inventory).

---

## 8) Rollout

- [ ] Feature flag por tienda (opt-in).
- [ ] Activar escrow solo para SKUs alta rotacion inicialmente.
- [ ] Playbook de rollback si drift > threshold.

