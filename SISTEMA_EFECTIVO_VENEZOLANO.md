# Sistema de Efectivo Venezolano - Implementación Completa

## 📋 Resumen

Este documento describe la implementación completa del sistema inteligente de manejo de efectivo para Venezuela, que incluye pagos en USD físico con cambio en Bs, redondeo inteligente según el cono monetario venezolano, y sincronización precisa con la caja.

## 🎯 Características Principales

### 1. Cono Monetario Venezolano 2025

**Denominaciones implementadas:**
- **Billetes:** 200, 100, 50, 20, 10, 5, 2, 1 Bs (comunes)
- **Monedas:** 0.50, 0.25, 0.10, 0.05 Bs (menos comunes)

**Ubicación:** `apps/pwa/src/utils/vzla-denominations.ts`

### 2. Pago en USD Físico con Cambio en Bs

**Funcionalidad:**
- Captura del monto recibido en USD físico
- Cálculo automático del cambio en USD
- Opción para dar cambio en Bolívares (checkbox)
- Cálculo del cambio en Bs usando la tasa BCV automáticamente
- Desglose inteligente por denominaciones venezolanas

**Flujo:**
1. Cliente paga con USD físico (ej: $10 USD)
2. Si el total es menor, se calcula el cambio en USD (ej: $2 USD)
3. Usuario puede elegir dar cambio en Bs
4. Sistema calcula: Cambio en Bs = Cambio USD × Tasa BCV
5. Se redondea según denominaciones disponibles
6. Se muestra desglose exacto de billetes a entregar

### 3. Pago en Bs Físico con Cambio en Bs

**Funcionalidad:**
- Captura del monto recibido en Bs físico
- Cálculo automático del cambio en Bs
- Redondeo inteligente según denominaciones
- Desglose por denominaciones

**Flujo:**
1. Cliente paga con Bs físico (ej: 600 Bs)
2. Sistema calcula: Cambio = Recibido - Total
3. Se redondea según denominaciones (múltiplos de 5 o 10 hacia abajo)
4. Se muestra desglose exacto de billetes a entregar

### 4. Redondeo Inteligente (Siempre Favorece al POS)

**Algoritmo:**
```typescript
// Redondea hacia abajo al múltiplo de 5 o 10 más cercano
- Si es múltiplo de 10: se mantiene
- Si no: redondea hacia abajo al múltiplo de 5 más cercano
```

**Ejemplos:**
- 108 Bs → 105 Bs (múltiplo de 5 hacia abajo)
- 107 Bs → 105 Bs (múltiplo de 5 hacia abajo)
- 103 Bs → 100 Bs (múltiplo de 10 hacia abajo)
- 104 Bs → 100 Bs (múltiplo de 5 hacia abajo)
- 4.26 Bs → 0 Bs (menor a 5, no se da cambio)

**Ubicación:** `apps/pwa/src/utils/vzla-denominations.ts` - función `roundToNearestDenomination()`

### 5. Mensaje de Cortesía (Excedentes Mínimos)

**Funcionalidad:**
- Detecta excedentes entre 1 y 5 Bs a favor del POS
- Muestra mensaje sugiriendo dar un dulce como gesto de cortesía
- Aplica tanto para pagos USD→Bs como Bs→Bs

**Ejemplo:**
- Total: 595.74 Bs
- Recibido: 600 Bs
- Cambio exacto: 4.26 Bs
- Cambio redondeado: 0 Bs
- Excedente: 4.26 Bs → Muestra mensaje: "💡 Excedente mínimo de 4.26 Bs a nuestro favor. Considera dar un dulce como gesto de cortesía."

## 🔐 Sincronización POS-Caja

### Fórmula de Efectivo en Caja

```
Efectivo en Caja = +Monto Recibido - Cambio Dado (solo si > 0)
```

### Reglas de Sincronización

1. **Frontend (POS):**
   - Solo envía `change_bs` si `roundedChangeBs > 0`
   - Si el cambio es 0 (redondeado), NO se envía `change_bs`
   - Todos los valores se redondean a 2 decimales antes de enviar

