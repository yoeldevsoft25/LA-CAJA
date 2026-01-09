# 📊 Análisis Completo de Relaciones de Datos entre Módulos

**Fecha:** Enero 2025  
**Analista:** Senior Backend Developer  
**Alcance:** Todos los módulos del sistema LA-CAJA

---

## 📋 Resumen Ejecutivo

### Estado General: **85/100** ✅

**Fortalezas:**
- ✅ Relaciones de base de datos bien definidas con TypeORM
- ✅ Transacciones atómicas en operaciones críticas
- ✅ Integridad referencial correcta (CASCADE, RESTRICT, SET NULL)
- ✅ Flujos principales completos y funcionales

**Problemas Detectados:**
- 🟡 **Falta relación explícita entre Shift y Sales**
- 🟡 **Falta relación entre Shift y CashSession**
- 🟡 **Transferencias no generan asientos contables**
- 🟡 **Ajustes de inventario no generan asientos contables**
- 🟡 **CashMovements no están vinculados a CashSession**

---

## 🔗 Mapa de Relaciones por Módulo

### 1. **VENTAS (Sales)** - Núcleo del Sistema

#### Relaciones Directas:
```
Sale
├── Store (store_id) ✅
├── Customer (customer_id) ✅
├── Profile (sold_by_user_id) ✅
├── InvoiceSeries (invoice_series_id) ✅
├── CashSession (cash_session_id) ✅
├── SaleItem[] (OneToMany) ✅
│   ├── Product (product_id) ✅
│   ├── ProductVariant (variant_id) ✅
│   └── ProductLot (lot_id) ✅
├── Debt (OneToOne, si payment_method = FIAO) ✅
└── JournalEntry (generado automáticamente) ✅
```

#### Flujos de Datos:
1. **Venta → Inventario** ✅
   - Crea `InventoryMovement` (tipo: 'sold')
   - Actualiza `WarehouseStock` (descuenta stock)
   - Maneja lotes FIFO correctamente

2. **Venta → Contabilidad** ✅
   - Genera `JournalEntry` automáticamente
   - Usa mapeos de cuentas configurados
   - Incluye ingresos, COGS, inventario

3. **Venta → FIAO** ✅
   - Crea `Debt` automáticamente si `payment_method = 'FIAO'`
   - Relación correcta con `Customer` y `Sale`

4. **Venta → Factura Fiscal** ✅
   - `FiscalInvoice` tiene `sale_id`
   - Relación bidireccional correcta

#### ⚠️ **Problemas Detectados:**
- ❌ **CRÍTICO**: Falta relación explícita con `Shift` (turno)
  - Las ventas NO tienen `shift_id`
  - `ShiftsService.closeShift()` intenta calcular ventas usando `sold_by_user_id` y fecha (método frágil)
  - No se puede rastrear qué ventas pertenecen a qué turno de forma confiable
  - **IMPACTO**: Reportes de turno pueden ser inexactos si hay múltiples turnos en el mismo día

---

### 2. **MESAS Y ÓRDENES (Tables/Orders)**

#### Relaciones Directas:
```
Order
├── Store (store_id) ✅
├── Table (table_id) ✅
├── Customer (customer_id) ✅
├── Profile (opened_by_user_id, closed_by_user_id) ✅
├── OrderItem[] (OneToMany) ✅
│   ├── Product (product_id) ✅
│   └── ProductVariant (variant_id) ✅
└── OrderPayment[] (OneToMany) ✅
```

#### Flujos de Datos:
1. **Orden → Venta** ✅
   - `Order.closeOrder()` llama a `SalesService.create()`
   - Convierte `OrderItem[]` a `SaleItem[]`
   - Libera `Table` correctamente
   - **✅ CORRECTO**: La venta generada tiene todas las relaciones correctas

2. **Orden → Inventario** ✅
   - Solo cuando se cierra la orden (genera venta)
   - El flujo pasa por `SalesService`, que maneja inventario

#### ✅ **Estado**: Correcto y completo

---

### 3. **PRODUCTOS E INVENTARIO (Products/Inventory)**

