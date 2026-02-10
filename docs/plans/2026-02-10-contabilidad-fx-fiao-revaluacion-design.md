# Diseno: Contabilidad Multi-Moneda (Venezuela/BCV), FIAO y Revaluacion FX

**Fecha:** 2026-02-10

## Contexto y Objetivo
La operacion es en Venezuela con precios/referencia en USD, cobros mixtos (incluye Zelle USD, Punto de Venta, transferencias, pago movil, efectivo) y ventas a credito (FIAO). El problema principal es la volatilidad del Bs: si no se valora correctamente, las CxC/CxP se descuadran, aparecen saldos negativos falsos y la contabilidad pierde confianza.

Objetivo: llevar el modulo contable a un nivel "top tier" garantizando asientos siempre balanceados, trazabilidad por metodo de pago, manejo robusto de FIAO bajo variaciones de tasa, y revaluacion mensual configurable de partidas monetarias en USD.

## Marco Contable (Estandares)
Esta fase se alinea con el tratamiento de moneda extranjera tipo **IAS 21 (NIIF / VEN-NIF)**:
- **Moneda funcional:** Bs.
- **Tasa oficial de libro:** BCV (spot del dia para reconocimiento inicial; BCV de cierre para revaluacion).
- **Diferencias de cambio:** realizadas (al cobrar/pagar) y no realizadas (por revaluacion al cierre) se llevan a resultados.

**No se implementa en esta fase IAS 29 (hiperinflacion / reexpresion por inflacion).** Se deja como Fase 2 por su complejidad (requiere indice general de precios, reexpresion de rubros no monetarios y estados financieros).

## Decisiones Funcionales (Aprobadas)
- **Bs (BCV) es la moneda primaria contable.** USD se usa como columna de referencia/denominacion (segun cuenta).
- **Separar cuentas de activo por metodo de pago** (Caja Bs, Caja USD, Banco/Transfer Bs, Pago Movil Bs, Punto de Venta, Zelle, etc.).
- **FIAO robusto:** reconocer diferencia cambiaria realizada al cobro y revaluacion no realizada al cierre.
- **Revaluacion configurable por cuenta** (no hardcode).
- **Zelle y Punto de Venta** tratados como cuentas monetarias USD revaluables por defecto (configurable).

## Problemas Actuales Detectados (A Corregir)
1. `generateEntryFromFiscalInvoice` no debita activo para metodos no-cash (TRANSFER/PAGO_MOVIL/ZELLE/POINT_OF_SALE/SPLIT), pudiendo crear asientos desbalanceados.
2. `generateEntryFromSale` no soporta split real: debita una sola cuenta de caja y consulta mapeos con igualdad JSON, lo que impide mapeos por metodo.
3. `generateEntryFromDebtPayment` acredita CxC al monto Bs del pago (tasa del dia), lo que puede dejar CxC Bs negativo cuando cambia la tasa (error contable).
4. DTOs/config de metodos de pago no incluyen ZELLE/POINT_OF_SALE en varios puntos (inconsistencia entre PWA y API).
5. `DebtsService` obtiene BCV sin `storeId` (debe ser por tienda).

## Alcance Tecnico (Resumen)
1. Mejorar resolucion de mapeos contables para soportar `conditions` parciales (jsonb containment) y multiples mapeos por `transaction_type` (segun metodo).
2. Asientos de venta/factura fiscal balanceados para **todos** los metodos, incluyendo `SPLIT`.
3. FIAO:
   - Guardar tasa de libro BCV en la deuda.
   - En pagos, acreditar CxC al valor libro y registrar diferencia cambiaria realizada.
4. Revaluacion mensual (no realizada) por periodo:
   - Generar asiento idempotente por periodo.
   - Revaluar solo cuentas marcadas como "monetarias USD".
   - Actualizar `Debt.book_rate_bcv` para deudas abiertas cuando aplique.

