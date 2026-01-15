# LA-CAJA - Plan Maestro de Auditoría y Robustez
## Sistema POS Administrativo Offline-First para Venezuela

**Versión:** 2.0
**Fecha:** Enero 2026
**Rol:** Arquitecto Senior - Sistemas POS Offline
**Objetivo:** Dejar cada módulo 100% operativo y robusto

---

# ÍNDICE

1. [Resumen del Sistema](#resumen-del-sistema)
2. [Metodología de Auditoría](#metodología-de-auditoría)
3. [FASE 1: Módulos CORE](#fase-1-módulos-core)
4. [FASE 2: Módulos FINANCIEROS](#fase-2-módulos-financieros)
5. [FASE 3: Módulos AUXILIARES](#fase-3-módulos-auxiliares)
6. [FASE 4: Módulos COMERCIALES](#fase-4-módulos-comerciales)
7. [FASE 5: Módulos FISCALES](#fase-5-módulos-fiscales)
8. [FASE 6: Seguridad y Auth](#fase-6-seguridad-y-auth)
9. [FASE 7: Analytics y ML](#fase-7-analytics-y-ml)
10. [FASE 8: Sincronización Offline](#fase-8-sincronización-offline)
11. [Registro de Issues](#registro-de-issues)
12. [Changelog](#changelog)

---

# RESUMEN DEL SISTEMA

| Componente | Cantidad | Tecnología |
|------------|----------|------------|
| Módulos API | 41 | NestJS + TypeORM |
| Entidades BD | 79 | PostgreSQL |
| Migraciones | 54 | SQL |
| Páginas PWA | 38 | React + Vite |
| Páginas Desktop | 9 | React + Tauri |
| Paquetes Compartidos | 3 | TypeScript |

---

# METODOLOGÍA DE AUDITORÍA

## Por cada módulo se verificará:

### 1. BACKEND (BE)
- [ ] Entidad/Modelo correctamente definido
- [ ] DTOs con validaciones completas
- [ ] Service con lógica de negocio correcta
- [ ] Controller con endpoints RESTful
- [ ] Manejo de errores apropiado
- [ ] Transacciones donde corresponda
- [ ] Índices de BD optimizados
- [ ] Logs de auditoría

### 2. FRONTEND (FE)
- [ ] Página/Vista implementada
- [ ] Formularios con validación
- [ ] Estados de carga (loading, error, empty)
- [ ] Responsive design
- [ ] Accesibilidad básica
- [ ] Manejo de errores de API

### 3. INTEGRACIÓN (INT)
- [ ] Tipos compartidos BE ↔ FE
- [ ] API calls correctos
- [ ] Sincronización offline (si aplica)
- [ ] Permisos/Roles verificados

### 4. TESTING (TEST)
- [ ] Tests unitarios service
- [ ] Tests de integración API
- [ ] Tests E2E críticos

---

# FASE 1: MÓDULOS CORE

## 1.1 PRODUCTS - Catálogo de Productos

### Archivos
```
Backend:
├── apps/api/src/products/products.module.ts
├── apps/api/src/products/products.controller.ts
├── apps/api/src/products/products.service.ts
├── apps/api/src/products/dto/create-product.dto.ts
├── apps/api/src/products/dto/update-product.dto.ts
├── apps/api/src/products/dto/search-products.dto.ts
└── apps/api/src/database/entities/product.entity.ts

Frontend PWA:
├── apps/pwa/src/pages/ProductsPage.tsx
├── apps/pwa/src/components/products/ProductFormModal.tsx
└── apps/pwa/src/services/products.service.ts

Frontend Desktop:
├── apps/desktop/src/pages/ProductsPage.tsx
├── apps/desktop/src/components/products/ProductFormModal.tsx
└── apps/desktop/src/services/products.service.ts
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| P-BE-01 | Entidad Product con todos los campos | ✅ | Completo. created_at/updated_at OK |
| P-BE-02 | CreateProductDto validaciones | ✅ | class-validator + Transform OK |
| P-BE-03 | UpdateProductDto validaciones | ✅ | Todos campos opcionales OK |
| P-BE-04 | SearchProductsDto paginación | ✅ | limit, offset, search, category, is_active |
| P-BE-05 | CRUD completo en service | ✅ | create, findAll, findOne, update, deactivate, activate |
| P-BE-06 | Búsqueda por nombre/SKU/barcode | ✅ | ILIKE search implementado |
| P-BE-07 | Filtro por categoría | ✅ | Filtro exacto OK |
| P-BE-08 | Filtro por is_active | ✅ | Filtro booleano OK |
| P-BE-09 | Soft delete implementado | ✅ | Usa is_active=false |
| P-BE-10 | Índices optimizados | ✅ | 7 índices incluyendo parciales |
| P-BE-11 | Manejo de duplicados (barcode) | ✅ | Constraint DB + validación en service |
| P-BE-12 | Conversión moneda automática | ✅ | ExchangeService.getBCVRate() con fallback |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| P-FE-01 | Listado con paginación | ✅ | 50 productos/página, navegación OK |
| P-FE-02 | Búsqueda funcional | ✅ | Búsqueda inmediata + reset página |
| P-FE-03 | Filtros (categoría, activo) | ✅ | Categoría + estado + bodega |
| P-FE-04 | Modal crear producto | ✅ | ProductFormModal completo |
| P-FE-05 | Modal editar producto | ✅ | Reutiliza ProductFormModal |
| P-FE-06 | Validación de formulario | ✅ | Zod + react-hook-form |
| P-FE-07 | Estados loading/error/empty | ✅ | 3 estados visuales OK |
| P-FE-08 | Responsive mobile | ✅ | Grid adaptativo, touch-manipulation |
| P-FE-09 | Productos por peso UI | ✅ | Sección completa con conversión de unidades |
| P-FE-10 | Preview de margen ganancia | ✅ | Preview utilidad/margen USD |

### Checklist Frontend Desktop
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| P-DE-01 | Paridad con PWA | ❌ | Faltan CSV, duplicados, variantes/lotes/seriales, stock por bodega |
| P-DE-02 | Funcionamiento offline | ❌ | Sin cache local/offline-first |
| P-DE-03 | Sincronización al reconectar | ❌ | Sin cola offline/sync |

---

## 1.2 INVENTORY - Gestión de Inventario

### Archivos
```
Backend:
├── apps/api/src/inventory/inventory.module.ts
├── apps/api/src/inventory/inventory.controller.ts
├── apps/api/src/inventory/inventory.service.ts
└── apps/api/src/database/entities/inventory-movement.entity.ts

Frontend PWA:
├── apps/pwa/src/pages/InventoryPage.tsx
├── apps/pwa/src/components/inventory/StockReceivedModal.tsx
├── apps/pwa/src/components/inventory/StockAdjustmentModal.tsx
└── apps/pwa/src/services/inventory.service.ts

Frontend Desktop:
├── apps/desktop/src/pages/InventoryPage.tsx
├── apps/desktop/src/components/inventory/StockReceivedModal.tsx
└── apps/desktop/src/services/inventory.service.ts
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| I-BE-01 | Entidad InventoryMovement | ✅ | Incluye warehouse_id y aprobación |
| I-BE-02 | Tipos de movimiento (IN/OUT/ADJ) | ✅ | received/adjust/sold |
| I-BE-03 | Recepción de stock | ✅ | Crea movimiento + actualiza stock |
| I-BE-04 | Ajuste de inventario | ✅ | Ajustes con razón y validación |
| I-BE-05 | Descuento automático en venta | ✅ | Descuento en SalesService |
| I-BE-06 | Stock por bodega | ✅ | warehouse_stock + filtro por bodega |
| I-BE-07 | Alertas stock bajo | ✅ | Notificación al cruzar umbral |
| I-BE-08 | Historial de movimientos | ✅ | getMovements |
| I-BE-09 | Validar stock no negativo | ✅ | Validación en ajustes/ventas |
| I-BE-10 | Costos promedio ponderado | ✅ | Promedio en recepción de stock |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| I-FE-01 | Vista de stock actual | ✅ | Listado, low stock, bodega |
| I-FE-02 | Modal recibir stock | ✅ | StockReceivedModal |
| I-FE-03 | Modal ajustar stock | ✅ | StockAdjustModal |
| I-FE-04 | Historial movimientos | ✅ | MovementsModal |
| I-FE-05 | Filtros por producto/fecha | ✅ | Filtro fecha en movimientos |
| I-FE-06 | Indicador stock bajo | ✅ | Badge + toggle low stock |
| I-FE-07 | Exportar a Excel | ✅ | Export CSV compatible con Excel |

### Checklist Frontend Desktop
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| I-DE-01 | Paridad con PWA | ⬜ | |
| I-DE-02 | Funcionamiento offline | ⬜ | |

---

## 1.3 SALES - Procesamiento de Ventas

### Archivos
```
Backend:
├── apps/api/src/sales/sales.module.ts
├── apps/api/src/sales/sales.controller.ts
├── apps/api/src/sales/sales.service.ts
├── apps/api/src/sales/dto/create-sale.dto.ts
├── apps/api/src/sales/dto/cart-item.dto.ts
├── apps/api/src/database/entities/sale.entity.ts
└── apps/api/src/database/entities/sale-item.entity.ts

Frontend PWA:
├── apps/pwa/src/pages/POSPage.tsx
├── apps/pwa/src/pages/SalesPage.tsx
├── apps/pwa/src/components/pos/CheckoutModal.tsx
└── apps/pwa/src/services/sales.service.ts

Frontend Desktop:
├── apps/desktop/src/pages/POSPage.tsx
├── apps/desktop/src/pages/SalesPage.tsx
└── apps/desktop/src/services/sales.service.ts
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| S-BE-01 | Entidad Sale completa | ✅ | JSON payment + facturación OK |
| S-BE-02 | Entidad SaleItem completa | ✅ | Peso/lotes/variantes OK |
| S-BE-03 | Crear venta con items | ✅ | Transacción + validaciones OK |
| S-BE-04 | Múltiples métodos de pago | ✅ | Split + split_payments aceptado |
| S-BE-05 | Cálculo de totales correcto | ✅ | Subtotal bruto + descuento neto |
| S-BE-06 | Descuento inventario automático | ✅ | Movimiento sold + updateStock |
| S-BE-07 | Anulación de venta | ✅ | voidSale con reversa stock |
| S-BE-08 | Devoluciones | ✅ | Devoluciones parciales + endpoint `/sales/:id/return` |
| S-BE-09 | Transacción atómica | ✅ | dataSource.transaction |
| S-BE-10 | Número de venta secuencial | ✅ | sale_number por tienda |
| S-BE-11 | Asociar a cliente (opcional) | ✅ | Create/Update customer |
| S-BE-12 | Asociar a cajero | ✅ | sold_by_user_id |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| S-FE-01 | POS - Búsqueda productos | ✅ | Search + barcode scanner |
| S-FE-02 | POS - Carrito de compra | ✅ | Cart store + UI |
| S-FE-03 | POS - Modificar cantidades | ✅ | +/- qty |
| S-FE-04 | POS - Eliminar items | ✅ | Remove item |
| S-FE-05 | POS - Aplicar descuentos | ✅ | UI descuento por item |
| S-FE-06 | POS - Modal checkout | ✅ | CheckoutModal |
| S-FE-07 | POS - Múltiples pagos | ✅ | SplitPaymentManager |
| S-FE-08 | POS - Calcular cambio | ✅ | Cambio/redondeo |
| S-FE-09 | POS - Imprimir recibo | ✅ | printService |
| S-FE-10 | Historial - Listado ventas | ✅ | SalesPage filtros |
| S-FE-11 | Historial - Detalle venta | ✅ | SaleDetailModal |
| S-FE-12 | Historial - Anular venta | ✅ | Anulación desde detalle |

### Checklist Frontend Desktop
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| S-DE-01 | Paridad con PWA | ⬜ | |
| S-DE-02 | Modo offline completo | ⬜ | |
| S-DE-03 | Cola de ventas offline | ⬜ | |
| S-DE-04 | Impresora térmica | ⬜ | |

---

# FASE 2: MÓDULOS FINANCIEROS

## 2.1 CASH - Sesiones de Caja

### Archivos
```
Backend:
├── apps/api/src/cash/cash.module.ts
├── apps/api/src/cash/cash.controller.ts
├── apps/api/src/cash/cash.service.ts
└── apps/api/src/database/entities/cash-session.entity.ts

Frontend:
├── apps/pwa/src/pages/CashPage.tsx
└── apps/pwa/src/services/cash.service.ts
```

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| C-BE-01 | Abrir sesión de caja | ✅ | Endpoint + validación de sesión abierta |
| C-BE-02 | Cerrar sesión con cuadre | ✅ | Cálculo esperado vs contado |
| C-BE-03 | Monto inicial | ✅ | opening_amount_bs/usd |
| C-BE-04 | Monto final esperado vs real | ✅ | Incluye ventas + movimientos |
| C-BE-05 | Diferencia (faltante/sobrante) | ✅ | expected/counted en sesión |
| C-BE-06 | Una sesión activa por usuario | ✅ | Validación por usuario en apertura/venta |
| C-FE-01 | UI abrir caja | ✅ | OpenCashModal |
| C-FE-02 | UI cerrar caja | ✅ | CloseCashModal |
| C-FE-03 | Resumen de movimientos | ✅ | Resumen de movimientos por sesión |
| C-FE-04 | Historial de sesiones | ✅ | CashSessionsList + detalle |

---

## 2.2 PAYMENTS - Métodos de Pago

### Archivos
```
Backend:
├── apps/api/src/payments/payments.module.ts
├── apps/api/src/payments/payments.controller.ts
├── apps/api/src/payments/payment-method-configs.service.ts
├── apps/api/src/payments/payment-rules.service.ts
├── apps/api/src/payments/cash-movements.service.ts
└── apps/api/src/database/entities/payment-method-config.entity.ts

Frontend:
├── apps/pwa/src/pages/PaymentsPage.tsx
└── apps/pwa/src/services/payments.service.ts
```

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| PM-BE-01 | CRUD métodos de pago | ✅ | upsert/list/get/delete |
| PM-BE-02 | Activar/desactivar método | ✅ | Campo `enabled` |
| PM-BE-03 | Orden de visualización | ✅ | sort_order + orden en UI |
| PM-BE-04 | Comisiones por método | ✅ | commission_percentage configurable |
| PM-BE-05 | Reglas (mínimo, máximo) | ✅ | PaymentRulesService |
| PM-BE-06 | Movimientos de caja | ✅ | CashMovementsService + endpoints |
| PM-FE-01 | Listado métodos | ✅ | PaymentMethodsList |
| PM-FE-02 | Configurar método | ✅ | PaymentMethodConfigModal |
| PM-FE-03 | Reordenar métodos | ✅ | Controles mover arriba/abajo |

---

## 2.3 DEBTS - Créditos/Fiados

### Archivos
```
Backend:
├── apps/api/src/debts/debts.module.ts
├── apps/api/src/debts/debts.controller.ts
├── apps/api/src/debts/debts.service.ts
├── apps/api/src/database/entities/debt.entity.ts
└── apps/api/src/database/entities/debt-payment.entity.ts

Frontend:
├── apps/pwa/src/pages/DebtsPage.tsx
└── apps/pwa/src/services/debts.service.ts
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| D-BE-01 | Crear deuda desde venta | ✅ | createDebtFromSale + integración automática en SalesService (FIAO) |
| D-BE-02 | Asociar a cliente | ✅ | customer_id en Debt entity + validación |
| D-BE-03 | Registrar abono | ✅ | addPayment con transacción + validaciones |
| D-BE-04 | Calcular saldo pendiente | ✅ | getDebtSummary calcula remaining_bs/usd |
| D-BE-05 | Marcar como pagada | ✅ | Actualización automática de status (OPEN→PARTIAL→PAID) |
| D-BE-06 | Historial de abonos | ✅ | payments relación en Debt + getDebtsByCustomer |
| D-BE-07 | DTO con validaciones | ✅ | CreateDebtPaymentDto con class-validator |
| D-BE-08 | Transacciones atómicas | ✅ | addPayment usa dataSource.transaction |
| D-BE-09 | Índices optimizados | ✅ | idx_debts_store_customer, idx_debts_store_status, idx_debt_payments_debt |
| D-BE-10 | Conversión moneda automática | ✅ | Usa ExchangeService.getBCVRate() para calcular amount_bs |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| D-FE-01 | Listado deudas pendientes | ⬜ | |
| D-FE-02 | Detalle de deuda | ⬜ | |
| D-FE-03 | Registrar pago/abono | ⬜ | |
| D-FE-04 | Filtrar por cliente | ⬜ | |

---

## 2.4 EXCHANGE - Tasa de Cambio

### Archivos
```
Backend:
├── apps/api/src/exchange/exchange.module.ts
├── apps/api/src/exchange/exchange.controller.ts
├── apps/api/src/exchange/exchange.service.ts
└── apps/api/src/database/entities/exchange-rate.entity.ts

Frontend:
└── apps/pwa/src/services/exchange.service.ts
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| E-BE-01 | Obtener tasa BCV automática | ✅ | fetchFromBCVAPI() desde DolarAPI + fallback |
| E-BE-02 | Cache de tasa (TTL) | ✅ | Cache en memoria con CACHE_DURATION_MS (1 hora) |
| E-BE-03 | Tasa manual como fallback | ✅ | setManualRate + getActiveManualRate + getLastManualRate |
| E-BE-04 | Historial de tasas | ✅ | getRateHistory con paginación y filtro por tipo |
| E-BE-05 | Conversión USD ↔ Bs | ✅ | Funciones usdToBs() y bsToUsd() con redondeo |
| E-BE-06 | Sistema multi-tasa | ✅ | Soporte BCV, PARALLEL, CASH, ZELLE |
| E-BE-07 | Configuración por tienda | ✅ | StoreRateConfig con mapeo método de pago → tipo tasa |
| E-BE-08 | Tasa preferida | ✅ | is_preferred para priorizar tasas |
| E-BE-09 | Vigencia de tasas | ✅ | effective_from y effective_until |
| E-BE-10 | Guardar tasa API en BD | ✅ | saveApiRate guarda tasas obtenidas de API |
| E-BE-11 | Índices optimizados | ✅ | 3 índices parciales en ExchangeRate |
| E-BE-12 | DTOs con validaciones | ✅ | SetManualRateDto, UpdateRateConfigDto, SetMultipleRatesDto |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| E-FE-01 | Mostrar tasa actual | ⬜ | |
| E-FE-02 | Indicador de última actualización | ⬜ | |

---

# FASE 3: MÓDULOS AUXILIARES

## 3.1 CUSTOMERS - Clientes

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| CU-BE-01 | CRUD clientes | ⬜ | |
| CU-BE-02 | Documento (cédula/RIF) | ⬜ | |
| CU-BE-03 | Teléfono/Email | ⬜ | |
| CU-BE-04 | Límite de crédito | ⬜ | |
| CU-BE-05 | Historial de compras | ⬜ | |
| CU-FE-01 | Listado clientes | ⬜ | |
| CU-FE-02 | Formulario cliente | ⬜ | |
| CU-FE-03 | Búsqueda por documento | ⬜ | |

---

## 3.2 SUPPLIERS - Proveedores

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| SU-BE-01 | CRUD proveedores | ⬜ | |
| SU-BE-02 | RIF proveedor | ⬜ | |
| SU-BE-03 | Contacto | ⬜ | |
| SU-BE-04 | Lista de precios asociada | ⬜ | |
| SU-FE-01 | Listado proveedores | ⬜ | |
| SU-FE-02 | Formulario proveedor | ⬜ | |

---

## 3.3 WAREHOUSES - Bodegas

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| W-BE-01 | CRUD bodegas | ⬜ | |
| W-BE-02 | Bodega por defecto | ⬜ | |
| W-BE-03 | Stock por bodega | ⬜ | |
| W-BE-04 | Activar/desactivar | ⬜ | |
| W-FE-01 | Listado bodegas | ⬜ | |
| W-FE-02 | Configurar bodega | ⬜ | |

---

## 3.4 TRANSFERS - Transferencias

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| T-BE-01 | Crear transferencia | ⬜ | |
| T-BE-02 | Bodega origen/destino | ⬜ | |
| T-BE-03 | Items a transferir | ⬜ | |
| T-BE-04 | Estados (pendiente, completada) | ⬜ | |
| T-BE-05 | Validar stock suficiente | ⬜ | |
| T-FE-01 | Crear transferencia | ⬜ | |
| T-FE-02 | Listado transferencias | ⬜ | |
| T-FE-03 | Confirmar recepción | ⬜ | |

---

# FASE 4: MÓDULOS COMERCIALES

## 4.1 PROMOTIONS - Promociones

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| PR-BE-01 | CRUD promociones | ⬜ | |
| PR-BE-02 | Fecha inicio/fin | ⬜ | |
| PR-BE-03 | Tipo (%, monto, NxM) | ⬜ | |
| PR-BE-04 | Productos aplicables | ⬜ | |
| PR-BE-05 | Validar vigencia | ⬜ | |
| PR-BE-06 | Aplicar en venta | ⬜ | |
| PR-FE-01 | Listado promociones | ⬜ | |
| PR-FE-02 | Crear/editar promoción | ⬜ | |

---

## 4.2 DISCOUNTS - Descuentos

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| DI-BE-01 | Descuento por porcentaje | ⬜ | |
| DI-BE-02 | Descuento monto fijo | ⬜ | |
| DI-BE-03 | Autorización requerida | ⬜ | |
| DI-BE-04 | Límite máximo descuento | ⬜ | |
| DI-BE-05 | Registro de autorizaciones | ⬜ | |
| DI-FE-01 | Aplicar descuento en POS | ⬜ | |
| DI-FE-02 | Modal autorización | ⬜ | |

---

## 4.3 PRICE-LISTS - Listas de Precios

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| PL-BE-01 | CRUD listas de precio | ⬜ | |
| PL-BE-02 | Productos en lista | ⬜ | |
| PL-BE-03 | Precio especial por producto | ⬜ | |
| PL-BE-04 | Asignar a cliente | ⬜ | |
| PL-FE-01 | Gestionar listas | ⬜ | |
| PL-FE-02 | Asignar productos | ⬜ | |

---

# FASE 5: MÓDULOS FISCALES

## 5.1 FISCAL-INVOICES - Facturación Fiscal

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| FI-BE-01 | Generar factura fiscal | ⬜ | |
| FI-BE-02 | Número correlativo | ⬜ | |
| FI-BE-03 | Datos cliente (RIF) | ⬜ | |
| FI-BE-04 | Cálculo IVA | ⬜ | |
| FI-BE-05 | Nota de crédito | ⬜ | |
| FI-BE-06 | Formato SENIAT | ⬜ | |
| FI-FE-01 | Emitir factura desde venta | ⬜ | |
| FI-FE-02 | Listado facturas | ⬜ | |
| FI-FE-03 | Imprimir/PDF | ⬜ | |

---

## 5.2 FISCAL-CONFIGS - Configuración Fiscal

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| FC-BE-01 | RIF empresa | ⬜ | |
| FC-BE-02 | Razón social | ⬜ | |
| FC-BE-03 | Dirección fiscal | ⬜ | |
| FC-BE-04 | Tasa IVA | ⬜ | |
| FC-BE-05 | Series de facturación | ⬜ | |
| FC-FE-01 | Formulario configuración | ⬜ | |

---

# FASE 6: SEGURIDAD Y AUTH

## 6.1 AUTH - Autenticación

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| AU-BE-01 | Login con email/password | ⬜ | |
| AU-BE-02 | JWT access token | ⬜ | |
| AU-BE-03 | Refresh token | ⬜ | |
| AU-BE-04 | Logout (invalidar token) | ⬜ | |
| AU-BE-05 | Hash de password (bcrypt) | ⬜ | |
| AU-BE-06 | Rate limiting login | ⬜ | |
| AU-FE-01 | Formulario login | ⬜ | |
| AU-FE-02 | Persistir sesión | ⬜ | |
| AU-FE-03 | Auto-refresh token | ⬜ | |

---

## 6.2 ROLES - Control de Acceso

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| RO-BE-01 | Roles definidos (owner, manager, cashier) | ⬜ | |
| RO-BE-02 | Guard de roles | ⬜ | |
| RO-BE-03 | Permisos por endpoint | ⬜ | |
| RO-FE-01 | Ocultar opciones sin permiso | ⬜ | |
| RO-FE-02 | Redirect si no autorizado | ⬜ | |

---

## 6.3 LICENSES - Licenciamiento

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| LI-BE-01 | Validar licencia activa | ⬜ | |
| LI-BE-02 | Fecha expiración | ⬜ | |
| LI-BE-03 | Modo offline con licencia | ⬜ | |
| LI-BE-04 | Límites por plan | ⬜ | |
| LI-FE-01 | Pantalla licencia expirada | ⬜ | |
| LI-FE-02 | Advertencia próxima expiración | ⬜ | |

---

# FASE 7: ANALYTICS Y ML

## 7.1 DASHBOARD - Panel Principal

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| DA-BE-01 | KPIs ventas del día | ⬜ | |
| DA-BE-02 | Productos más vendidos | ⬜ | |
| DA-BE-03 | Comparativo período anterior | ⬜ | |
| DA-FE-01 | Cards de KPIs | ⬜ | |
| DA-FE-02 | Gráfico de ventas | ⬜ | |
| DA-FE-03 | Alertas activas | ⬜ | |

---

## 7.2 REPORTS - Reportes

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| RE-BE-01 | Reporte ventas por período | ⬜ | |
| RE-BE-02 | Reporte inventario valorizado | ⬜ | |
| RE-BE-03 | Reporte productos vendidos | ⬜ | |
| RE-BE-04 | Exportar PDF | ⬜ | |
| RE-BE-05 | Exportar Excel | ⬜ | |
| RE-FE-01 | Selector de reporte | ⬜ | |
| RE-FE-02 | Filtros de fecha | ⬜ | |
| RE-FE-03 | Vista previa | ⬜ | |
| RE-FE-04 | Botón descargar | ⬜ | |

---

## 7.3 ML - Machine Learning

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| ML-BE-01 | Predicción de demanda | ⬜ | |
| ML-BE-02 | Detección de anomalías | ⬜ | |
| ML-BE-03 | Recomendaciones | ⬜ | |
| ML-FE-01 | Dashboard ML | ⬜ | |
| ML-FE-02 | Alertas inteligentes | ⬜ | |

---

# FASE 8: SINCRONIZACIÓN OFFLINE

## 8.1 SYNC - Sistema de Sincronización

### Checklist
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| SY-BE-01 | Endpoint de sync | ⬜ | |
| SY-BE-02 | Recibir eventos offline | ⬜ | |
| SY-BE-03 | Resolver conflictos | ⬜ | |
| SY-BE-04 | Vector clocks | ⬜ | |
| SY-FE-01 | Detectar estado conexión | ⬜ | |
| SY-FE-02 | Cola de eventos offline | ⬜ | |
| SY-FE-03 | Sincronizar al reconectar | ⬜ | |
| SY-FE-04 | Indicador de estado sync | ⬜ | |
| SY-FE-05 | Manejo de conflictos UI | ⬜ | |

---

# REGISTRO DE ISSUES

## Críticos (Bloquean operación)
| ID | Módulo | Descripción | Estado | Fecha |
|----|--------|-------------|--------|-------|
| | | | | |

## Altos (Afectan UX significativamente)
| ID | Módulo | Descripción | Estado | Fecha |
|----|--------|-------------|--------|-------|
| ISS-001 | PRODUCTS/Backend | Barcode único con constraint DB (migration 45) | ✅ Cerrado | 2026-01-14 |
| ISS-002 | PRODUCTS/Desktop | Falta paridad con PWA (CSV, duplicados, variantes/lotes/seriales, stock por bodega) | 🔄 Pendiente | 2026-01-14 |
| ISS-003 | PRODUCTS/Desktop | Sin modo offline ni sincronización | 🔄 Pendiente | 2026-01-14 |
| ISS-012 | SALES/Backend | Totales con doble descuento (subtotal neto + descuento) | ✅ Cerrado | 2026-01-14 |
| ISS-013 | SALES/Integration | split_payments rechazado por API (DTO) | ✅ Cerrado | 2026-01-14 |

## Medios (Mejoras necesarias)
| ID | Módulo | Descripción | Estado | Fecha |
|----|--------|-------------|--------|-------|
| ISS-004 | PRODUCTS/Backend | created_at agregado a Product (migration 44 + entity) | ✅ Cerrado | 2026-01-14 |
| ISS-006 | PRODUCTS/Testing | Sin tests unitarios/integración para Products | 🔄 Pendiente | 2026-01-14 |
| ISS-007 | INVENTORY/Backend | Costos promedio ponderado implementado | ✅ Cerrado | 2026-01-14 |
| ISS-008 | INVENTORY/Backend | Alertas stock bajo con notificación | ✅ Cerrado | 2026-01-14 |
| ISS-009 | INVENTORY/Backend | Fallback bodega activa si no hay default | ✅ Cerrado | 2026-01-14 |
| ISS-010 | INVENTORY/PWA | Falta filtro por fecha en movimientos | ✅ Cerrado | 2026-01-14 |
| ISS-014 | SALES/PWA | POS sin UI para aplicar descuentos | ✅ Cerrado | 2026-01-14 |
| ISS-015 | SALES/PWA | Historial sin acción de anular venta | ✅ Cerrado | 2026-01-14 |
| ISS-016 | SALES/Backend | Falta número de venta secuencial | ✅ Cerrado | 2026-01-14 |
| ISS-017 | SALES/Backend | Devoluciones parciales no implementadas | ✅ Cerrado | 2026-01-14 |
| ISS-018 | SALES/Testing | Sin tests unitarios/integración para Sales | 🔄 Pendiente | 2026-01-14 |
| ISS-019 | CASH/Backend | Resumen de caja no incluía movimientos de efectivo | ✅ Cerrado | 2026-01-14 |
| ISS-020 | CASH/Backend | CASH_USD se sumaba en Bs en resumen por método | ✅ Cerrado | 2026-01-14 |
| ISS-021 | CASH/Backend | Sesión activa por usuario no implementada | ✅ Cerrado | 2026-01-14 |
| ISS-022 | PAYMENTS/Backend | Orden de visualización no configurable (sin sort_order) | ✅ Cerrado | 2026-01-14 |
| ISS-023 | PAYMENTS/Backend | Comisiones por método no implementadas | ✅ Cerrado | 2026-01-14 |
| ISS-024 | PAYMENTS/Backend | requires_authorization no se valida en ventas | ✅ Cerrado | 2026-01-14 |
| ISS-025 | PAYMENTS/PWA | No hay UI para reordenar métodos | ✅ Cerrado | 2026-01-14 |
| ISS-026 | DEBTS/PWA | Sin UI para gestión de deudas (listado, detalle, pagos) | 🔄 Pendiente | 2026-01-14 |
| ISS-027 | EXCHANGE/PWA | Sin UI para mostrar tasa actual e historial | 🔄 Pendiente | 2026-01-14 |

## Bajos (Nice-to-have)
| ID | Módulo | Descripción | Estado | Fecha |
|----|--------|-------------|--------|-------|
| ISS-005 | PRODUCTS/PWA | Preview de margen de ganancia | ✅ Cerrado | 2026-01-14 |
| ISS-011 | INVENTORY/PWA | Exportar inventario a Excel | ✅ Cerrado | 2026-01-14 |

---

# CHANGELOG

| Fecha | Módulo | Cambio | Autor |
|-------|--------|--------|-------|
| 2026-01-14 | AUDIT | Documento inicial creado | Sistema |
| 2026-01-14 | PRODUCTS | Auditoría completa de módulo PRODUCTS (BE/FE-PWA/FE-Desktop) | Claude |
| 2026-01-14 | PRODUCTS | Identificados 5 issues: ISS-001 a ISS-005 | Claude |
| 2026-01-14 | PRODUCTS | Ajustes: validación barcode en service, filtros/error/margen en PWA, actualización issues | Codex |
| 2026-01-14 | PRODUCTS | Migración 45: constraint único por barcode/store | Codex |
| 2026-01-14 | TESTS | Fix mocks DataSource en tests de AppController y ShiftsService | Codex |
| 2026-01-14 | PRODUCTS | ISS-004: Agregado campo created_at a Product entity + migración 44 | Claude |
| 2026-01-14 | INVENTORY | Auditoría de módulo INVENTORY (BE/FE-PWA) | Codex |
| 2026-01-14 | INVENTORY | Ajustes: costos por peso en recepción, labels movimientos, estado error PWA | Codex |
| 2026-01-14 | INVENTORY | Costos promedio ponderado en recepción de stock | Codex |
| 2026-01-14 | INVENTORY | Alertas stock bajo + fallback de bodega por defecto | Codex |
| 2026-01-14 | INVENTORY | PWA: filtro fecha en movimientos + export inventario a Excel (CSV) | Codex |
| 2026-01-14 | SALES | Auditoría módulo SALES (BE/FE-PWA) | Codex |
| 2026-01-14 | SALES | Fix totales con descuentos + split_payments en API | Codex |
| 2026-01-14 | SALES | PWA: estado de error en historial de ventas | Codex |
| 2026-01-14 | SALES | PWA: UI para aplicar descuentos en POS | Codex |
| 2026-01-14 | SALES | PWA: anulación de venta desde historial | Codex |
| 2026-01-14 | SALES | Backend: devoluciones parciales con `sale_returns` | Codex |
| 2026-01-14 | SALES | Backend: numero de venta secuencial por tienda | Codex |
| 2026-01-14 | CASH | Auditoría módulo CASH (BE/FE-PWA) | Codex |
| 2026-01-14 | CASH | Backend: movimientos en efectivo incluidos en cierre | Codex |
| 2026-01-14 | CASH | PWA: resumen movimientos en sesión de caja | Codex |
| 2026-01-14 | CASH | Backend: sesión activa por usuario | Codex |
| 2026-01-14 | PAYMENTS | Auditoría módulo PAYMENTS (BE/FE-PWA) | Codex |
| 2026-01-14 | PAYMENTS | Backend: orden y comisiones en métodos de pago | Codex |
| 2026-01-14 | PAYMENTS | Backend: validación requires_authorization en ventas | Codex |
| 2026-01-14 | PAYMENTS | PWA: reordenar métodos + comisión | Codex |
| 2026-01-14 | DEBTS | Auditoría módulo DEBTS (BE) | Codex |
| 2026-01-14 | DEBTS | Backend: CRUD completo + integración automática con ventas FIAO | Codex |
| 2026-01-14 | EXCHANGE | Auditoría módulo EXCHANGE (BE) | Codex |
| 2026-01-14 | EXCHANGE | Backend: Sistema multi-tasa completo con cache y fallback | Codex |

---

# INSTRUCCIONES DE USO

1. **Auditar módulo**: Revisar cada checkbox del módulo
2. **Marcar estado**:
   - ⬜ Pendiente
   - 🔄 En progreso
   - ✅ Completado
   - ❌ Con problemas
3. **Documentar issues**: Agregar a tabla correspondiente
4. **Actualizar changelog**: Registrar cada cambio realizado

---

**Última actualización:** 2026-01-14
**Próxima revisión programada:** Al completar cada fase
