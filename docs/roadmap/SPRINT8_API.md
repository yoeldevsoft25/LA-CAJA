# Sprint 8 - Proyecciones Server (Read Models)

## Funcionalidad Implementada

El sistema de proyecciones transforma eventos del event store en read models optimizados para consultas rápidas.

## Proyecciones Implementadas

### 1. Productos

#### ProductCreated → `products`
- Crea un nuevo producto en la tabla `products`
- Idempotente: si el producto ya existe, no se duplica

#### ProductUpdated → `products`
- Actualiza campos del producto según el `patch` del payload
- Solo actualiza si el producto existe

#### ProductDeactivated → `products`
- Actualiza `is_active = false`

#### PriceChanged → `products`
- Actualiza `price_bs` y `price_usd`

### 2. Inventario

#### StockReceived → `inventory_movements`
- Crea movimiento tipo `received` con `qty_delta` positivo
- Idempotente por `movement_id`

#### StockAdjusted → `inventory_movements`
- Crea movimiento tipo `adjust` con `qty_delta` (puede ser positivo o negativo)
- Idempotente por `movement_id`

#### SaleCreated → `inventory_movements`
- Crea movimientos tipo `sold` con `qty_delta` negativo por cada item de la venta
- Descuenta stock automáticamente

### 3. Ventas

#### SaleCreated → `sales` + `sale_items`
- Crea la venta en `sales`
- Crea los items en `sale_items`
- Crea movimientos de inventario para descontar stock
- Idempotente por `sale_id`

### 4. Caja

#### CashSessionOpened → `cash_sessions`
- Crea sesión de caja con estado abierto (`closed_at = null`)
- Idempotente por `session_id`

#### CashSessionClosed → `cash_sessions`
- Actualiza sesión de caja con datos de cierre
- Solo actualiza si la sesión existe

### 5. Clientes

#### CustomerCreated → `customers`
- Crea nuevo cliente
- Idempotente por `customer_id`

#### CustomerUpdated → `customers`
- Actualiza campos del cliente según `patch`
- Solo actualiza si el cliente existe

### 6. Deudas

#### DebtCreated → `debts`
- Crea nueva deuda con status `OPEN`
- Idempotente por `debt_id`

#### DebtPaymentRecorded → `debt_payments` + `debts` (status)
- Crea el pago en `debt_payments`
- Actualiza el status de la deuda:
  - `PAID` si está completamente pagada
  - `PARTIAL` si hay pagos parciales
  - `OPEN` si no hay pagos
- Idempotente por `payment_id`

## Características

### Idempotencia

Todas las proyecciones son idempotentes:
- Si el registro ya existe (por ID), no se duplica
- Esto permite reprocesar eventos sin efectos secundarios
- Compatible con el sistema de deduplicación del sync

### Transaccionalidad

- Las proyecciones se ejecutan después de guardar eventos
- Si una proyección falla, no afecta el guardado del evento
- Los errores se registran pero no bloquean el sync

### Automático

- Las proyecciones se ejecutan automáticamente al sincronizar eventos
- No requiere acción manual
- Se proyectan solo eventos nuevos (no duplicados)

## Flujo

1. Cliente crea evento localmente
2. Cliente sincroniza evento vía `POST /sync/push`
3. Servidor:
   - Valida evento
   - Verifica dedupe
   - Guarda en `events`
   - **Proyecta a read models** ← Sprint 8
4. Read models disponibles para consultas rápidas

## Ejemplo

Cuando se sincroniza un evento `SaleCreated`:

1. Evento guardado en `events`
2. Se proyecta automáticamente:
   - Venta creada en `sales`
   - Items creados en `sale_items`
   - Movimientos de inventario creados en `inventory_movements` (descuento de stock)

Todo esto ocurre automáticamente sin intervención manual.

## Notas Importantes

- Las proyecciones son **idempotentes**: puede re-proyectar el mismo evento sin efectos secundarios
- Los errores en proyecciones no afectan el guardado de eventos
- Los read models se actualizan en tiempo real al sincronizar
- No es necesario proyectar eventos manualmente