## Modelo de Datos (Cambios Propuestos)
### 1) Debts (FIAO)
Agregar:
- `debts.book_rate_bcv NUMERIC(18,6) NULL`
- `debts.book_rate_as_of TIMESTAMPTZ NULL`

Semantica:
- `book_rate_bcv`: tasa BCV usada para valoracion contable actual de la deuda en Bs.
- `book_rate_as_of`: fecha de la ultima valoracion (creacion o revaluacion).

### 2) Debt payments
Agregar (auditoria / trazabilidad):
- `debt_payments.bcv_rate NUMERIC(18,6) NULL` (tasa BCV usada para calcular `amount_bs`)
- `debt_payments.book_rate_bcv NUMERIC(18,6) NULL` (tasa libro aplicada a CxC en ese pago)
- `debt_payments.fx_gain_loss_bs NUMERIC(18,2) NULL` (diferencia realizada en Bs; puede ser negativa)

Nota: aunque puede recalcularse, guardarlo mejora auditoria y depuracion.

### 3) Config de revaluacion por cuenta
Usar `chart_of_accounts.metadata` con un contrato estable:
```json
{
  "fx_revaluation": {
    "enabled": true,
    "currency": "USD",
    "rate_type": "BCV"
  }
}
```
Esto evita crear tablas nuevas y mantiene configuracion por cuenta y por tienda.

## Plan de Cuentas y Mapeos
### Cuentas nuevas sugeridas (template)
Activos (ejemplo, ajustable por negocio):
- `1.01.01.01` Caja Bs
- `1.01.01.02` Caja USD
- `1.01.02.01` Banco/Transfer Bs
- `1.01.02.02` Pago Movil Bs
- `1.01.02.03` Punto de Venta
- `1.01.02.04` Zelle

Resultados (recomendado separar ganancia vs perdida para reportes):
- `4.02.04.01` Ganancia cambiaria realizada
- `4.02.04.02` Ganancia cambiaria no realizada
- `5.04.03.01` Perdida cambiaria realizada
- `5.04.03.02` Perdida cambiaria no realizada

### Mapeos contables (accounting_account_mappings)
Mantener `cash_asset` default como fallback, y agregar mapeos especificos por metodo:
- `cash_asset` + `conditions: { "method": "CASH_BS" }` -> Caja Bs
- `cash_asset` + `conditions: { "method": "CASH_USD" }` -> Caja USD
- `cash_asset` + `conditions: { "method": "TRANSFER" }` -> Banco/Transfer Bs
- `cash_asset` + `conditions: { "method": "PAGO_MOVIL" }` -> Pago Movil Bs
- `cash_asset` + `conditions: { "method": "POINT_OF_SALE" }` -> Punto de Venta
- `cash_asset` + `conditions: { "method": "ZELLE" }` -> Zelle

Agregar nuevos `transaction_type` para FX:
- `fx_gain_realized`, `fx_loss_realized`
- `fx_gain_unrealized`, `fx_loss_unrealized`

## Flujos Contables (Algoritmos)
### 1) Venta (sale)
Regla: asiento balanceado en Bs y USD.
- Si `FIAO`: Debe `accounts_receivable` por `total_bs/total_usd`.
- Si no FIAO y no split: Debe a `cash_asset` segun `method` (`conditions: { method }`).
- Si `SPLIT`: Debe multiple (una linea por `split_payments[]`) a `cash_asset` segun `split_item.method` usando `amount_bs/amount_usd` del split.
- Haber: `sale_revenue` (neto) + `sale_tax` (si aplica).
- Costo/inventario como hoy (si aplica).

### 2) Factura fiscal (fiscal_invoice)
Si existe asiento de `sale`, se "promociona" como hoy.
Si no existe:
- Resolver el Debe por metodo real:
  - Si `fiscalInvoice.sale_id`: cargar `Sale.payment` y aplicar mismas reglas de venta (incluye split).
  - Si no hay sale: usar `fiscalInvoice.payment_method` como `method` para `cash_asset`, o CxC si es credito.

