# Plan de Refactorización de Archivos Grandes - LA-CAJA

**Fecha:** 2026-01-22  
**Prioridad:** 🔴 CRÍTICA

---

## Resumen Ejecutivo

Plan detallado para refactorizar archivos que exceden el límite recomendado de 800 líneas (objetivo: 200-400 líneas típico).

**Archivos a Refactorizar:** 24 archivos >800 líneas  
**Archivos Críticos:** 8 archivos >1500 líneas

---

## Archivos Críticos (>1500 líneas)

### Backend

#### 1. `accounting.service.ts` (3,816 líneas) 🔴

**División Propuesta:**

1. **`accounting-entries.service.ts`** (~1,200 líneas)
   - `createJournalEntry()`
   - `getJournalEntries()`
   - `getJournalEntry()`
   - `postEntry()`
   - `cancelEntry()`
   - `generateEntryNumber()`
   - Lógica de validación de asientos

2. **`accounting-balances.service.ts`** (~800 líneas)
   - `getAccountBalance()`
   - `updateAccountBalances()`
   - `recalculateBalances()`
   - Lógica de balances

3. **`accounting-reports.service.ts`** (~1,000 líneas)
   - `getBalanceSheet()`
   - `getIncomeStatement()`
   - `getTrialBalance()`
   - `getGeneralLedger()`
   - `getCashFlow()`
   - Lógica de reportes

4. **`accounting-validation.service.ts`** (~800 líneas)
   - `validateAccounting()`
   - `reconcileAccounts()`
   - `detectErrors()`
   - Algoritmos avanzados (benford, transposición, etc.)

5. **`accounting-periods.service.ts`** (~200 líneas)
   - `closePeriod()`
   - `reopenPeriod()`
   - `getPeriods()`
   - Lógica de períodos

**Dependencias Compartidas:**
- Repositorios TypeORM (inyectar en cada servicio)
- Logger (compartido)

#### 2. `sales.service.ts` (2,419 líneas) 🔴

**División Propuesta:**

1. **`sales-creation.service.ts`** (~1,000 líneas)
   - `createSale()`
   - `createSaleFromCart()`
   - Validaciones de creación
   - Generación de eventos

2. **`sales-projection.service.ts`** (~800 líneas)
   - Proyección de ventas
   - Actualización de read models
   - Cálculos de totales

3. **`sales-returns.service.ts`** (~400 líneas)
   - `returnSale()`
   - `returnSaleItems()`
   - Lógica de devoluciones

4. **`sales-queries.service.ts`** (~200 líneas)
   - `getSales()`
   - `getSale()`
   - Queries optimizadas

#### 3. `ml.service.ts` (1,837 líneas) 🔴

**División Propuesta:**

1. **`ml-demand-forecasting.service.ts`** (~800 líneas)
   - Predicción de demanda
   - Modelos de forecasting
   - Evaluación de demanda

2. **`ml-recommendations.service.ts`** (~600 líneas)
   - Recomendaciones colaborativas
   - Análisis de productos relacionados

3. **`ml-anomaly-detection.service.ts`** (~400 líneas)
   - Detección de anomalías
   - Análisis de Benford
   - Alertas ML

#### 4. `auth.service.ts` (1,673 líneas) 🔴

**División Propuesta:**

1. **`auth-login.service.ts`** (~600 líneas)
   - `login()`
   - `register()`
   - Validación de credenciales
   - Generación de tokens

2. **`auth-pin.service.ts`** (~500 líneas)
   - `forgotPin()`
   - `resetPin()`
   - Validación de PIN
   - Recuperación de PIN

3. **`auth-2fa.service.ts`** (~400 líneas)
   - `enable2FA()`
   - `verify2FA()`
   - Generación de códigos
   - Validación 2FA

4. **`auth-tokens.service.ts`** (~200 líneas)
   - `refreshToken()`
   - Validación de tokens
   - Limpieza de tokens

#### 5. `reports.service.ts` (1,498 líneas) 🔴

**División Propuesta:**

1. **`reports-sales.service.ts`** (~600 líneas)
   - Reportes de ventas
   - Análisis de ventas
   - Gráficos de ventas

2. **`reports-inventory.service.ts`** (~400 líneas)
   - Reportes de inventario
   - Análisis de stock
   - Movimientos de inventario

3. **`reports-financial.service.ts`** (~400 líneas)
   - Reportes financieros
   - Análisis de ingresos/gastos
   - Reportes de caja

4. **`reports-pdf.service.ts`** (~100 líneas)
   - Generación de PDFs
   - Templates de reportes

### Frontend

#### 6. `LandingPageEnhanced.tsx` (2,356 líneas) 🔴

**División Propuesta:**

1. **`LandingPage.tsx`** (~400 líneas) - Orquestación
2. **`HeroSection.tsx`** (~300 líneas)
3. **`FeaturesSection.tsx`** (~400 líneas)
4. **`SENIATShowcase.tsx`** (~300 líneas)
5. **`ComparisonTable.tsx`** (~300 líneas)
6. **`PricingSection.tsx`** (~300 líneas)
7. **`StatsSection.tsx`** (~200 líneas)
8. **`SocialProofTicker.tsx`** (~150 líneas)

