# Plan de Optimización UI/UX - LA CAJA POS

> Documento de mejoras, optimizaciones y robustecimiento del frontend PWA

**Fecha de creación:** 2026-01-15
**Última actualización:** 2026-01-15
**Versión:** 1.0

---

## Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Leyenda de Estados](#leyenda-de-estados)
3. [Módulo: POS (Punto de Venta)](#módulo-pos-punto-de-venta)
4. [Módulo: Productos](#módulo-productos)
5. [Módulo: Inventario](#módulo-inventario)
6. [Módulo: Ventas](#módulo-ventas)
7. [Módulo: Caja y Turnos](#módulo-caja-y-turnos)
8. [Módulo: Clientes y Deudas](#módulo-clientes-y-deudas)
9. [Módulo: Proveedores y Órdenes de Compra](#módulo-proveedores-y-órdenes-de-compra)
10. [Módulo: Descuentos y Promociones](#módulo-descuentos-y-promociones)
11. [Módulo: Lotes y Seriales](#módulo-lotes-y-seriales)
12. [Módulo: Bodegas y Transferencias](#módulo-bodegas-y-transferencias)
13. [Módulo: Dashboard y Reportes](#módulo-dashboard-y-reportes)
14. [Módulo: Configuración Fiscal](#módulo-configuración-fiscal)
15. [Módulo: Machine Learning](#módulo-machine-learning)
16. [Módulo: Analítica en Tiempo Real](#módulo-analítica-en-tiempo-real)
17. [Módulo: Mesas (Restaurante)](#módulo-mesas-restaurante)
18. [Módulo: Periféricos](#módulo-periféricos)
19. [Componentes Globales](#componentes-globales)
20. [Optimizaciones de Rendimiento](#optimizaciones-de-rendimiento)
21. [Accesibilidad (A11y)](#accesibilidad-a11y)
22. [Experiencia Móvil](#experiencia-móvil)
23. [Issues Identificados](#issues-identificados)
24. [Changelog](#changelog)

---

## Resumen Ejecutivo

Este documento contiene el checklist completo de optimizaciones UI/UX para el frontend PWA de LA CAJA. Cada módulo tiene categorías de mejoras:

- **UI Visual**: Mejoras estéticas y de diseño
- **UX Flow**: Mejoras en flujo de usuario y usabilidad
- **Robustez**: Manejo de errores, validaciones, estados
- **Performance**: Optimizaciones de rendimiento
- **Mobile**: Adaptaciones para dispositivos móviles

---

## Leyenda de Estados

| Símbolo | Estado |
|---------|--------|
| ⬜ | Pendiente |
| 🔄 | En progreso |
| ✅ | Completado |
| ❌ | Con problemas |
| 🔮 | Nice-to-have (futuro) |
| ⚠️ | Prioridad alta |

---

## Módulo: POS (Punto de Venta)

**Archivos principales:**
- `pages/POSPage.tsx`
- `components/pos/CheckoutModal.tsx`
- `components/pos/WeightInputModal.tsx`
- `components/pos/SplitPaymentManager.tsx`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| POS-UI-01 | Indicador visual de scanner de código de barras | ✅ | Alta |
| POS-UI-02 | Animación al agregar producto al carrito | ✅ | Media |
| POS-UI-03 | Destacar productos con stock bajo en resultados | ✅ | Media |
| POS-UI-04 | Modo oscuro optimizado para uso nocturno | ⬜ | Baja |
| POS-UI-05 | Iconos de categoría en lista de productos | ✅ | Baja |
| POS-UI-06 | Badge de cantidad en carrito con animación | ✅ | Baja |
| POS-UI-07 | Mejores indicadores de precios por peso | ✅ | Media |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| POS-UX-01 | Scanner de código de barras funcional | ✅ | Alta |
| POS-UX-02 | Búsqueda por voz (Web Speech API) | 🔮 | Baja |
| POS-UX-03 | Historial de últimos productos vendidos | ✅ | Media |
| POS-UX-04 | Atajos de teclado visibles en UI | ✅ | Media |
| POS-UX-05 | Autocompletado inteligente en búsqueda | ✅ | Media |
| POS-UX-06 | Sugerencias de productos complementarios | ✅ | Baja |
| POS-UX-07 | Confirmación rápida con Enter en checkout | ✅ | Alta |
| POS-UX-08 | Sonido de confirmación al escanear (opcional) | ✅ | Baja |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| POS-RB-01 | Manejo de error cuando no hay caja abierta | ✅ | Alta |
| POS-RB-02 | Validación de stock antes de agregar al carrito | ✅ | Alta |
| POS-RB-03 | Recuperación de carrito en caso de cierre accidental | ✅ | Alta |
| POS-RB-04 | Confirmación antes de limpiar carrito | ✅ | Media |
| POS-RB-05 | Manejo de productos eliminados/inactivos en carrito | ✅ | Alta |
| POS-RB-06 | Timeout con retry en búsqueda de productos | ✅ | Media |
| POS-RB-07 | Validación de cantidad máxima por producto | ✅ | Media |

### Performance
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| POS-PF-01 | Debounce en búsqueda de productos | ✅ | Alta |
| POS-PF-02 | Virtualización de lista de productos largos | ✅ | Media |
| POS-PF-03 | Precarga de productos frecuentes | ✅ | Media |
| POS-PF-04 | Cache de búsquedas recientes | ✅ | Baja |
| POS-PF-05 | Lazy loading de imágenes de productos | 🔮 | Baja |

### Mobile
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| POS-MB-01 | Swipe para eliminar items del carrito | ⬜ | Media |
| POS-MB-02 | Teclado numérico optimizado para cantidades | ⬜ | Media |
| POS-MB-03 | Haptic feedback al agregar productos | 🔮 | Baja |
| POS-MB-04 | Modo landscape para tablets | ⬜ | Media |
| POS-MB-05 | Bottom sheet para checkout en móvil | ⬜ | Media |

---

## Módulo: Productos

**Archivos principales:**
- `pages/ProductsPage.tsx`
- `components/products/ProductFormModal.tsx`
- `components/products/BulkPriceChangeModal.tsx`
- `components/products/ImportCSVModal.tsx`
- `components/products/CleanDuplicatesModal.tsx`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| PRD-UI-01 | Vista de galería con imágenes de productos | 🔮 | Baja |
| PRD-UI-02 | Indicador visual de margen de ganancia | ✅ | Alta |
| PRD-UI-03 | Badges de estado (activo/inactivo/sin stock) | ✅ | Media |
| PRD-UI-04 | Código de barras visual en detalle | ✅ | Baja |
| PRD-UI-05 | Tooltips informativos en campos complejos | ✅ | Media |
| PRD-UI-06 | Colores por categoría en lista | ⬜ | Baja |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| PRD-UX-01 | Duplicar producto existente | ⬜ | Media |
| PRD-UX-02 | Edición inline de precios en tabla | ⬜ | Media |
| PRD-UX-03 | Filtros guardados/favoritos | 🔮 | Baja |
| PRD-UX-04 | Exportar productos a Excel | ✅ | Media |
| PRD-UX-05 | Bulk edit de categorías | ⬜ | Media |
| PRD-UX-06 | Historial de cambios de precio | 🔮 | Baja |
| PRD-UX-07 | Preview de cómo se ve en POS | ⬜ | Baja |
| PRD-UX-08 | Importación masiva CSV | ✅ | Alta |
| PRD-UX-09 | Cambio masivo de precios | ✅ | Alta |
| PRD-UX-10 | Limpiar productos duplicados | ✅ | Media |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| PRD-RB-01 | Validación de código de barras único | ✅ | Alta |
| PRD-RB-02 | Confirmación antes de eliminar producto | ✅ | Alta |
| PRD-RB-03 | Validación de precios (no negativos, coherentes) | ✅ | Alta |
| PRD-RB-04 | Advertencia si precio < costo | ✅ | Alta |
| PRD-RB-05 | Manejo de errores en importación CSV | ✅ | Alta |
| PRD-RB-06 | Rollback si falla importación masiva | ⬜ | Media |
| PRD-RB-07 | Validación de campos requeridos con mensajes claros | ✅ | Alta |

### Performance
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| PRD-PF-01 | Paginación server-side | ✅ | Alta |
| PRD-PF-02 | Virtualización de tabla grande | ⬜ | Media |
| PRD-PF-03 | Debounce en filtros | ✅ | Media |
| PRD-PF-04 | Cache de categorías | ✅ | Baja |
| PRD-PF-05 | Cache offline de productos | ✅ | Alta |

### Mobile
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| PRD-MB-01 | Vista de cards en lugar de tabla para móvil | ✅ | Alta |
| PRD-MB-02 | Formulario de producto optimizado para touch | ⬜ | Media |
| PRD-MB-03 | Escanear código de barras con cámara | 🔮 | Media |
| PRD-MB-04 | Pull-to-refresh | ⬜ | Baja |

---

## Módulo: Inventario

**Archivos principales:**
- `pages/InventoryPage.tsx`
- `components/inventory/MovementsModal.tsx`
- `components/inventory/StockReceivedModal.tsx`
- `components/inventory/StockAdjustModal.tsx`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| INV-UI-01 | Gráfico de stock por producto | ⬜ | Media |
| INV-UI-02 | Indicadores visuales de stock crítico | ✅ | Alta |
| INV-UI-03 | Timeline visual de movimientos | ⬜ | Baja |
| INV-UI-04 | Código de colores por tipo de movimiento | ⬜ | Media |
| INV-UI-05 | Barra de progreso de stock vs mínimo | ⬜ | Media |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| INV-UX-01 | Filtro por fecha en movimientos | ✅ | Alta |
| INV-UX-02 | Exportar inventario a Excel | ✅ | Alta |
| INV-UX-03 | Ajuste masivo de inventario | ⬜ | Media |
| INV-UX-04 | Conteo físico con checklist | 🔮 | Media |
| INV-UX-05 | Alertas configurables de stock bajo | ⬜ | Media |
| INV-UX-06 | Reporte de productos sin movimiento | ⬜ | Baja |
| INV-UX-07 | Sugerencia de reorden automática | 🔮 | Baja |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| INV-RB-01 | Validación de stock no negativo | ✅ | Alta |
| INV-RB-02 | Confirmación de ajustes grandes | ✅ | Alta |
| INV-RB-03 | Auditoría de cambios de inventario | ⬜ | Media |
| INV-RB-04 | Bloqueo de ajuste si hay ventas pendientes | ⬜ | Alta |
| INV-RB-05 | Validación de razón en ajustes | ⬜ | Media |

### Performance
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| INV-PF-01 | Paginación de movimientos | ⬜ | Alta |
| INV-PF-02 | Cache de stock actual | ⬜ | Media |
| INV-PF-03 | Actualización en tiempo real de stock | ⬜ | Media |

### Mobile
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| INV-MB-01 | Escaneo de producto para recepción | ⬜ | Alta |
| INV-MB-02 | Interfaz simplificada para conteo | ⬜ | Media |
| INV-MB-03 | Notificaciones push de stock bajo | ⬜ | Media |

---

## Módulo: Ventas

**Archivos principales:**
- `pages/SalesPage.tsx`
- `components/sales/SaleDetailModal.tsx`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| SLS-UI-01 | Gráfico de ventas del día | ⬜ | Media |
| SLS-UI-02 | Indicadores de método de pago | ✅ | Media |
| SLS-UI-03 | Estado de venta con colores (completada/anulada) | ✅ | Media |
| SLS-UI-04 | Vista de ticket en modal de detalle | ✅ | Media |
| SLS-UI-05 | Mini-preview de productos en lista | ⬜ | Baja |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| SLS-UX-01 | Filtros avanzados (fecha, monto, método) | ✅ | Alta |
| SLS-UX-02 | Búsqueda por número de venta | ✅ | Alta |
| SLS-UX-03 | Reimprimir ticket | ✅ | Alta |
| SLS-UX-04 | Anular venta con razón | ✅ | Alta |
| SLS-UX-05 | Exportar ventas a Excel | ✅ | Media |
| SLS-UX-06 | Devolución parcial de productos | ✅ | Alta |
| SLS-UX-07 | Notas/comentarios en venta | ⬜ | Baja |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| SLS-RB-01 | Confirmación antes de anular venta | ✅ | Alta |
| SLS-RB-02 | Validación de permisos para anular | ✅ | Alta |
| SLS-RB-03 | Registro de quién anuló y cuándo | ✅ | Alta |
| SLS-RB-04 | Prevenir doble anulación | ✅ | Alta |
| SLS-RB-05 | Manejo de ventas offline sincronizadas | ✅ | Alta |

### Performance
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| SLS-PF-01 | Paginación server-side | ✅ | Alta |
| SLS-PF-02 | Lazy loading de detalles | ✅ | Media |
| SLS-PF-03 | Cache de ventas del día | ✅ | Baja |

### Mobile
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| SLS-MB-01 | Vista de lista compacta | ⬜ | Media |
| SLS-MB-02 | Compartir ticket por WhatsApp | ⬜ | Media |
| SLS-MB-03 | Swipe para ver acciones rápidas | ⬜ | Baja |

---

## Módulo: Caja y Turnos

**Archivos principales:**
- `pages/CashPage.tsx`
- `pages/ShiftsPage.tsx`
- `components/cash/OpenCashModal.tsx`
- `components/cash/CloseCashModal.tsx`
- `components/cash/CashSessionsList.tsx`
- `components/payments/CashMovementsSummary.tsx`
- `components/shifts/OpenShiftModal.tsx`
- `components/shifts/CloseShiftModal.tsx`
- `components/shifts/CutXModal.tsx`
- `components/shifts/CutZModal.tsx`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| CSH-UI-01 | Dashboard de caja con métricas visuales | ✅ | Media |
| CSH-UI-02 | Gráfico de efectivo vs digital | ⬜ | Baja |
| CSH-UI-03 | Timeline de movimientos de caja | ⬜ | Baja |
| CSH-UI-04 | Indicador de turno activo prominente | ✅ | Alta |
| CSH-UI-05 | Resumen visual en cierre | ✅ | Media |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| CSH-UX-01 | Wizard de cierre de caja paso a paso | ⬜ | Media |
| CSH-UX-02 | Calculadora de denominaciones | ✅ | Alta |
| CSH-UX-03 | Comparación automática efectivo físico vs sistema | ✅ | Alta |
| CSH-UX-04 | Alertas de diferencias significativas | ✅ | Alta |
| CSH-UX-05 | Historial de cortes X/Z | ✅ | Media |
| CSH-UX-06 | Imprimir resumen de turno | ⬜ | Media |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| CSH-RB-01 | Prevenir ventas sin caja abierta | ✅ | Alta |
| CSH-RB-02 | Validación de monto inicial | ✅ | Alta |
| CSH-RB-03 | Forzar cierre de caja al final del día | ⬜ | Media |
| CSH-RB-04 | Auditoría de todos los movimientos | ✅ | Alta |
| CSH-RB-05 | Bloqueo de caja si diferencia > umbral | ⬜ | Media |

### Performance
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| CSH-PF-01 | Cálculos de resumen en tiempo real | ✅ | Media |
| CSH-PF-02 | Cache de sesión activa | ✅ | Baja |

### Mobile
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| CSH-MB-01 | Vista simplificada de caja para móvil | ⬜ | Media |
| CSH-MB-02 | Input numérico optimizado para conteo | ⬜ | Media |
| CSH-MB-03 | Notificación de turno por cerrar | ⬜ | Baja |

---

## Módulo: Clientes y Deudas

**Archivos principales:**
- `pages/CustomersPage.tsx`
- `pages/DebtsPage.tsx`
- `components/customers/CustomerFormModal.tsx`
- `components/customers/CustomerHistoryModal.tsx`
- `components/debts/DebtDetailModal.tsx`
- `components/debts/AddPaymentModal.tsx`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| CUS-UI-01 | Avatar/iniciales de cliente | ✅ | Baja |
| CUS-UI-02 | Indicador de saldo deudor prominente | ✅ | Alta |
| CUS-UI-03 | Timeline de pagos | ✅ | Media |
| CUS-UI-04 | Gráfico de historial de compras | ✅ | Baja |
| CUS-UI-05 | Código de colores por estado de deuda | ✅ | Media |
| CUS-UI-06 | Badge de límite de crédito | ✅ | Media |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| CUS-UX-01 | Búsqueda rápida por cédula/teléfono/email | ✅ | Alta |
| CUS-UX-02 | Crear cliente desde POS si no existe | ✅ | Alta |
| CUS-UX-03 | Historial de compras del cliente | ✅ | Media |
| CUS-UX-04 | Recordatorio de cobro (WhatsApp/SMS) | 🔮 | Media |
| CUS-UX-05 | Límite de crédito configurable | ✅ | Alta |
| CUS-UX-06 | Estado de cuenta imprimible | ⬜ | Media |
| CUS-UX-07 | Abono parcial de deuda | ✅ | Alta |
| CUS-UX-08 | Verificación de crédito disponible | ✅ | Alta |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| CUS-RB-01 | Validación de cédula única | ✅ | Alta |
| CUS-RB-02 | Validación de teléfono | ✅ | Media |
| CUS-RB-03 | Bloqueo de venta fiada si excede límite | ✅ | Alta |
| CUS-RB-04 | Confirmación antes de eliminar cliente con deuda | ✅ | Alta |
| CUS-RB-05 | Registro de quién registró el pago | ✅ | Media |

### Performance
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| CUS-PF-01 | Búsqueda con autocomplete | ✅ | Media |
| CUS-PF-02 | Cache de clientes frecuentes | ✅ | Baja |

### Mobile
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| CUS-MB-01 | Llamar directo desde lista | ⬜ | Media |
| CUS-MB-02 | Enviar mensaje por WhatsApp | ⬜ | Media |
| CUS-MB-03 | Vista de tarjeta para clientes | ✅ | Media |

---

## Módulo: Proveedores y Órdenes de Compra

**Archivos principales:**
- `pages/SuppliersPage.tsx`
- `pages/PurchaseOrdersPage.tsx`
- `components/purchase-orders/PurchaseOrderFormModal.tsx`
- `components/purchase-orders/PurchaseOrderDetailModal.tsx`
- `components/purchase-orders/PurchaseOrderReceptionModal.tsx`
- `components/suppliers/SupplierPriceImportModal.tsx`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| SUP-UI-01 | Estado de orden con colores | ⬜ | Media |
| SUP-UI-02 | Timeline de estados de orden | ⬜ | Baja |
| SUP-UI-03 | Indicador de órdenes pendientes | ✅ | Alta |
| SUP-UI-04 | Comparación de precios entre proveedores | 🔮 | Media |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| SUP-UX-01 | Crear orden desde productos con stock bajo | ⬜ | Alta |
| SUP-UX-02 | Recepción parcial de orden | ⬜ | Alta |
| SUP-UX-03 | Importar lista de precios del proveedor | ⬜ | Media |
| SUP-UX-04 | Historial de compras por proveedor | ⬜ | Media |
| SUP-UX-05 | Duplicar orden anterior | ⬜ | Media |
| SUP-UX-06 | Enviar orden por email/WhatsApp | 🔮 | Baja |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| SUP-RB-01 | Validación de RIF único | ⬜ | Media |
| SUP-RB-02 | Validación de cantidades en recepción | ⬜ | Alta |
| SUP-RB-03 | Registro de diferencias en recepción | ⬜ | Alta |
| SUP-RB-04 | Bloqueo de edición de orden recibida | ⬜ | Alta |

### Performance
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| SUP-PF-01 | Paginación de órdenes | ⬜ | Media |
| SUP-PF-02 | Autocomplete de productos en orden | ⬜ | Media |

### Mobile
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| SUP-MB-01 | Recepción de mercancía con scanner | ⬜ | Alta |
| SUP-MB-02 | Vista simplificada de órdenes | ⬜ | Media |

---

## Módulo: Descuentos y Promociones

**Archivos principales:**
- `pages/DiscountsPage.tsx`
- `pages/PromotionsPage.tsx`
- `components/discounts/DiscountConfigModal.tsx`
- `components/discounts/DiscountAuthorizationModal.tsx`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| DSC-UI-01 | Indicador de descuentos activos | ⬜ | Media |
| DSC-UI-02 | Preview de descuento aplicado | ⬜ | Media |
| DSC-UI-03 | Calendario visual de promociones | 🔮 | Baja |
| DSC-UI-04 | Badge de promoción en POS | ⬜ | Media |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| DSC-UX-01 | Autorización de descuento por supervisor | ⬜ | Alta |
| DSC-UX-02 | Límites de descuento por rol | ⬜ | Alta |
| DSC-UX-03 | Promociones automáticas (2x1, etc) | ⬜ | Media |
| DSC-UX-04 | Historial de descuentos aplicados | ⬜ | Media |
| DSC-UX-05 | Cupones de descuento | 🔮 | Baja |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| DSC-RB-01 | Validación de % máximo de descuento | ✅ | Alta |
| DSC-RB-02 | Registro de quién autorizó | ⬜ | Alta |
| DSC-RB-03 | Prevenir descuentos duplicados | ⬜ | Media |
| DSC-RB-04 | Validación de fechas de promoción | ⬜ | Media |

---

## Módulo: Lotes y Seriales

**Archivos principales:**
- `pages/LotsPage.tsx`
- `components/lots/ProductLotModal.tsx`
- `components/lots/ProductLotsList.tsx`
- `components/lots/ExpiringLotsAlert.tsx`
- `components/serials/ProductSerialModal.tsx`
- `components/serials/ProductSerialsList.tsx`
- `components/serials/SerialSelector.tsx`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| LOT-UI-01 | Indicador visual de vencimiento próximo | ✅ | Alta |
| LOT-UI-02 | Timeline de movimientos de lote | ⬜ | Baja |
| LOT-UI-03 | Código de colores por estado de serial | ✅ | Media |
| LOT-UI-04 | Dashboard de lotes por vencer | ⬜ | Media |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| LOT-UX-01 | Alerta automática de productos próximos a vencer | ✅ | Alta |
| LOT-UX-02 | Selección de lote en venta (FIFO automático) | ⬜ | Alta |
| LOT-UX-03 | Registro de serial en venta | ✅ | Alta |
| LOT-UX-04 | Búsqueda de serial para garantía | ⬜ | Media |
| LOT-UX-05 | Importación masiva de seriales | ⬜ | Media |
| LOT-UX-06 | Trazabilidad de serial (historial completo) | ⬜ | Media |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| LOT-RB-01 | Validación de serial único | ✅ | Alta |
| LOT-RB-02 | Prevenir venta de lote vencido | ⬜ | Alta |
| LOT-RB-03 | Bloqueo de serial ya vendido | ✅ | Alta |
| LOT-RB-04 | Validación de fecha de vencimiento | ⬜ | Media |

---

## Módulo: Bodegas y Transferencias

**Archivos principales:**
- `pages/WarehousesPage.tsx`
- `pages/TransfersPage.tsx`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| WHS-UI-01 | Mapa/layout visual de bodegas | 🔮 | Baja |
| WHS-UI-02 | Indicador de stock por bodega | ⬜ | Media |
| WHS-UI-03 | Estado de transferencia con colores | ⬜ | Media |
| WHS-UI-04 | Timeline de transferencia | ⬜ | Baja |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| WHS-UX-01 | Transferencia con confirmación de recepción | ⬜ | Alta |
| WHS-UX-02 | Selección de bodega en venta | ⬜ | Alta |
| WHS-UX-03 | Consolidación de stock entre bodegas | ⬜ | Media |
| WHS-UX-04 | Historial de transferencias por bodega | ⬜ | Media |
| WHS-UX-05 | Impresión de guía de transferencia | ⬜ | Baja |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| WHS-RB-01 | Validación de stock en bodega origen | ⬜ | Alta |
| WHS-RB-02 | Confirmación de recepción requerida | ⬜ | Alta |
| WHS-RB-03 | Registro de diferencias en transferencia | ⬜ | Media |
| WHS-RB-04 | Prevenir eliminar bodega con stock | ✅ | Alta |

---

## Módulo: Dashboard y Reportes

**Archivos principales:**
- `pages/DashboardPage.tsx`
- `pages/ReportsPage.tsx`
- `pages/AccountingPage.tsx`
- `components/accounting/BalanceSheetReport.tsx`
- `components/accounting/IncomeStatementReport.tsx`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| DSH-UI-01 | Gráficos interactivos de ventas | ✅ | Alta |
| DSH-UI-02 | KPIs con indicadores de tendencia | ✅ | Alta |
| DSH-UI-03 | Comparación período anterior | ✅ | Media |
| DSH-UI-04 | Heatmap de ventas por hora/día | ⬜ | Media |
| DSH-UI-05 | Top productos visualizado | ✅ | Media |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| DSH-UX-01 | Filtros de fecha rápidos (hoy, semana, mes) | ✅ | Alta |
| DSH-UX-02 | Exportar reportes a PDF | ✅ | Alta |
| DSH-UX-03 | Exportar reportes a Excel | ✅ | Alta |
| DSH-UX-04 | Dashboard personalizable | 🔮 | Baja |
| DSH-UX-05 | Reportes programados por email | 🔮 | Baja |
| DSH-UX-06 | Comparar períodos específicos | ✅ | Media |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| DSH-RB-01 | Manejo de datos vacíos con mensaje claro | ✅ | Alta |
| DSH-RB-02 | Loading states para gráficos | ✅ | Media |
| DSH-RB-03 | Validación de rangos de fecha válidos | ✅ | Media |
| DSH-RB-04 | Fallback si falla carga de datos | ✅ | Alta |

### Performance
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| DSH-PF-01 | Cache de métricas del día | ✅ | Alta |
| DSH-PF-02 | Lazy loading de gráficos pesados | ⬜ | Media |
| DSH-PF-03 | Agregaciones server-side | ✅ | Alta |

---

## Módulo: Configuración Fiscal

**Archivos principales:**
- `pages/FiscalConfigPage.tsx`
- `pages/FiscalInvoicesPage.tsx`
- `pages/FiscalInvoiceDetailPage.tsx`
- `pages/InvoiceSeriesPage.tsx`
- `components/fiscal/CreateFiscalInvoiceFromSaleModal.tsx`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| FSC-UI-01 | Preview de factura fiscal | ⬜ | Media |
| FSC-UI-02 | Estado de sincronización con SENIAT | ⬜ | Alta |
| FSC-UI-03 | Indicador de secuencia de facturas | ⬜ | Media |
| FSC-UI-04 | Formato de factura para imprimir | ✅ | Alta |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| FSC-UX-01 | Generar factura desde venta | ⬜ | Alta |
| FSC-UX-02 | Anular factura con nota de crédito | ⬜ | Alta |
| FSC-UX-03 | Configuración de datos fiscales del negocio | ⬜ | Alta |
| FSC-UX-04 | Libro de ventas exportable | ⬜ | Alta |
| FSC-UX-05 | Validación de RIF de cliente | ✅ | Alta |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| FSC-RB-01 | Validación de correlativo único | ⬜ | Alta |
| FSC-RB-02 | Prevenir gaps en numeración | ⬜ | Alta |
| FSC-RB-03 | Validación de formato de factura | ⬜ | Alta |
| FSC-RB-04 | Backup de facturas emitidas | ⬜ | Alta |

---

## Módulo: Machine Learning

**Archivos principales:**
- `pages/MLDashboardPage.tsx`
- `pages/DemandPredictionsPage.tsx`
- `pages/DemandEvaluationPage.tsx`
- `pages/AnomaliesPage.tsx`
- `components/ml/AnomaliesList.tsx`
- `components/ml/DemandPredictionCard.tsx`
- `components/ml/ProductRecommendations.tsx`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| ML-UI-01 | Gráficos de predicción con intervalo de confianza | ⬜ | Media |
| ML-UI-02 | Indicador de anomalías críticas | ⬜ | Alta |
| ML-UI-03 | Explicación visual de predicciones | ⬜ | Media |
| ML-UI-04 | Dashboard de accuracy del modelo | ⬜ | Baja |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| ML-UX-01 | Recomendaciones de reorden automático | ⬜ | Media |
| ML-UX-02 | Alertas de anomalías en tiempo real | ⬜ | Alta |
| ML-UX-03 | Feedback loop para mejorar predicciones | 🔮 | Baja |
| ML-UX-04 | Comparación predicción vs real | ⬜ | Media |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| ML-RB-01 | Fallback si modelo no disponible | ⬜ | Alta |
| ML-RB-02 | Indicador de confianza en predicción | ⬜ | Media |
| ML-RB-03 | Manejo de datos insuficientes | ⬜ | Alta |

---

## Módulo: Analítica en Tiempo Real

**Archivos principales:**
- `pages/RealtimeAnalyticsPage.tsx`
- `components/realtime/AlertsPanel.tsx`
- `components/realtime/RealtimeMetricsCard.tsx`
- `components/realtime/SalesHeatmapChart.tsx`
- `components/realtime/ThresholdsManager.tsx`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| RT-UI-01 | Métricas con actualización animada | ⬜ | Media |
| RT-UI-02 | Alertas con prioridad por color | ⬜ | Alta |
| RT-UI-03 | Gráfico de línea en tiempo real | ⬜ | Media |
| RT-UI-04 | Indicador de conexión WebSocket | ⬜ | Alta |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| RT-UX-01 | Configuración de umbrales de alerta | ⬜ | Alta |
| RT-UX-02 | Notificaciones push de alertas | ⬜ | Alta |
| RT-UX-03 | Histórico de alertas | ⬜ | Media |
| RT-UX-04 | Silenciar alertas temporalmente | ⬜ | Media |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| RT-RB-01 | Reconexión automática WebSocket | ⬜ | Alta |
| RT-RB-02 | Fallback a polling si WS falla | ⬜ | Alta |
| RT-RB-03 | Buffer de datos durante desconexión | ⬜ | Media |

---

## Módulo: Mesas (Restaurante)

**Archivos principales:**
- `pages/TablesPage.tsx`
- `components/tables/TableModal.tsx`
- `components/tables/TablesGrid.tsx`
- `components/tables/OrderModal.tsx`
- `components/tables/PartialPaymentModal.tsx`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| TBL-UI-01 | Vista de plano del local | 🔮 | Baja |
| TBL-UI-02 | Estado de mesa con colores (libre/ocupada/cuenta) | ⬜ | Alta |
| TBL-UI-03 | Indicador de tiempo de ocupación | ⬜ | Media |
| TBL-UI-04 | Badge de monto pendiente | ⬜ | Alta |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| TBL-UX-01 | Agregar items a mesa abierta | ⬜ | Alta |
| TBL-UX-02 | Dividir cuenta entre comensales | ⬜ | Alta |
| TBL-UX-03 | Transferir items entre mesas | ⬜ | Media |
| TBL-UX-04 | Unir mesas | ⬜ | Media |
| TBL-UX-05 | Imprimir comanda a cocina | ⬜ | Alta |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| TBL-RB-01 | Prevenir cerrar mesa con items pendientes | ⬜ | Alta |
| TBL-RB-02 | Confirmación antes de cancelar orden | ⬜ | Alta |
| TBL-RB-03 | Registro de quién atendió la mesa | ⬜ | Media |

---

## Módulo: Periféricos

**Archivos principales:**
- `pages/PeripheralsPage.tsx`
- `components/peripherals/PeripheralsList.tsx`
- `components/peripherals/PeripheralConfigModal.tsx`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| PER-UI-01 | Indicador de estado de conexión | ⬜ | Alta |
| PER-UI-02 | Icono por tipo de periférico | ⬜ | Media |
| PER-UI-03 | Test de impresión visual | ⬜ | Media |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| PER-UX-01 | Auto-detección de impresoras | ⬜ | Media |
| PER-UX-02 | Configuración de ancho de ticket | ⬜ | Media |
| PER-UX-03 | Test de impresión desde configuración | ⬜ | Alta |
| PER-UX-04 | Configuración de báscula/balanza | 🔮 | Baja |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| PER-RB-01 | Fallback si periférico no disponible | ⬜ | Alta |
| PER-RB-02 | Retry automático en error de impresión | ⬜ | Media |
| PER-RB-03 | Mensaje claro si no hay permisos | ⬜ | Alta |

---

## Componentes Globales

**Archivos:**
- `components/layout/MainLayout.tsx`
- `components/layout/ProtectedRoute.tsx`
- `components/notifications/NotificationBell.tsx`
- `components/ui/*`

### UI Visual
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| GLB-UI-01 | Tema oscuro consistente | ⬜ | Media |
| GLB-UI-02 | Transiciones suaves entre páginas | ⬜ | Baja |
| GLB-UI-03 | Loading states consistentes | ✅ | Alta |
| GLB-UI-04 | Empty states informativos | ✅ | Alta |
| GLB-UI-05 | Error states con acciones claras | ✅ | Alta |
| GLB-UI-06 | Tooltips en iconos de acción | ⬜ | Media |

### UX Flow
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| GLB-UX-01 | Breadcrumbs de navegación | ⬜ | Media |
| GLB-UX-02 | Búsqueda global (Cmd+K) | 🔮 | Baja |
| GLB-UX-03 | Notificaciones con acciones | ⬜ | Media |
| GLB-UX-04 | Shortcuts de teclado documentados | ⬜ | Media |
| GLB-UX-05 | Onboarding para nuevos usuarios | 🔮 | Baja |

### Robustez
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| GLB-RB-01 | Error boundary global | ✅ | Alta |
| GLB-RB-02 | Manejo de sesión expirada | ✅ | Alta |
| GLB-RB-03 | Indicador de modo offline | ✅ | Alta |
| GLB-RB-04 | Confirmación antes de salir con cambios | ✅ | Alta |
| GLB-RB-05 | Retry automático en errores de red | ✅ | Alta |

---

## Optimizaciones de Rendimiento

### General
| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| PERF-01 | Code splitting por ruta | ✅ | Alta |
| PERF-02 | Lazy loading de componentes pesados | ✅ | Alta |
| PERF-03 | Memoización de componentes costosos | ✅ | Media |
| PERF-04 | Virtualización de listas largas | ✅ | Alta |
| PERF-05 | Optimización de re-renders | ✅ | Media |
| PERF-06 | Preload de rutas críticas | ✅ | Media |
| PERF-07 | Service Worker optimizado | ⬜ | Alta |
| PERF-08 | Cache de queries estratégico | ⬜ | Alta |
| PERF-09 | Compresión de imágenes | ⬜ | Media |
| PERF-10 | Bundle size optimization | ⬜ | Alta |

---

## Accesibilidad (A11y)

| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| A11Y-01 | Navegación por teclado completa | ⬜ | Alta |
| A11Y-02 | Labels en todos los inputs | ⬜ | Alta |
| A11Y-03 | Contraste de colores WCAG AA | ⬜ | Alta |
| A11Y-04 | Focus visible en todos los elementos | ✅ | Alta |
| A11Y-05 | Aria labels en iconos | ⬜ | Media |
| A11Y-06 | Anuncios de screen reader | ⬜ | Media |
| A11Y-07 | Soporte de reduced motion | ✅ | Media |
| A11Y-08 | Skip links | ⬜ | Baja |
| A11Y-09 | Roles ARIA correctos | ⬜ | Media |
| A11Y-10 | Textos alternativos en imágenes | ⬜ | Media |

---

## Experiencia Móvil

| ID | Mejora | Estado | Prioridad |
|----|--------|--------|-----------|
| MOB-01 | Touch targets mínimo 44px | ✅ | Alta |
| MOB-02 | Gestos swipe en listas | ⬜ | Media |
| MOB-03 | Bottom navigation para móvil | ⬜ | Media |
| MOB-04 | Pull to refresh | ⬜ | Media |
| MOB-05 | Teclado numérico para campos de precio | ✅ | Alta |
| MOB-06 | Orientación landscape para tablets | ⬜ | Media |
| MOB-07 | PWA install prompt | ✅ | Alta |
| MOB-08 | Splash screen optimizado | ⬜ | Baja |
| MOB-09 | Offline mode UX | ⬜ | Alta |
| MOB-10 | Haptic feedback | 🔮 | Baja |

---

## Issues Identificados

### Alta Prioridad
| ID | Módulo | Descripción | Estado | Fecha |
|----|--------|-------------|--------|-------|
| UI-001 | POS | Falta validación de stock antes de agregar al carrito | ✅ Resuelto | 2026-01-15 |
| UI-002 | Ventas | No hay función de reimprimir ticket | ✅ Resuelto | 2026-01-16 |
| UI-003 | Ventas | Falta función de devolución parcial | ✅ Cerrado | 2026-01-17 |
| UI-004 | Caja | Falta calculadora de denominaciones | ✅ Cerrado | 2026-01-17 |
| UI-005 | Global | No hay error boundary global | ✅ Resuelto | 2026-01-15 |

### Media Prioridad
| ID | Módulo | Descripción | Estado | Fecha |
|----|--------|-------------|--------|-------|
| UI-006 | Productos | Falta vista de cards para móvil | ✅ Cerrado | 2026-01-17 |
| UI-007 | Dashboard | Gráficos interactivos de ventas | ✅ Cerrado | 2026-01-17 |
| UI-008 | Inventario | Virtualización de lista de movimientos | ⬜ Pendiente | 2026-01-15 |

---

## Changelog

| Fecha | Módulo | Cambio | Autor |
|-------|--------|--------|-------|
| 2026-01-15 | ALL | Documento inicial de optimización UI/UX creado | Claude |
| 2026-01-15 | POS | Scanner de código de barras implementado | Claude |
| 2026-01-15 | POS | Confirmación antes de limpiar carrito | Codex |
| 2026-01-15 | Global | Error boundary global y fallback con acciones | Codex |
| 2026-01-15 | POS | Validación de stock antes de agregar al carrito | Claude |
| 2026-01-15 | POS | Recuperación de carrito con persist (ya implementado) | Claude |
| 2026-01-15 | POS | Animación al agregar producto al carrito | Codex |
| 2026-01-15 | POS | Destacar productos con stock bajo en resultados | Codex |
| 2026-01-15 | POS | Iconos de categoría en lista de productos | Codex |
| 2026-01-15 | POS | Badge de cantidad en carrito con animación | Codex |
| 2026-01-15 | POS | Indicadores de precios por peso | Codex |
| 2026-01-15 | POS | Historial de últimos productos vendidos | Codex |
| 2026-01-15 | POS | Atajos de teclado visibles en UI | Codex |
| 2026-01-15 | POS | Autocompletado inteligente en búsqueda | Codex |
| 2026-01-15 | POS | Sugerencias de productos complementarios | Codex |
| 2026-01-15 | POS | Confirmación rápida con Enter en checkout | Codex |
| 2026-01-15 | POS | Sonido de confirmación al escanear | Codex |
| 2026-01-15 | POS | Manejo de productos inactivos en carrito | Codex |
| 2026-01-15 | POS | Timeout y retry en búsqueda de productos | Codex |
| 2026-01-15 | POS | Validación de cantidad máxima por producto | Codex |
| 2026-01-15 | POS | Virtualización de lista de productos | Codex |
| 2026-01-15 | POS | Precarga de productos frecuentes | Codex |
| 2026-01-15 | POS | Cache de búsquedas recientes | Codex |
| 2026-01-16 | Ventas | Verificación: reimprimir ticket ya implementado | Codex |
| 2026-01-16 | Ventas | Verificación: anular venta con confirmación ya implementado | Codex |
| 2026-01-16 | Ventas | Verificación: paginación server-side ya implementado | Codex |
| 2026-01-16 | Global | Verificación: retry automático en QueryClient | Codex |
| 2026-01-16 | Clientes | Límite de crédito configurable (BE+FE) | Codex |
| 2026-01-16 | Clientes | Historial de compras del cliente | Codex |
| 2026-01-16 | Clientes | Avatar/iniciales + badge de crédito | Codex |
| 2026-01-16 | Clientes | Verificación crédito disponible en POS | Codex |
| 2026-01-16 | Productos | Verificación: badges estado, paginación, cache offline | Codex |
| 2026-01-16 | Dashboard | Verificación: KPIs tendencia, filtros fecha, cache | Codex |
| 2026-01-16 | Caja | Verificación: métricas, sesiones, auditoría | Codex |
| 2026-01-17 | Dashboard | Gráficos interactivos de ventas con Recharts | Codex |
| 2026-01-17 | Dashboard | Exportar reportes a PDF (vista de impresión) | Codex |
| 2026-01-17 | Productos | Vista de cards responsive para móvil | Codex |
| 2026-01-17 | Ventas | Devolución parcial de productos | Codex |
| 2026-01-17 | Caja | Calculadora de denominaciones integrada | Codex |
| 2026-01-17 | Performance | Code splitting y lazy loading de rutas (React.lazy) | Codex |
| 2026-01-17 | Clientes | Crear cliente rápido desde POS checkout | Codex |
| 2026-01-17 | PWA | Install prompt para instalación de app | Codex |
| 2026-01-17 | Móvil | Teclado numérico (inputMode=decimal) para precios | Codex |
| 2026-01-17 | Inventario | Confirmación de ajustes grandes (AlertDialog) | Codex |
| 2026-01-17 | Dashboard | Exportar reportes a Excel (CSV) | Codex |
| 2026-01-17 | Lotes | Alerta de productos próximos a vencer | Codex |
| 2026-01-17 | Proveedores | Indicador de órdenes pendientes | Codex |
| 2026-01-17 | Fiscal | Validación de RIF venezolano con algoritmo SENIAT | Codex |
| 2026-01-17 | Fiscal | Formato profesional de factura para imprimir | Codex |
| 2026-01-17 | Descuentos | Validación de % máximo por rol (30% cajero, 100% owner) | Codex |
| 2026-01-17 | Bodegas | Verificación de stock antes de eliminar | Codex |
| 2026-01-17 | Global | Componente EmptyState reutilizable | Codex |
| 2026-01-17 | Global | Componente PageLoader para loading states consistentes | Codex |
| 2026-01-17 | Global | Hook useUnsavedChanges para detectar cambios sin guardar | Codex |
| 2026-01-17 | Clientes | Confirmación antes de eliminar cliente con verificación de deuda | Codex |
| 2026-01-17 | Ventas | Exportar ventas a Excel (CSV) | Codex |
| 2026-01-17 | Mobile | Touch targets mínimo 44px en botones de acción | Codex |
| 2026-01-17 | A11y | Focus visible en todos los elementos (:focus-visible) | Codex |
| 2026-01-17 | A11y | Soporte de prefers-reduced-motion | Codex |
| 2026-01-17 | Productos | Exportar productos a Excel (CSV) | Codex |
| 2026-01-17 | Performance | Preload de rutas críticas (POS, Sales, Dashboard) | Codex |

---

## Métricas de Progreso

### Resumen por Módulo

| Módulo | Total Items | Completados | % Progreso |
|--------|-------------|-------------|------------|
| POS | 35 | 25 | 71% |
| Productos | 31 | 18 | 58% |
| Inventario | 22 | 5 | 23% |
| Ventas | 22 | 16 | 73% |
| Caja/Turnos | 22 | 12 | 55% |
| Clientes/Deudas | 24 | 19 | 79% |
| Proveedores | 18 | 1 | 6% |
| Descuentos | 13 | 1 | 8% |
| Lotes/Seriales | 14 | 5 | 36% |
| Bodegas | 13 | 1 | 8% |
| Dashboard | 17 | 12 | 71% |
| Fiscal | 13 | 2 | 15% |
| ML | 11 | 0 | 0% |
| Realtime | 11 | 0 | 0% |
| Mesas | 12 | 0 | 0% |
| Periféricos | 10 | 0 | 0% |
| Global | 16 | 7 | 44% |
| Performance | 10 | 6 | 60% |
| A11y | 10 | 2 | 20% |
| Mobile | 10 | 3 | 30% |
| **TOTAL** | **334** | **127** | **38%** |

---

## Instrucciones de Uso

1. **Revisar módulo**: Evaluar cada item del checklist
2. **Marcar estado**:
   - ⬜ Pendiente
   - 🔄 En progreso
   - ✅ Completado
   - ❌ Con problemas
   - 🔮 Nice-to-have (futuro)
3. **Documentar issues**: Agregar a tabla de issues si hay problemas
4. **Actualizar changelog**: Registrar cada cambio realizado
5. **Actualizar métricas**: Recalcular progreso después de cambios

---

**Última actualización:** 2026-01-17
**Próxima revisión programada:** Semanal
