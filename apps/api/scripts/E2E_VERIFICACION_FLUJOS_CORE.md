# Verificación E2E de flujos core del POS

Orden de verificación según el plan de flujos core. Ejecutar con API y DB levantados; usar un store con datos de prueba.

## Prerrequisitos

- API: `npm run dev` (o `start`) en `apps/api`
- PostgreSQL y Redis
- Token JWT de owner (Bearer) para los endpoints protegidos

---

## 1. Setup

- `POST /setup/run` con body `{ "business_type": "retail" }` (o el que corresponda)
- `GET /setup/validate` → revisar `is_complete`, `missing_steps`, `details` (en particular `has_accounting_mappings` y `accounting_mappings.sale_revenue`, `sale_cost`)
- Si hay `steps_failed`, corregir antes de seguir

## 2. Pagos

- En `payment_method_config`: poner un método (ej. PAGO_MOVIL) con `enabled: false`
- Crear venta con ese método → debe rechazar con mensaje claro
- Crear venta CASH_BS → debe pasar
- Opcional: `max_amount_bs` bajo; venta que lo supere debe fallar

## 3. Serie de factura

- Varias ventas seguidas → `invoice_number` creciente, `invoice_series.current_number` coherente
- Sin series activas → venta OK con `invoice_*` null

## 4. Contado (CASH_BS / CASH_USD)

- Abrir caja (`POST /cash/sessions/open`)
- Crear venta CASH_BS con `cash_payment_bs: { received_bs, change_bs }` si aplica
- Verificar: `sales`, `inventory_movements`, `warehouse_stock`
- Cerrar caja → `expected` Bs = apertura + (received_bs - change_bs)
- Análogo para CASH_USD con `cash_payment: { received_usd, change_bs }`

## 5. FIAO

- Cliente con `credit_limit > 0` y deuda abierta conocida
- Venta FIAO dentro del crédito → OK; `debts` con `sale_id` y `customer_id`
- Venta FIAO que supere crédito → rechazo
- Cierre de caja con mezcla CASH + FIAO → `expected` solo con CASH
- Asiento contable para FIAO → débito a `accounts_receivable`

## 6. SPLIT

- Venta SPLIT con `split: { cash_bs, pago_movil_bs }` que sume el total
- Verificar `payment.split` en la venta
- Cierre de caja → `expected` Bs solo con `payment.split.cash_bs`

## 7. Fiscal

- Con `fiscal_config` activa: venta por API → esperar post-processing → `fiscal_invoices` (status issued) y `journal_entries` vía `generateEntryFromFiscalInvoice`
- Sin `fiscal_config`: no hay fila en `fiscal_invoices`; debe haber asiento por `generateEntryFromSale`

## 8. Contable

- Con y sin fiscal: verificar que no hay duplicados y que hay exactamente un asiento cuando corresponde
- FIAO: asiento con `accounts_receivable`; contado: con `cash_asset`

## 9. Caja

- Sesión con CASH, SPLIT y FIAO → `expected` solo CASH + SPLIT (parte efectivo)
- `cash_movements` (entry/exit) → `getMovementTotals` y `expected` correctos
- Cierre con `counted` distinto a `expected` → debe fallar o mostrar diferencia según reglas

## 10. Sync

- Simular `POST /sync/push` con evento `SaleCreated` (payload: items, totals, payment, customer_id si FIAO, cash_session_id, exchange_rate)
- Con `fiscal_config`: `fiscal_invoices` y `journal_entries`
- Sin `fiscal_config`: asiento por `generateEntryFromSale` en proyección
- Verificar `invoice_*` y `sale_number` en la venta proyectada

## 11. sale_payments

- Verificar que vistas/reportes que usan `sale_payments` se comportan bien con 0 filas (fallback a `sale.payment`)

---

## Comandos de ejemplo (ajustar HOST, TOKEN, STORE_ID)

```bash
# 1. Validar setup
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/setup/validate" | jq .

# 2. Abrir caja
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"cash_bs":0,"cash_usd":0}' "$HOST/cash/sessions/open" | jq .

# 3. Crear venta (minimal; rellenar product_id, cash_session_id, etc.)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"product_id":"...","qty":1}],"exchange_rate":1,"currency":"BS","payment_method":"CASH_BS"}' \
  "$HOST/sales" | jq .
```