### 3) Pago de deuda (debt_payment) con volatilidad Bs
Principio: **CxC se acredita al valor libro**, no al Bs calculado a la tasa del dia.

Inputs:
- `payment.amount_usd`
- `payment.amount_bs` (calculado por BCV del dia, segun politica)
- `debt.book_rate_bcv` (tasa libro vigente)

Calculos:
- `book_bs = round2(payment.amount_usd * debt.book_rate_bcv)`
- `fx_diff_bs = round2(payment.amount_bs - book_bs)`

Asiento:
- Debe: activo segun metodo por `payment.amount_bs` y `payment.amount_usd`
- Haber: CxC por `book_bs` y `payment.amount_usd`
- Diferencia (USD=0):
  - Si `fx_diff_bs > 0`: Haber `fx_gain_realized` por `fx_diff_bs`
  - Si `fx_diff_bs < 0`: Debe `fx_loss_realized` por `abs(fx_diff_bs)`

### 4) Revaluacion mensual (no realizada) al cierre
Se ejecuta durante `closePeriod` antes del asiento de cierre, y es idempotente:
- `source_type = period_fx_revaluation`
- `source_id = period.id`

Para cada cuenta con `metadata.fx_revaluation.enabled = true`:
- `expected_bs = round2(balance_usd * BCV_cierre)`
- `delta_bs = expected_bs - balance_bs`
- Si `abs(delta_bs) <= 0.01`: no postear
- Si `delta_bs > 0`: Debe cuenta (Bs) / Haber `fx_gain_unrealized` (Bs)
- Si `delta_bs < 0`: Haber cuenta (Bs) / Debe `fx_loss_unrealized` (Bs)
- USD en ambas lineas = 0 para mantener balance USD del asiento.

Si la cuenta es `accounts_receivable` y se decide revaluarla, actualizar para deudas abiertas:
- `debt.book_rate_bcv = BCV_cierre`
- `debt.book_rate_as_of = period_end`

## Integridad, Idempotencia y Redondeo
- Hard stop: no guardar asientos auto-generados si quedan desbalanceados (Bs o USD).
- `SPLIT`: validar suma de pagos vs total con tolerancia 0.01.
- Redondeo: estandarizar a 2 decimales en todas las lineas; si queda residuo, postear a una cuenta de "Ajustes por redondeo" (fase 1 si hace falta).

## Cambios en API/Validaciones (Consistencia)
- Expandir validaciones/DTOs para incluir `ZELLE` y `POINT_OF_SALE` donde aplique:
  - `payment_method_configs`
  - pagos parciales
  - pagos de deuda

## Plan de Pruebas
Unit:
- Resolucion de mapeo por `conditions.method` usando jsonb containment.
- Venta `SPLIT` genera Debe multiple y queda balanceada en Bs/USD.
- Pago FIAO con tasa distinta no deja CxC negativo y registra FX realizado.
- Revaluacion mensual crea asiento idempotente y ajusta solo Bs.

Integracion:
- `validateAccountingIntegrity` sin asientos desbalanceados en escenarios: venta (cash/transfer/zelle/pos/split), factura fiscal, nota de credito, pago de deuda parcial.

## Rollout / Migracion Operativa
- No romper tiendas existentes: mantener mapeo default actual si no hay mapeos por metodo.
- Para habilitar a nivel "pro": agregar cuentas y mapeos por metodo (seed/endpoint admin) y marcar cuentas revaluables en metadata.
- Ejecutar migraciones SQL de columnas nuevas (debts/debt_payments) antes de desplegar logica.

## Fase 2 (Opcional)
- IAS 29 (reexpresion por inflacion) para estados financieros.
- Mejoras de tesoreria: conciliaciones avanzadas por cuenta/metodo, conversiones USD->Bs como asientos explicitos, reportes y auditoria ampliada.

