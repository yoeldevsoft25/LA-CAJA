# Hotfix: Serie de Factura Faltante en Ventas Offline

## Fecha: 2026-02-03

## Problema

Las ventas realizadas por "Administradora" (offline-first/sync) NO tenían asignado el número de serie de factura (`invoice_full_number` como `FAC-A-000xxx`), mientras que las ventas de "Cajera" (API directa) sí lo tenían.

### Síntomas
- Listado de ventas mostraba "-" en la columna "Factura" para ventas sincronizadas
- Ventas online directas SÍ mostraban serie (ej: FAC-A-000852)
- Las facturas FISCALES (20260203-110692) sí se generaban correctamente

### Causa Raíz

**Dos flujos de creación de ventas:**

| Flujo | Archivo | ¿Genera invoice_full_number? |
|-------|---------|------------------------------|
| API Directa (Online) | `create-sale.handler.ts` | ✅ Sí |
| Sync/Push (Offline) | `projections.service.ts` | ❌ No |

El flujo de proyección (`projectSaleCreated`) NO llamaba a `InvoiceSeriesService.generateNextInvoiceNumber()`, por lo que las ventas sincronizadas quedaban sin número de factura.

## Solución

### Archivos Modificados

#### 1. `apps/api/src/projections/projections.service.ts`

**Cambios:**
- Agregado import de `InvoiceSeriesService`
- Inyectado `InvoiceSeriesService` en el constructor
- En `projectSaleCreated`: Agregada generación de `invoice_full_number` antes de crear la venta

```typescript
// ✅ FIX OFFLINE-FIRST: Generar número de factura usando InvoiceSeriesService
let invoiceSeriesId: string | null = null;
let invoiceNumber: string | null = null;
let invoiceFullNumber: string | null = null;

try {
  const invoiceData = await this.invoiceSeriesService.generateNextInvoiceNumber(
    event.store_id,
    undefined, // Usar serie por defecto
  );
  invoiceSeriesId = invoiceData.series.id;
  invoiceNumber = invoiceData.invoice_number;
  invoiceFullNumber = invoiceData.invoice_full_number;
} catch (error) {
  this.logger.warn(`No se pudo generar número de factura: ${error.message}`);
}

// Crear venta con invoice_full_number
const sale = manager.getRepository(Sale).create({
  // ... otros campos
  invoice_series_id: invoiceSeriesId,
  invoice_number: invoiceNumber,
  invoice_full_number: invoiceFullNumber,
});
```

#### 2. `apps/api/src/projections/projections.module.ts`

**Cambios:**
- Agregado import de `InvoiceSeriesModule`
- Agregado `InvoiceSeriesModule` a los imports del módulo

#### 3. `apps/api/src/projections/projections.final-hardening.spec.ts`

**Cambios:**
- Agregado import de `InvoiceSeriesService`
- Agregado mock de `InvoiceSeriesService` en los providers del test

## Verificación

### Build
```bash
npm run build --workspace=apps/api  # ✅ PASS
npm run build --workspace=apps/pwa  # ✅ PASS
```

### Tests
```bash
npm run test -- --testPathPattern="projections" --forceExit  # ✅ 7/7 PASS
```

## Comportamiento Esperado Después del Fix

| Escenario | Resultado Esperado |
|-----------|-------------------|
| Venta online (API directa) | ✅ `FAC-A-000xxx` asignado |
| Venta offline → sync → proyección | ✅ `FAC-A-000xxx` asignado |
| Sin serie configurada | ⚠️ Log de advertencia, venta se crea sin serie (graceful degradation) |

## Idempotencia

- Si la venta ya existe con items (completa), la proyección retorna sin hacer nada
- Si la venta existe sin items (parcial), se repara pero NO se re-genera el invoice_full_number
- La generación de `invoice_full_number` es atómica usando `UPDATE ... RETURNING`

## Riesgos Residuales

1. **Ventas existentes sin serie**: Las ventas creadas antes del fix permanecerán sin `invoice_full_number`. Se puede ejecutar un script de migración si es necesario.

2. **Concurrencia**: La generación de número de factura usa UPDATE atómico, evitando duplicados.

## Comandos para Validar en Local/Staging

```bash
# 1. Compilar
npm run build

# 2. Ejecutar tests
npm run test -- --testPathPattern="projections"

# 3. Iniciar API y PWA
npm run dev

# 4. Test manual:
#    - Crear venta con admin (offline-first)
#    - Verificar que aparece con FAC-A-xxx en listado de ventas
#    - Verificar en DB: SELECT id, invoice_full_number FROM sales ORDER BY created_at DESC LIMIT 5;
```

## Próximos Pasos

1. ✅ Deploy a staging
2. ⏳ Verificar en staging que ventas nuevas tienen serie
3. ⏳ Evaluar script de migración para ventas antiguas sin serie
4. ⏳ Monitorear logs para errores de generación de serie
