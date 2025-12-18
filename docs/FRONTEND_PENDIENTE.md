# 🎨 Frontend Pendiente - LA-CAJA
## Lista Completa de Implementaciones Frontend Requeridas

**Última actualización:** Enero 2025  
**Estado Backend:** ✅ 100% Completo  
**Objetivo:** Completar todas las interfaces de usuario para habilitar funcionalidades completas

---

## 📋 Tabla de Contenidos

1. [Prioridad Alta](#prioridad-alta)
2. [Prioridad Media](#prioridad-media)
3. [Prioridad Baja](#prioridad-baja)
4. [Integraciones con Periféricos](#integraciones-con-periféricos)
5. [Mejoras de UX/UI](#mejoras-de-uxui)
6. [Testing y Calidad](#testing-y-calidad)

---

## 🚨 Prioridad Alta

### 1. Módulo Contable Integrado

#### 1.1 Plan de Cuentas
**Endpoints Backend:** `/accounting/accounts/*`

**Componentes Requeridos:**
- `ChartOfAccountsPage.tsx` - Vista principal con árbol jerárquico
- `AccountFormModal.tsx` - Crear/editar cuenta
- `AccountTreeView.tsx` - Vista de árbol expandible/colapsable
- `AccountSearch.tsx` - Búsqueda de cuentas por código/nombre

**Funcionalidades:**
- ✅ Listar todas las cuentas con filtros (activas, por tipo)
- ✅ Vista de árbol jerárquico (padre-hijo)
- ✅ Crear cuenta nueva (con validación de código único)
- ✅ Editar cuenta existente
- ✅ Eliminar cuenta (solo si no tiene subcuentas ni movimientos)
- ✅ Inicializar plan de cuentas básico
- ✅ Búsqueda en tiempo real

**Guía de Implementación:**
Ver guía completa en: `docs/FRONTEND_ACCOUNTING_GUIDE.md` (creada anteriormente)

---

#### 1.2 Asientos Contables
**Endpoints Backend:** `/accounting/entries/*`

**Componentes Requeridos:**
- `JournalEntriesPage.tsx` - Lista de asientos con filtros
- `JournalEntryFormModal.tsx` - Crear/editar asiento manual
- `JournalEntryDetailModal.tsx` - Ver detalle de asiento
- `JournalEntryLineForm.tsx` - Formulario de línea de asiento
- `BalanceValidator.tsx` - Validación de balance en tiempo real

**Funcionalidades:**
- ✅ Listar asientos con filtros (tipo, estado, fecha, fuente)
- ✅ Crear asiento manual con validación de balance
- ✅ Agregar/eliminar líneas de asiento
- ✅ Validación en tiempo real (débito = crédito)
- ✅ Postear asiento (cambiar de draft a posted)
- ✅ Cancelar asiento con razón
- ✅ Ver detalle completo de asiento con todas las líneas
- ✅ Indicador visual de asientos automáticos vs manuales

**Validaciones Frontend:**
```typescript
// Validar balance antes de guardar
const totalDebitBs = lines.reduce((sum, l) => sum + l.debit_amount_bs, 0);
const totalCreditBs = lines.reduce((sum, l) => sum + l.credit_amount_bs, 0);
if (Math.abs(totalDebitBs - totalCreditBs) > 0.01) {
  // Error: Asiento no balanceado
}
```

---

#### 1.3 Mapeo de Cuentas
**Endpoints Backend:** `/accounting/mappings/*`

**Componentes Requeridos:**
- `AccountMappingsPage.tsx` - Lista de mapeos
- `AccountMappingFormModal.tsx` - Crear/editar mapeo

**Funcionalidades:**
- ✅ Listar todos los mapeos activos
- ✅ Crear mapeo (tipo de transacción → cuenta)
- ✅ Editar mapeo existente
- ✅ Eliminar mapeo
- ✅ Configurar condiciones (JSON o formulario guiado)
- ✅ Marcar como mapeo por defecto

---

#### 1.4 Exportaciones Contables
**Endpoints Backend:** `/accounting/export/*`

**Componentes Requeridos:**
- `AccountingExportsPage.tsx` - Lista de exportaciones
- `ExportAccountingFormModal.tsx` - Crear nueva exportación

**Funcionalidades:**
- ✅ Crear exportación (CSV/Excel/JSON/VioTech)
- ✅ Seleccionar estándar (IFRS/NIIF/Local)
- ✅ Seleccionar rango de fechas
- ✅ Filtros opcionales (tipos de asiento, cuentas)
- ✅ Listar exportaciones con estado (pending/processing/completed/failed)
- ✅ Descargar archivo cuando esté completado
- ✅ Indicador visual de progreso

---

#### 1.5 Reportes Contables
**Endpoints Backend:** `/accounting/reports/*`

**Componentes Requeridos:**
- `BalanceSheetPage.tsx` - Balance General
- `IncomeStatementPage.tsx` - Estado de Resultados
- `FinancialReportsLayout.tsx` - Layout común para reportes

**Funcionalidades:**

**Balance General:**
- ✅ Selector de fecha de corte
- ✅ Tres secciones: Activos, Pasivos, Patrimonio
- ✅ Totales destacados
- ✅ Botón de exportación (PDF/Excel)
- ✅ Formato de números con separadores

**Estado de Resultados:**
- ✅ Selector de rango de fechas
- ✅ Dos secciones: Ingresos, Gastos
- ✅ Ingreso neto destacado (verde si positivo, rojo si negativo)
- ✅ Botón de exportación (PDF/Excel)
- ✅ Formato de números con separadores

---

### 2. Multi-bodega y Transferencias

#### 2.1 Gestión de Bodegas
**Endpoints Backend:** `/warehouses/*`

**Componentes Requeridos:**
- `WarehousesPage.tsx` - Lista de bodegas
- `WarehouseFormModal.tsx` - Crear/editar bodega
- `WarehouseStockPage.tsx` - Stock por bodega

**Funcionalidades:**
- ✅ Listar todas las bodegas
- ✅ Crear bodega nueva
- ✅ Editar bodega existente
- ✅ Eliminar bodega (solo si no tiene stock)
- ✅ Ver stock por bodega
- ✅ Búsqueda de productos por bodega

---

#### 2.2 Transferencias entre Bodegas
**Endpoints Backend:** `/transfers/*`

**Componentes Requeridos:**
- `TransfersPage.tsx` - Lista de transferencias
- `TransferFormModal.tsx` - Crear transferencia
- `TransferDetailModal.tsx` - Ver detalle de transferencia
- `TransferItemForm.tsx` - Agregar ítems a transferencia

**Funcionalidades:**
- ✅ Listar transferencias con filtros (estado, bodega origen/destino, fecha)
- ✅ Crear transferencia nueva
- ✅ Agregar/eliminar ítems a transferencia
- ✅ Enviar transferencia (cambiar a "en tránsito")
- ✅ Recibir transferencia (confirmar recepción)
- ✅ Cancelar transferencia
- ✅ Ver detalle completo de transferencia
- ✅ Validar stock disponible antes de enviar

---

### 3. Órdenes de Compra y Proveedores

#### 3.1 Gestión de Proveedores
**Endpoints Backend:** `/suppliers/*`

**Componentes Requeridos:**
- `SuppliersPage.tsx` - Lista de proveedores
- `SupplierFormModal.tsx` - Crear/editar proveedor
- `SupplierDetailPage.tsx` - Detalle de proveedor con historial

**Funcionalidades:**
- ✅ Listar todos los proveedores
- ✅ Crear proveedor nuevo
- ✅ Editar proveedor existente
- ✅ Eliminar proveedor (solo si no tiene órdenes)
- ✅ Ver historial de órdenes del proveedor
- ✅ Búsqueda de proveedores

---

#### 3.2 Órdenes de Compra
**Endpoints Backend:** `/purchase-orders/*`

**Componentes Requeridos:**
- `PurchaseOrdersPage.tsx` - Lista de órdenes
- `PurchaseOrderFormModal.tsx` - Crear orden de compra
- `PurchaseOrderDetailModal.tsx` - Ver detalle de orden
- `PurchaseOrderItemForm.tsx` - Agregar ítems a orden
- `PurchaseOrderReceptionModal.tsx` - Recepción de orden

**Funcionalidades:**
- ✅ Listar órdenes con filtros (estado, proveedor, fecha)
- ✅ Crear orden de compra nueva
- ✅ Agregar/eliminar ítems a orden
- ✅ Enviar orden a proveedor
- ✅ Confirmar orden (proveedor acepta)
- ✅ Recepción parcial/completa de orden
- ✅ Cancelar orden
- ✅ Ver detalle completo de orden
- ✅ Historial de recepciones

---

### 4. Facturación Fiscal

#### 4.1 Configuración Fiscal
**Endpoints Backend:** `/fiscal-configs/*`

**Componentes Requeridos:**
- `FiscalConfigsPage.tsx` - Lista de configuraciones
- `FiscalConfigFormModal.tsx` - Crear/editar configuración

**Funcionalidades:**
- ✅ Listar configuraciones fiscales
- ✅ Crear configuración nueva
- ✅ Editar configuración existente
- ✅ Configurar datos fiscales (RIF, número de autorización, etc.)
- ✅ Configurar series de facturación

---

#### 4.2 Facturas Fiscales
**Endpoints Backend:** `/fiscal-invoices/*`

**Componentes Requeridos:**
- `FiscalInvoicesPage.tsx` - Lista de facturas fiscales
- `FiscalInvoiceFormModal.tsx` - Crear factura fiscal
- `FiscalInvoiceDetailModal.tsx` - Ver detalle de factura
- `FiscalInvoiceIssueModal.tsx` - Emitir factura fiscal

**Funcionalidades:**
- ✅ Listar facturas fiscales con filtros (estado, tipo, fecha)
- ✅ Crear factura fiscal desde venta o independiente
- ✅ Agregar/eliminar ítems a factura
- ✅ Emitir factura fiscal (transmitir al SENIAT)
- ✅ Cancelar factura fiscal
- ✅ Ver detalle completo de factura
- ✅ Imprimir factura fiscal
- ✅ Ver código QR y número fiscal
- ✅ Historial de emisiones

**Guía de Implementación:**
Ver guía completa proporcionada anteriormente para facturación fiscal

---

### 5. Dashboard Ejecutivo y Analytics en Tiempo Real

#### 5.1 Dashboard Ejecutivo
**Endpoints Backend:** `/dashboard/*`

**Componentes Requeridos:**
- `ExecutiveDashboardPage.tsx` - Dashboard principal
- `KPICard.tsx` - Tarjeta de KPI individual
- `SalesChart.tsx` - Gráfico de ventas
- `TopProductsChart.tsx` - Gráfico de top productos
- `PaymentMethodsChart.tsx` - Gráfico de métodos de pago

**Funcionalidades:**
- ✅ KPIs en tiempo real (ventas, inventario, finanzas, compras, fiscal)
- ✅ Gráficos interactivos (ventas, productos, métodos de pago)
- ✅ Comparativas período vs período
- ✅ Métricas de rendimiento
- ✅ Actualización automática cada 5-10 segundos
- ✅ Selector de rango de fechas

---

#### 5.2 Analytics en Tiempo Real
**Endpoints Backend:** `/realtime-analytics/*`

**Componentes Requeridos:**
- `RealTimeAnalyticsPage.tsx` - Página principal de analytics
- `RealTimeMetrics.tsx` - Métricas en tiempo real
- `SalesHeatmap.tsx` - Heatmap de ventas
- `ComparativeAnalytics.tsx` - Analytics comparativos
- `RealTimeAlerts.tsx` - Alertas en tiempo real

**Funcionalidades:**
- ✅ Métricas en tiempo real (WebSocket)
- ✅ Heatmaps de ventas (por hora/día)
- ✅ Analytics comparativos (período vs período)
- ✅ Alertas automáticas basadas en umbrales
- ✅ Configuración de umbrales de alertas
- ✅ Visualización de tendencias

---

### 6. Notificaciones Push

#### 6.1 Sistema de Notificaciones
**Endpoints Backend:** `/notifications/*`

**Componentes Requeridos:**
- `NotificationsPage.tsx` - Lista de notificaciones
- `NotificationBadge.tsx` - Badge de notificaciones no leídas
- `NotificationDropdown.tsx` - Dropdown de notificaciones recientes
- `NotificationPreferencesModal.tsx` - Preferencias de notificaciones

**Funcionalidades:**
- ✅ Listar notificaciones con filtros (tipo, categoría, leídas/no leídas)
- ✅ Marcar notificación como leída
- ✅ Marcar todas como leídas
- ✅ Badge de contador de no leídas
- ✅ Dropdown de notificaciones recientes
- ✅ Configurar preferencias de notificaciones
- ✅ Suscribirse/desuscribirse de canales
- ✅ Integración con Web Push API (PWA)
- ✅ Notificaciones en tiempo real (WebSocket)

---

## 🔧 Prioridad Media

### 7. Integraciones con Periféricos

#### 7.1 Integración con Balanzas
**Tecnología:** Web Serial API

**Componentes Requeridos:**
- `ScaleService.ts` - Servicio para comunicación con balanza
- `ScaleConnectionModal.tsx` - Modal para conectar balanza
- `WeightInput.tsx` - Input que lee peso de balanza automáticamente

**Funcionalidades:**
- ✅ Conectar/desconectar balanza
- ✅ Leer peso automáticamente
- ✅ Configurar puerto serial
- ✅ Configurar protocolo de balanza
- ✅ Indicador de estado de conexión
- ✅ Manejo de errores de conexión

**Implementación:**
```typescript
// Ejemplo de uso
const scaleService = new ScaleService();
await scaleService.connect(portName);
const weight = await scaleService.readWeight();
```

---

#### 7.2 Integración con Impresoras
**Tecnología:** ESC/POS

**Componentes Requeridos:**
- `PrinterService.ts` - Servicio para comunicación con impresora
- `PrinterConnectionModal.tsx` - Modal para conectar impresora
- `PrintTicketButton.tsx` - Botón para imprimir ticket

**Funcionalidades:**
- ✅ Conectar/desconectar impresora
- ✅ Imprimir tickets de venta
- ✅ Imprimir cortes X/Z
- ✅ Imprimir facturas fiscales
- ✅ Configurar puerto serial/USB
- ✅ Abrir gaveta de dinero
- ✅ Indicador de estado de conexión

**Implementación:**
```typescript
// Ejemplo de uso
const printerService = new PrinterService();
await printerService.connect(portName);
await printerService.printTicket(sale);
await printerService.openDrawer();
```

---

#### 7.3 Integración con Scanners
**Tecnología:** Web Serial API / HID

**Componentes Requeridos:**
- `ScannerService.ts` - Servicio para comunicación con scanner
- `ScannerConnectionModal.tsx` - Modal para conectar scanner
- `BarcodeInput.tsx` - Input que lee código de barras automáticamente

**Funcionalidades:**
- ✅ Conectar/desconectar scanner
- ✅ Leer código de barras automáticamente
- ✅ Configurar puerto serial/HID
- ✅ Indicador de estado de conexión
- ✅ Manejo de errores de conexión

**Implementación:**
```typescript
// Ejemplo de uso
const scannerService = new ScannerService();
await scannerService.connect(portName);
scannerService.onBarcode((barcode) => {
  // Procesar código de barras
});
```

---

## 📊 Prioridad Baja

### 8. Mejoras de UX/UI

#### 8.1 Optimizaciones de Performance
- ✅ Lazy loading de componentes pesados
- ✅ Code splitting por ruta
- ✅ Memoización de componentes
- ✅ Virtualización de listas largas
- ✅ Optimización de imágenes

#### 8.2 Accesibilidad
- ✅ Cumplir estándares WCAG 2.1
- ✅ Navegación por teclado
- ✅ Lectores de pantalla
- ✅ Contraste de colores adecuado

#### 8.3 Responsive Design
- ✅ Diseño adaptativo para móviles
- ✅ Optimización para tablets
- ✅ Touch-friendly en pantallas táctiles

---

### 9. Testing y Calidad

#### 9.1 Tests Unitarios
- ✅ Tests para componentes React
- ✅ Tests para servicios
- ✅ Tests para hooks personalizados
- ✅ Cobertura mínima: 70%

#### 9.2 Tests de Integración
- ✅ Tests de flujos completos
- ✅ Tests de API integration
- ✅ Tests de sincronización offline

#### 9.3 Tests E2E
- ✅ Tests de flujos críticos (venta, inventario, caja)
- ✅ Tests de periféricos (simulados)
- ✅ Tests de offline-first

---

## 📝 Notas de Implementación

### Arquitectura Frontend Recomendada

```
apps/pwa/src/
├── components/
│   ├── accounting/          # Módulo contable
│   ├── warehouses/           # Multi-bodega
│   ├── transfers/           # Transferencias
│   ├── suppliers/           # Proveedores
│   ├── purchase-orders/      # Órdenes de compra
│   ├── fiscal-invoices/      # Facturación fiscal
│   ├── dashboard/            # Dashboard ejecutivo
│   ├── realtime-analytics/   # Analytics en tiempo real
│   ├── notifications/        # Notificaciones
│   └── peripherals/          # Periféricos
├── pages/
│   ├── AccountingPage.tsx
│   ├── WarehousesPage.tsx
│   ├── PurchaseOrdersPage.tsx
│   ├── FiscalInvoicesPage.tsx
│   ├── DashboardPage.tsx
│   └── ...
├── services/
│   ├── accounting.service.ts
│   ├── warehouses.service.ts
│   ├── purchase-orders.service.ts
│   ├── fiscal-invoices.service.ts
│   ├── dashboard.service.ts
│   ├── realtime-analytics.service.ts
│   ├── notifications.service.ts
│   └── peripherals.service.ts
└── hooks/
    ├── useAccounting.ts
    ├── useWarehouses.ts
    ├── usePurchaseOrders.ts
    ├── useFiscalInvoices.ts
    ├── useDashboard.ts
    ├── useRealtimeAnalytics.ts
    └── useNotifications.ts
```

### Consideraciones Importantes

1. **Offline-First**: Todas las funcionalidades deben funcionar offline
2. **Multi-moneda**: Siempre mostrar BS y USD
3. **Validaciones**: Validar en tiempo real antes de enviar al backend
4. **Loading States**: Mostrar estados de carga apropiados
5. **Error Handling**: Manejar errores de forma amigable
6. **Responsive**: Diseño adaptativo para todos los dispositivos

---

## 🎯 Priorización para SaaS

Para preparar el sistema para SaaS, priorizar:

1. **Módulo Contable** - Crítico para facturación y reportes
2. **Dashboard Ejecutivo** - Diferenciador clave
3. **Notificaciones Push** - Mejora UX significativa
4. **Multi-bodega** - Funcionalidad avanzada importante
5. **Facturación Fiscal** - Requisito legal en muchos países
6. **Órdenes de Compra** - Funcionalidad empresarial
7. **Analytics en Tiempo Real** - Diferenciador
8. **Periféricos** - Mejora operativa

---

**Última actualización**: Enero 2025  
**Estado**: Backend 100% completo - Frontend pendiente de implementación