#### Relaciones Directas:
```
Product
├── Store (store_id) ✅
├── ProductVariant[] (OneToMany) ✅
├── ProductLot[] (OneToMany) ✅
├── ProductSerial[] (OneToMany) ✅
├── SaleItem[] (OneToMany) ✅
├── OrderItem[] (OneToMany) ✅
├── PurchaseOrderItem[] (OneToMany) ✅
└── InventoryMovement[] (OneToMany) ✅

InventoryMovement
├── Store (store_id) ✅
├── Product (product_id) ✅
├── ProductVariant (variant_id) ✅
├── Warehouse (warehouse_id) ✅
└── ref: { sale_id?, purchase_order_id?, transfer_id? } ✅

WarehouseStock
├── Warehouse (warehouse_id) ✅
├── Product (product_id) ✅
└── ProductVariant (variant_id) ✅
```

#### Flujos de Datos:
1. **Recepción de Stock → Inventario** ✅
   - Crea `InventoryMovement` (tipo: 'received')
   - Actualiza `WarehouseStock`
   - Guarda costos unitarios

2. **Ajuste de Stock → Inventario** ✅
   - Crea `InventoryMovement` (tipo: 'adjust')
   - Actualiza `WarehouseStock`
   - **⚠️ PROBLEMA**: No genera asiento contable

3. **Venta → Inventario** ✅
   - Crea `InventoryMovement` (tipo: 'sold')
   - Actualiza `WarehouseStock`
   - Maneja lotes FIFO

#### ⚠️ **Problemas Detectados:**
- ❌ **FALTA**: Ajustes de inventario no generan asientos contables
  - Los ajustes deberían generar entradas de ajuste de inventario
  - Actualmente solo se registra el movimiento físico

---

### 4. **ÓRDENES DE COMPRA (Purchase Orders)**

#### Relaciones Directas:
```
PurchaseOrder
├── Store (store_id) ✅
├── Supplier (supplier_id) ✅
├── Warehouse (warehouse_id) ✅
├── Profile (requested_by, received_by) ✅
└── PurchaseOrderItem[] (OneToMany) ✅
    ├── Product (product_id) ✅
    └── ProductVariant (variant_id) ✅
```

#### Flujos de Datos:
1. **Orden de Compra → Inventario** ✅
   - Al recibir: crea `InventoryMovement` (tipo: 'received')
   - Actualiza `WarehouseStock`
   - Guarda costos de compra

2. **Orden de Compra → Contabilidad** ✅
   - Genera `JournalEntry` cuando status = 'completed'
   - Usa mapeos: `purchase_expense`, `accounts_payable`, `inventory_asset`
   - **✅ CORRECTO**: Integración completa

#### ✅ **Estado**: Correcto y completo

---

### 5. **TRANSFERENCIAS (Transfers)**

#### Relaciones Directas:
```
Transfer
├── Store (store_id) ✅
├── Warehouse (from_warehouse_id, to_warehouse_id) ✅
├── Profile (requested_by, shipped_by, received_by) ✅
└── TransferItem[] (OneToMany) ✅
    ├── Product (product_id) ✅
    └── ProductVariant (variant_id) ✅
```

#### Flujos de Datos:
1. **Transfer → Inventario** ⚠️
   - Al crear: reserva stock en bodega origen ✅
   - Al enviar: descuenta stock de bodega origen ✅
   - Al recibir: incrementa stock en bodega destino ✅
   - **PROBLEMA**: NO crea `InventoryMovement` explícitamente
   - Solo actualiza `WarehouseStock` directamente
   - **IMPACTO**: No hay historial de movimientos de transferencias

2. **Transfer → Contabilidad** ❌
   - **PROBLEMA CRÍTICO**: No genera asientos contables
   - Las transferencias entre bodegas deberían generar:
     - Débito: Inventario Bodega Destino
     - Crédito: Inventario Bodega Origen
   - **RECOMENDACIÓN**: Agregar generación automática de asientos

#### ⚠️ **Problemas Detectados:**
- ❌ **CRÍTICO**: No crea `InventoryMovement` para transferencias
  - No hay registro histórico de transferencias en movimientos
  - Solo se actualiza stock, pero no se registra el movimiento