#### 7. `POSPage.tsx` (2,197 líneas) 🔴

**División Propuesta:**

1. **`POSPage.tsx`** (~400 líneas) - Orquestación
2. **`POSCart.tsx`** (~400 líneas)
3. **`POSProductSearch.tsx`** (~300 líneas)
4. **`POSProductGrid.tsx`** (~300 líneas)
5. **`POSPayment.tsx`** (~400 líneas)
6. **`POSSummary.tsx`** (~200 líneas)
7. **`POSKeyboard.tsx`** (~200 líneas)

#### 8. `CheckoutModal.tsx` (1,916 líneas) 🔴

**División Propuesta:**

1. **`CheckoutModal.tsx`** (~300 líneas) - Orquestación
2. **`CheckoutItems.tsx`** (~400 líneas)
3. **`CheckoutPayment.tsx`** (~500 líneas)
4. **`CheckoutSummary.tsx`** (~300 líneas)
5. **`CheckoutDiscounts.tsx`** (~200 líneas)
6. **`CheckoutCustomer.tsx`** (~200 líneas)

---

## Archivos Altos (800-1500 líneas)

### Backend (10 archivos)

1. `sync.service.ts` (900 líneas) - Considerar dividir
2. `fiscal-invoices.service.ts` (868 líneas) - Considerar dividir
3. `health.controller.ts` (866 líneas) - Considerar dividir
4. `realtime-analytics.service.ts` (848 líneas) - Considerar dividir
5. `notifications.service.ts` (800 líneas) - Límite aceptable

### Frontend (14 archivos)

1. `ProductFormModal.tsx` (1,241 líneas) - Dividir
2. `SalesPage.tsx` (1,126 líneas) - Considerar dividir
3. `SaleDetailModal.tsx` (1,070 líneas) - Considerar dividir
4. `ProductsPage.tsx` (1,059 líneas) - Considerar dividir
5. `DashboardPage.tsx` (1,032 líneas) - Considerar dividir
6. `sales.service.ts` (PWA) (965 líneas) - Considerar dividir
7. `ReportsPage.tsx` (956 líneas) - Considerar dividir
8. `MainLayout.tsx` (929 líneas) - Considerar dividir
9. `AdminPage.tsx` (899 líneas) - Límite aceptable
10. `sync.service.ts` (PWA) (846 líneas) - Límite aceptable
11. `InventoryPage.tsx` (820 líneas) - Límite aceptable

---

## Estrategia de Refactorización

### Fase 1: Preparación

1. Crear estructura de directorios para nuevos servicios/componentes
2. Identificar dependencias compartidas
3. Crear interfaces/tipos compartidos
4. Documentar flujo de datos actual

### Fase 2: Extracción Incremental

1. Extraer una funcionalidad a la vez
2. Crear nuevo servicio/componente
3. Actualizar imports
4. Verificar que build funciona
5. Verificar funcionalidad (manual testing)

### Fase 3: Limpieza

1. Eliminar código movido del archivo original
2. Actualizar documentación
3. Verificar que no quedan referencias rotas

### Principios

- **Una funcionalidad a la vez** - No refactorizar todo de golpe
- **Mantener funcionalidad** - No cambiar lógica, solo estructura
- **Verificar después de cada cambio** - Build debe pasar siempre
- **Alta cohesión, bajo acoplamiento** - Cada servicio/componente debe tener responsabilidad clara

---

## Orden de Prioridad

### 🔴 CRÍTICO (Hacer Primero)

1. `accounting.service.ts` (3,816 líneas) - Más grande, más crítico
2. `sales.service.ts` (2,419 líneas) - Core del negocio
3. `POSPage.tsx` (2,197 líneas) - UX crítica
4. `CheckoutModal.tsx` (1,916 líneas) - UX crítica

### 🟡 ALTO (Hacer Después)

5. `ml.service.ts` (1,837 líneas)
6. `auth.service.ts` (1,673 líneas)
7. `reports.service.ts` (1,498 líneas)
8. `LandingPageEnhanced.tsx` (2,356 líneas)

### 🟢 MEDIO (Hacer Cuando Sea Posible)

9. Archivos 800-1500 líneas restantes

---

## Métricas de Éxito

Después de refactorización:
- ✅ 0 archivos >1500 líneas
- ✅ 0 archivos >800 líneas (o mínimo necesario)
- ✅ Alta cohesión en cada archivo
- ✅ Bajo acoplamiento entre archivos
- ✅ Build funciona correctamente
- ✅ Funcionalidad se mantiene

---

## Notas Importantes

- **NO cambiar lógica de negocio** - Solo reorganizar código
- **Mantener tests existentes** - Asegurar que pasen después
- **Documentar cambios** - Actualizar JSDoc y comentarios
- **Commits incrementales** - Un servicio/componente por commit

---

**Estado:** 📋 PLAN CREADO - Pendiente de ejecución