2. **Backend (Caja):**
   - Siempre suma el monto recibido (`received_bs` o `received_usd`)
   - Solo descuenta cambio si `change_bs > 0` y existe
   - Si `change_bs` es 0 o no existe: NO se descuenta (excedente a favor del POS)
   - Lógica idéntica en `closeSession` y `getSessionSummary`

### Ejemplos de Cálculo

**Caso 1: Cambio redondeado a 0**
- Total: 595.74 Bs
- Recibido: 600 Bs
- Cambio exacto: 4.26 Bs
- Cambio redondeado: 0 Bs
- En caja: **+600 Bs** (recibido) - **0 Bs** (no se descuenta) = **+600 Bs neto**
- Excedente: 4.26 Bs a favor del POS

**Caso 2: Cambio redondeado a 5**
- Total: 595 Bs
- Recibido: 600 Bs
- Cambio exacto: 5 Bs
- Cambio redondeado: 5 Bs
- En caja: **+600 Bs** (recibido) - **5 Bs** (cambio dado) = **+595 Bs neto**

**Caso 3: USD físico con cambio en Bs**
- Total: $8 USD
- Recibido: $10 USD
- Cambio: $2 USD
- Tasa BCV: 36 Bs/USD
- Cambio en Bs: 72 Bs → Redondeado: 70 Bs
- En caja: **+$10 USD** (recibido) - **70 Bs** (cambio dado) = **+$10 USD, -70 Bs**

## 📁 Archivos Implementados

### Frontend

1. **`apps/pwa/src/utils/vzla-denominations.ts`**
   - Cono monetario venezolano 2025
   - Función `calculateChange()`: Desglose de vueltas por denominaciones
   - Función `roundToNearestDenomination()`: Redondeo favoreciendo al POS
   - Función `calculateRoundedChange()`: Cálculo completo con redondeo

2. **`apps/pwa/src/components/pos/CheckoutModal.tsx`**
   - UI para pagos en USD físico con cambio en Bs
   - UI para pagos en Bs físico con cambio en Bs
   - Cálculo de excedentes y mensajes de cortesía
   - Validaciones y manejo de estados

3. **`apps/pwa/src/pages/POSPage.tsx`**
   - Integración con sesión de caja actual
   - Envío de `cash_session_id` automáticamente

### Backend

1. **`apps/api/src/sales/dto/create-sale.dto.ts`**
   - Campos `cash_payment` (USD con cambio en Bs)
   - Campos `cash_payment_bs` (Bs con cambio en Bs)

2. **`apps/api/src/database/entities/sale.entity.ts`**
   - Estructura JSONB para `payment` incluyendo `cash_payment` y `cash_payment_bs`

3. **`apps/api/src/sales/sales.service.ts`**
   - Guardado de información de pago con cambio

4. **`apps/api/src/cash/cash.service.ts`**
   - **`closeSession()`:** Cálculo de efectivo esperado con lógica robusta
   - **`getSessionSummary()`:** Resumen de efectivo con cálculos idénticos
   - Documentación completa de la lógica de sincronización

## 🔄 Flujo Completo

### Pago en USD Físico con Cambio en Bs

1. Usuario selecciona productos en POS
2. Selecciona método de pago: "Efectivo USD"
3. Ingresa monto recibido en USD (ej: $10)
4. Sistema calcula cambio en USD (ej: $2)
5. Usuario marca checkbox "Dar cambio en Bolívares"
6. Sistema calcula cambio en Bs usando tasa BCV (ej: $2 × 36 = 72 Bs)
7. Sistema redondea: 72 Bs → 70 Bs (múltiplo de 10)
8. Sistema calcula excedente: 2 Bs
9. Si excedente ≤ 5 Bs: muestra mensaje de cortesía
10. Sistema muestra desglose: "1x Bs. 50, 1x Bs. 20"
11. Usuario confirma venta
12. Backend registra:
    - Entrada: +$10 USD
    - Salida: -70 Bs (cambio dado)
    - Excedente: 2 Bs a favor del POS

### Pago en Bs Físico con Cambio en Bs