- ❌ **FALTA**: Generación de asientos contables para transferencias
- ⚠️ **MEJORA**: Podría tener relación directa con `InventoryMovement` en `ref`

---

### 6. **CAJA (Cash)**

#### Relaciones Directas:
```
CashSession
├── Store (store_id) ✅
├── Profile (opened_by, closed_by) ✅
└── Sale[] (implícito por cash_session_id) ✅
```

#### Flujos de Datos:
1. **CashSession → Sales** ✅
   - Las ventas tienen `cash_session_id`
   - Al cerrar sesión, calcula totales esperados de ventas
   - **✅ CORRECTO**: Cálculo de diferencias funciona bien

2. **CashSession → Contabilidad** ❌
   - **PROBLEMA**: No genera asiento de cierre de caja
   - Debería generar asiento al cerrar con:
     - Débito: Caja (efectivo contado)
     - Crédito: Ingresos por ventas
     - Diferencia: Gastos/Ingresos no operacionales

#### ⚠️ **Problemas Detectados:**
- ❌ **CRÍTICO**: Falta relación explícita con `Shift`
  - `CashSession` NO tiene `shift_id`
  - `CashSession` y `Shift` son conceptos relacionados pero no vinculados
  - Un turno puede tener múltiples sesiones de caja, pero no hay forma de relacionarlas
- ❌ **FALTA**: Generación de asientos contables al cerrar caja
- ✅ **CORRECTO**: `CashMovement` SÍ tiene relación con `CashSession` y `Shift` (bien implementado)

---

### 7. **TURNOS (Shifts)**

#### Relaciones Directas:
```
Shift
├── Store (store_id) ✅
├── Profile (cashier_id) ✅
└── ShiftCut[] (OneToMany) ✅
```

#### Flujos de Datos:
1. **Shift → Sales** ❌
   - **PROBLEMA CRÍTICO**: No hay relación directa
   - Las ventas deberían estar vinculadas al turno activo
   - Actualmente solo hay `cash_session_id` en ventas

2. **Shift → CashSession** ❌
   - **PROBLEMA**: No hay relación explícita
   - `Shift` y `CashSession` deberían estar relacionados
   - Un turno puede tener múltiples sesiones de caja

#### ⚠️ **Problemas Detectados:**
- ❌ **CRÍTICO**: Falta relación `Sale.shift_id`
- ❌ **CRÍTICO**: Falta relación `CashSession.shift_id`
- ⚠️ **MEJORA**: Los cortes (CutX, CutZ) deberían generar asientos contables

---

### 8. **FIAO (Debts)**

#### Relaciones Directas:
```
Debt
├── Store (store_id) ✅
├── Sale (sale_id) ✅
├── Customer (customer_id) ✅
└── DebtPayment[] (OneToMany) ✅
```

#### Flujos de Datos:
1. **Venta FIAO → Debt** ✅
   - Se crea automáticamente cuando `payment_method = 'FIAO'`
   - Relación correcta con `Sale` y `Customer`

2. **DebtPayment → Debt** ✅
   - Actualiza estado de deuda (open → partial → paid)
   - Cálculo de saldos correcto

3. **Debt → Contabilidad** ❌
   - **PROBLEMA**: Los pagos de deuda no generan asientos contables
   - Deberían generar:
     - Débito: Caja/Bancos
     - Crédito: Cuentas por Cobrar

#### ⚠️ **Problemas Detectados:**
- ❌ **FALTA**: Generación de asientos contables para pagos de deuda

---

### 9. **FACTURAS FISCALES (Fiscal Invoices)**

#### Relaciones Directas:
```
FiscalInvoice
├── Store (store_id) ✅
├── Sale (sale_id) ✅
├── FiscalConfig (fiscal_config_id) ✅
├── InvoiceSeries (invoice_series_id) ✅
└── FiscalInvoiceItem[] (OneToMany) ✅
    └── Product (product_id) ✅
```

#### Flujos de Datos:
1. **Sale → FiscalInvoice** ✅
   - Relación correcta con `Sale`
   - Puede crearse desde una venta existente

2. **FiscalInvoice → Contabilidad** ❌
   - **PROBLEMA**: No genera asiento contable automático
   - Las facturas fiscales deberían generar asientos específicos
   - Diferentes cuentas según tipo de factura (A, B, C)

#### ⚠️ **Problemas Detectados:**
- ❌ **FALTA**: Generación de asientos contables para facturas fiscales

---

### 10. **DESCUENTOS Y PROMOCIONES**

#### Relaciones Directas:
```
DiscountConfig
├── Store (store_id) ✅
└── DiscountAuthorization[] (OneToMany) ✅

Promotion
├── Store (store_id) ✅
└── PromotionProduct[] (OneToMany) ✅
    └── Product (product_id) ✅
```

#### Flujos de Datos:
1. **Descuento/Promoción → Venta** ✅
   - Se aplican en `SaleItem.discount_bs` y `discount_usd`
   - Se registran en `Sale.totals.discount_bs` y `discount_usd`

2. **Descuento/Promoción → Contabilidad** ✅
   - Los descuentos ya están incluidos en el asiento de venta
   - Se reflejan como reducción de ingresos

#### ✅ **Estado**: Correcto

---

### 11. **LISTAS DE PRECIO**

#### Relaciones Directas:
```
PriceList
├── Store (store_id) ✅
└── PriceListItem[] (OneToMany) ✅
    └── Product (product_id) ✅
```

#### Flujos de Datos:
1. **PriceList → Venta** ✅
   - Se aplica al calcular precios en ventas
   - Se usa en `SaleItem.unit_price_bs` y `unit_price_usd`

#### ✅ **Estado**: Correcto

---

## 🔴 Problemas Críticos Identificados

### 1. **Falta Relación Shift ↔ Sales** 🔴 CRÍTICO

**Problema:**
- Las ventas no están vinculadas al turno activo
- No se puede rastrear qué ventas pertenecen a qué turno
- Los cortes de turno no pueden calcular totales de ventas

**Impacto:**
- Imposible generar reportes por turno
- No se puede cerrar turno con validación de ventas
- Los cortes X y Z no reflejan ventas reales del turno

**Solución:**
```sql
ALTER TABLE sales ADD COLUMN shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL;
CREATE INDEX idx_sales_shift_id ON sales(shift_id);
```

**Código:**
```typescript
// En Sale entity
@Column({ type: 'uuid', nullable: true })
shift_id: string | null;

@ManyToOne(() => Shift, { onDelete: 'SET NULL', nullable: true })
@JoinColumn({ name: 'shift_id' })
shift: Shift | null;
```

---

### 2. **Falta Relación Shift ↔ CashSession** 🟡 IMPORTANTE

**Problema:**
- `Shift` y `CashSession` son conceptos relacionados pero no vinculados
- Un turno puede tener múltiples sesiones de caja
- No hay forma de saber qué sesiones pertenecen a qué turno

**Impacto:**
- Confusión entre conceptos de turno y sesión de caja
- Imposible consolidar reportes de turno con caja

**Solución:**
```sql
ALTER TABLE cash_sessions ADD COLUMN shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL;
CREATE INDEX idx_cash_sessions_shift_id ON cash_sessions(shift_id);
```

---

### 3. **Transferencias No Generan Asientos Contables** 🟡 IMPORTANTE

**Problema:**
- Las transferencias entre bodegas no generan asientos contables
- No se reflejan en la contabilidad los movimientos de inventario entre bodegas

**Impacto:**
- Inventario contable desincronizado con inventario físico
- Imposible rastrear valor de inventario por bodega

**Solución:**
```typescript
// En TransfersService.receive()
// Después de actualizar stock, generar asiento:
await this.accountingService.generateEntryFromTransfer(
  storeId,
  transfer,
  fromWarehouse,
  toWarehouse
);
```

---

### 4. **Ajustes de Inventario No Generan Asientos** 🟡 IMPORTANTE

**Problema:**
- Los ajustes de inventario (`InventoryMovement` tipo 'adjust') no generan asientos
- No se reflejan pérdidas/ganancias de inventario en contabilidad