1. Usuario selecciona productos en POS
2. Selecciona método de pago: "Efectivo Bs"
3. Ingresa monto recibido en Bs (ej: 600 Bs)
4. Sistema calcula cambio en Bs (ej: 108 Bs)
5. Sistema redondea: 108 Bs → 105 Bs (múltiplo de 5 hacia abajo)
6. Sistema calcula excedente: 3 Bs
7. Si excedente ≤ 5 Bs: muestra mensaje de cortesía
8. Sistema muestra desglose: "1x Bs. 100, 1x Bs. 5"
9. Usuario confirma venta
10. Backend registra:
    - Entrada: +600 Bs
    - Salida: -105 Bs (cambio dado)
    - Excedente: 3 Bs a favor del POS

## 🛡️ Validaciones y Seguridad

### Frontend

- Validación de montos recibidos (deben ser ≥ total)
- Validación de excedentes (solo muestra mensaje si ≤ 5 Bs)
- Redondeo a 2 decimales en todos los cálculos
- Manejo de estados (loading, error, success)

### Backend

- Validación de `change_bs > 0` antes de descontar
- Redondeo a 2 decimales en todos los cálculos
- Verificación doble en `closeSession` (expectedBs vs expectedBsVerify)
- Validación de montos razonables (máx 200% del esperado)
- Prevención de doble cierre de sesión

## 📊 Estructura de Datos

### DTO de Venta (CreateSaleDto)

```typescript
{
  // ... otros campos
  cash_payment?: {
    received_usd: number;      // Monto recibido en USD físico
    change_bs?: number;         // Cambio dado en Bs (solo si > 0)
  };
  cash_payment_bs?: {
    received_bs: number;        // Monto recibido en Bs físico
    change_bs?: number;         // Cambio dado en Bs (redondeado, solo si > 0)
  };
}
```

### Entidad Sale (payment JSONB)

```typescript
{
  method: 'CASH_USD' | 'CASH_BS' | ...,
  cash_payment?: {
    received_usd: number;
    change_bs?: number;
  },
  cash_payment_bs?: {
    received_bs: number;
    change_bs?: number;
  }
}
```

## ✅ Estado de Implementación

### ✅ Completado

- [x] Cono monetario venezolano 2025
- [x] Algoritmo de cálculo de vueltas por denominaciones
- [x] Redondeo inteligente (favorece al POS)
- [x] Pago en USD físico con cambio en Bs
- [x] Pago en Bs físico con cambio en Bs
- [x] Desglose de vueltas por denominaciones
- [x] Mensajes de cortesía para excedentes mínimos
- [x] Sincronización POS-Caja
- [x] Cálculo de efectivo esperado en cierre de caja
- [x] Validaciones robustas en backend
- [x] Integración con tasa BCV automática
- [x] Redondeo a 2 decimales en todos los cálculos

### 📝 Notas Técnicas

1. **Tasa BCV:** El sistema obtiene automáticamente la tasa del BCV usando DolarAPI (`https://ve.dolarapi.com/v1/dolares/oficial`)

2. **Excedentes:** Los excedentes menores a 5 Bs se consideran "mínimos" y sugieren dar un dulce. Los excedentes mayores a 5 Bs se muestran pero no tienen mensaje especial.

3. **Consistencia:** La lógica de cálculo de efectivo es idéntica en `closeSession()` y `getSessionSummary()` para garantizar consistencia.

4. **Redondeo:** Todos los valores monetarios se redondean a 2 decimales usando `Math.round(value * 100) / 100`.

## 🚀 Próximos Pasos Sugeridos

1. **Pruebas de Integración:**
   - Verificar cálculos en escenarios reales
   - Validar sincronización POS-Caja en diferentes casos
   - Probar con múltiples sesiones de caja

2. **Mejoras Opcionales:**
   - Historial de excedentes mínimos
   - Configuración de umbral para mensajes de cortesía
   - Reportes de excedentes por sesión

3. **Documentación de Usuario:**
   - Manual de uso del sistema de cambio
   - Guía de manejo de efectivo para cajeros
   - Procedimientos de cierre de caja

---

**Última actualización:** Enero 2025
**Estado:** ✅ Implementación Completa y Operativa