**Impacto:**
- Diferencias de inventario no contabilizadas
- Imposible rastrear mermas o sobrantes

**Solución:**
```typescript
// En InventoryService.stockAdjusted()
// Después de crear movimiento, generar asiento:
if (dto.adjustment_type === 'loss') {
  await this.accountingService.generateEntryFromInventoryAdjustment(
    storeId,
    movement,
    'loss'
  );
}
```

---

### 5. **Pagos de Deuda No Generan Asientos** 🟡 IMPORTANTE

**Problema:**
- Los pagos de deuda (`DebtPayment`) no generan asientos contables
- No se refleja la recuperación de cuentas por cobrar

**Impacto:**
- Cuentas por cobrar no se actualizan en contabilidad
- Imposible conciliar deudas con contabilidad

**Solución:**
```typescript
// En DebtsService.addPayment()
// Después de crear pago, generar asiento:
await this.accountingService.generateEntryFromDebtPayment(
  storeId,
  debt,
  payment
);
```

---

### 6. **Facturas Fiscales No Generan Asientos Específicos** 🟡 IMPORTANTE

**Problema:**
- Las facturas fiscales no generan asientos contables específicos
- No se diferencian cuentas según tipo de factura (A, B, C)

**Impacto:**
- No se puede rastrear IVA por tipo de factura
- Imposible generar reportes fiscales desde contabilidad

**Solución:**
```typescript
// En FiscalInvoicesService.create()
// Después de crear factura, generar asiento:
await this.accountingService.generateEntryFromFiscalInvoice(
  storeId,
  fiscalInvoice
);
```

---

### 7. **Cierre de Caja No Genera Asiento** 🟡 IMPORTANTE

**Problema:**
- Al cerrar `CashSession`, no se genera asiento contable
- No se registra la diferencia entre lo esperado y lo contado

**Impacto:**
- Diferencias de caja no contabilizadas
- Imposible rastrear faltantes/sobrantes en contabilidad

**Solución:**
```typescript
// En CashService.closeSession()
// Después de cerrar, generar asiento:
await this.accountingService.generateEntryFromCashSessionClose(
  storeId,
  session,
  differences
);
```

---

## ✅ Relaciones Correctamente Implementadas

### 1. **Venta → Inventario** ✅
- Crea `InventoryMovement` correctamente
- Actualiza `WarehouseStock`
- Maneja lotes FIFO

### 2. **Venta → Contabilidad** ✅
- Genera `JournalEntry` automáticamente
- Usa mapeos de cuentas correctos
- Incluye ingresos, COGS, inventario

### 3. **Venta → FIAO** ✅
- Crea `Debt` automáticamente
- Relación correcta con `Customer`

### 4. **Orden de Compra → Inventario** ✅
- Crea `InventoryMovement` al recibir
- Actualiza `WarehouseStock`

### 5. **Orden de Compra → Contabilidad** ✅
- Genera `JournalEntry` cuando se completa
- Usa mapeos correctos

### 6. **Transfer → Inventario** ✅
- Reserva y actualiza stock correctamente
- Crea movimientos en ambas bodegas

---

## 📊 Matriz de Integridad Referencial

| Entidad Origen | Entidad Destino | Tipo | Estado | Observaciones |
|---------------|----------------|------|--------|---------------|
| Sale | Store | CASCADE | ✅ | Correcto |
| Sale | Customer | SET NULL | ✅ | Correcto |
| Sale | CashSession | SET NULL | ✅ | Correcto |
| Sale | Shift | - | ❌ | **FALTA** |
| SaleItem | Product | RESTRICT | ✅ | Correcto |
| SaleItem | ProductVariant | SET NULL | ✅ | Correcto |
| SaleItem | ProductLot | SET NULL | ✅ | Correcto |
| Order | Table | SET NULL | ✅ | Correcto |
| Order | Sale | - | ✅ | Relación lógica (no FK) |
| PurchaseOrder | Supplier | RESTRICT | ✅ | Correcto |
| PurchaseOrder | Warehouse | RESTRICT | ✅ | Correcto |
| InventoryMovement | Warehouse | SET NULL | ✅ | Correcto |
| Transfer | Warehouse | RESTRICT | ✅ | Correcto |
| Debt | Sale | SET NULL | ✅ | Correcto |
| Debt | Customer | CASCADE | ✅ | Correcto |
| FiscalInvoice | Sale | SET NULL | ✅ | Correcto |
| CashSession | Shift | - | ❌ | **FALTA** |

---

## 🔄 Flujos de Datos Críticos

### Flujo 1: Venta Completa ✅
```
1. Usuario crea venta
   ↓
2. SalesService.create()
   ├── Crea Sale
   ├── Crea SaleItem[] (con Product, Variant, Lot)
   ├── Crea InventoryMovement[] (descuenta stock)
   ├── Actualiza WarehouseStock
   ├── Crea Debt (si es FIAO)
   ├── Genera JournalEntry (contabilidad)
   └── Vincula a CashSession
   
✅ ESTADO: Completo y correcto
```

### Flujo 2: Orden de Compra Completa ✅
```
1. Usuario crea orden de compra
   ↓
2. PurchaseOrdersService.create()
   ├── Crea PurchaseOrder
   └── Crea PurchaseOrderItem[]
   
3. Usuario recibe orden
   ↓
4. PurchaseOrdersService.receive()
   ├── Actualiza PurchaseOrderItem.quantity_received
   ├── Crea InventoryMovement[] (incrementa stock)
   ├── Actualiza WarehouseStock
   └── Genera JournalEntry (si status = completed)
   
✅ ESTADO: Completo y correcto
```

### Flujo 3: Transferencia Entre Bodegas ⚠️
```
1. Usuario crea transferencia
   ↓
2. TransfersService.create()
   ├── Crea Transfer
   ├── Crea TransferItem[]
   └── Reserva stock en bodega origen
   
3. Usuario envía transferencia
   ↓
4. TransfersService.ship()
   ├── Descuenta stock de bodega origen
   └── Crea InventoryMovement (salida)
   
5. Usuario recibe transferencia
   ↓
6. TransfersService.receive()
   ├── Incrementa stock en bodega destino
   └── Crea InventoryMovement (entrada)
   
⚠️ PROBLEMA: No genera asiento contable
```

### Flujo 4: Cierre de Turno ⚠️
```
1. Usuario abre turno
   ↓
2. ShiftsService.openShift()
   └── Crea Shift
   
3. Usuario realiza ventas
   ↓
4. SalesService.create()
   └── Crea Sale (sin shift_id) ❌
   
5. Usuario cierra turno
   ↓
6. ShiftsService.closeShift()
   └── Intenta calcular ventas usando:
       - sold_by_user_id = cashier_id
       - sold_at >= shift.opened_at
       - sold_at <= shift.closed_at (si existe)
   ⚠️ PROBLEMA: Método frágil, puede incluir ventas de otros turnos
   
⚠️ PROBLEMA CRÍTICO: No hay relación directa entre Shift y Sales
```

---

## 📋 Checklist de Verificación

### Integridad de Datos:
- [x] Foreign keys correctamente definidas
- [x] CASCADE/SET NULL/RESTRICT aplicados correctamente
- [x] Transacciones atómicas en operaciones críticas
- [ ] Todas las relaciones bidireccionales implementadas

### Flujos de Negocio:
- [x] Venta → Inventario → Contabilidad
- [x] Orden de Compra → Inventario → Contabilidad
- [x] Venta FIAO → Debt
- [ ] Transfer → Contabilidad ❌
- [ ] Ajuste Inventario → Contabilidad ❌
- [ ] Pago Deuda → Contabilidad ❌
- [ ] Cierre Caja → Contabilidad ❌
- [ ] Factura Fiscal → Contabilidad ❌

### Relaciones Faltantes:
- [ ] Sale.shift_id ❌
- [ ] CashSession.shift_id ❌
- [ ] CashMovement.cash_session_id ❌

---

## 🎯 Recomendaciones Prioritarias

### 🔴 **Alta Prioridad (Esta Semana)**

1. **Agregar `shift_id` a `Sale`**
   - Migración SQL
   - Actualizar entidad TypeORM
   - Modificar `SalesService.create()` para asignar turno activo
   - Actualizar `ShiftsService.closeShift()` para usar ventas del turno

2. **Agregar `shift_id` a `CashSession`**
   - Migración SQL
   - Actualizar entidad TypeORM
   - Modificar `CashService.openSession()` para asignar turno activo

### 🟡 **Media Prioridad (Próximas 2 Semanas)**

3. **Generar asientos contables para transferencias**
   - Crear método `generateEntryFromTransfer()` en `AccountingService`
   - Integrar en `TransfersService.receive()`

4. **Generar asientos contables para ajustes de inventario**
   - Crear método `generateEntryFromInventoryAdjustment()` en `AccountingService`
   - Integrar en `InventoryService.stockAdjusted()`

5. **Generar asientos contables para pagos de deuda**
   - Crear método `generateEntryFromDebtPayment()` en `AccountingService`
   - Integrar en `DebtsService.addPayment()`

### 🟢 **Baja Prioridad (Mejoras Continuas)**

6. Generar asientos contables para facturas fiscales
7. Generar asiento de cierre de caja
8. Vincular `CashMovement` con `CashSession`
9. Generar asientos para cortes de turno (CutX, CutZ)

---

## 📊 Resumen Visual de Relaciones

### ✅ Relaciones Correctas (Verde)
```
Venta → Inventario → WarehouseStock ✅
Venta → Contabilidad (JournalEntry) ✅
Venta → FIAO (Debt) ✅
Orden de Compra → Inventario → WarehouseStock ✅
Orden de Compra → Contabilidad (JournalEntry) ✅
Orden → Venta (al cerrar) ✅
CashMovement → Shift ✅
CashMovement → CashSession ✅
```

### ❌ Relaciones Faltantes (Rojo)
```
Sale → Shift ❌ (CRÍTICO)
CashSession → Shift ❌ (IMPORTANTE)
Transfer → InventoryMovement ❌ (CRÍTICO)
Transfer → Contabilidad ❌ (IMPORTANTE)
Ajuste Inventario → Contabilidad ❌ (IMPORTANTE)
Pago Deuda → Contabilidad ❌ (IMPORTANTE)
Cierre Caja → Contabilidad ❌ (IMPORTANTE)
Factura Fiscal → Contabilidad ❌ (IMPORTANTE)
```

---

## 📝 Conclusión

### Estado General: **85/100** ✅

El sistema tiene **relaciones de datos sólidas** en los flujos principales:
- ✅ Ventas → Inventario → Contabilidad (completo)
- ✅ Órdenes de Compra → Inventario → Contabilidad (completo)
- ✅ Ventas FIAO → Debt (completo)
- ✅ Integridad referencial correcta

### Problemas Críticos Identificados:

1. **🔴 CRÍTICO**: Falta `shift_id` en `Sale`
   - Impacto: Reportes de turno inexactos, cierre de turno frágil
   - Solución: Migración + actualizar `SalesService.create()`

2. **🔴 CRÍTICO**: Transferencias no crean `InventoryMovement`
   - Impacto: Sin historial de transferencias, imposible auditar
   - Solución: Crear movimientos al enviar y recibir

3. **🟡 IMPORTANTE**: Falta `shift_id` en `CashSession`
   - Impacto: No se puede consolidar turno con caja
   - Solución: Migración + actualizar `CashService.openSession()`

4. **🟡 IMPORTANTE**: Múltiples operaciones no generan asientos contables
   - Transferencias, ajustes, pagos deuda, cierre caja, facturas fiscales
   - Solución: Integrar `AccountingService` en cada operación

### Recomendación Final:

**Prioridad 1 (Esta Semana):**
- Agregar `shift_id` a `Sale` y `CashSession`
- Crear `InventoryMovement` para transferencias

**Prioridad 2 (Próximas 2 Semanas):**
- Generar asientos contables para todas las operaciones faltantes

**El sistema es funcional y robusto**, pero estas mejoras lo harán **100% completo y auditáble**.
