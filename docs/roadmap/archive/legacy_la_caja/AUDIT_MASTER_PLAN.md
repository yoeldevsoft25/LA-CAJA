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
| P-DE-01 | Paridad con PWA | ✅ | CSV + duplicados + variantes/lotes/seriales + stock por bodega |
| P-DE-02 | Funcionamiento offline | ✅ | Cache local de productos + fallback offline |
| P-DE-03 | Sincronización al reconectar | 🔄 | Falta cola offline/sync para writes |

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
| D-FE-01 | Listado deudas pendientes | ✅ | DebtsPage con vista por cliente y todas las deudas |
| D-FE-02 | Detalle de deuda | ✅ | DebtDetailModal con historial de pagos |
| D-FE-03 | Registrar pago/abono | ✅ | AddPaymentModal con tasa BCV automática |
| D-FE-04 | Filtrar por cliente | ✅ | CustomerDebtCard + búsqueda + filtros por estado |

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
| E-FE-01 | Mostrar tasa actual | ✅ | ExchangeRateIndicator en header con BCV + otras tasas |
| E-FE-02 | Indicador de última actualización | ✅ | Tiempo relativo + estado online/offline + refresh manual |

---

# FASE 3: MÓDULOS AUXILIARES

## 3.1 CUSTOMERS - Clientes

### Archivos
```
Backend:
├── apps/api/src/customers/customers.module.ts
├── apps/api/src/customers/customers.controller.ts
├── apps/api/src/customers/customers.service.ts
├── apps/api/src/customers/dto/create-customer.dto.ts
├── apps/api/src/customers/dto/update-customer.dto.ts
└── apps/api/src/database/entities/customer.entity.ts

Frontend PWA:
├── apps/pwa/src/pages/CustomersPage.tsx
├── apps/pwa/src/components/customers/CustomerFormModal.tsx
└── apps/pwa/src/services/customers.service.ts
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| CU-BE-01 | CRUD clientes | ✅ | create, findAll, findOne, update |
| CU-BE-02 | Documento (cédula/RIF) | ✅ | Campo document_id en entidad |
| CU-BE-03 | Teléfono/Email | ✅ | Campos phone + email agregados |
| CU-BE-04 | Límite de crédito | ✅ | credit_limit + checkCreditAvailable |
| CU-BE-05 | Historial de compras | ✅ | getPurchaseHistory endpoint |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| CU-FE-01 | Listado clientes | ✅ | CustomersPage con tabla/cards responsivo |
| CU-FE-02 | Formulario cliente | ✅ | CustomerFormModal con email y credit_limit |
| CU-FE-03 | Búsqueda por documento | ✅ | Búsqueda ILIKE por nombre/documento/teléfono/email |
| CU-FE-04 | Historial de compras | ✅ | CustomerHistoryModal con estadísticas |
| CU-FE-05 | Credit check visual | ✅ | Badge con límite de crédito en listado |

---

## 3.2 SUPPLIERS - Proveedores

### Archivos
```
Backend:
├── apps/api/src/suppliers/suppliers.module.ts
├── apps/api/src/suppliers/suppliers.controller.ts
├── apps/api/src/suppliers/suppliers.service.ts
├── apps/api/src/suppliers/dto/create-supplier.dto.ts
├── apps/api/src/suppliers/dto/update-supplier.dto.ts
└── apps/api/src/database/entities/supplier.entity.ts

Frontend PWA:
├── apps/pwa/src/pages/SuppliersPage.tsx
├── apps/pwa/src/components/suppliers/SupplierPriceImportModal.tsx
└── apps/pwa/src/services/suppliers.service.ts
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| SU-BE-01 | CRUD proveedores | ✅ | create, findAll, findOne, update, remove |
| SU-BE-02 | RIF proveedor | ✅ | Campo tax_id en entidad |
| SU-BE-03 | Contacto | ✅ | contact_name, email, phone, address |
| SU-BE-04 | Lista de precios asociada | ✅ | SupplierPriceImportModal + supplier_price_lists |
| SU-BE-05 | Estadísticas proveedor | ✅ | getStatistics endpoint |
| SU-BE-06 | Órdenes de compra | ✅ | getPurchaseOrders endpoint |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| SU-FE-01 | Listado proveedores | ✅ | Con búsqueda y filtros, responsive |
| SU-FE-02 | Formulario proveedor | ✅ | Modal crear/editar completo |
| SU-FE-03 | Estadísticas | ✅ | Tab de estadísticas por proveedor |
| SU-FE-04 | Órdenes de compra | ✅ | Tab con historial de órdenes |
| SU-FE-05 | Importar lista CSV | ✅ | SupplierPriceImportModal |

---

## 3.3 WAREHOUSES - Bodegas

### Archivos
```
Backend:
├── apps/api/src/warehouses/warehouses.module.ts
├── apps/api/src/warehouses/warehouses.controller.ts
├── apps/api/src/warehouses/warehouses.service.ts
├── apps/api/src/warehouses/dto/create-warehouse.dto.ts
├── apps/api/src/warehouses/dto/update-warehouse.dto.ts
└── apps/api/src/database/entities/warehouse.entity.ts

Frontend PWA:
├── apps/pwa/src/pages/WarehousesPage.tsx
└── apps/pwa/src/services/warehouses.service.ts
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| W-BE-01 | CRUD bodegas | ✅ | create, getAll, getById, update, delete |
| W-BE-02 | Bodega por defecto | ✅ | getDefault + is_default flag |
| W-BE-03 | Stock por bodega | ✅ | getStock endpoint con warehouse_stock |
| W-BE-04 | Activar/desactivar | ✅ | is_active flag |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| W-FE-01 | Listado bodegas | ✅ | Grid cards con estado y acciones |
| W-FE-02 | Configurar bodega | ✅ | Modal crear/editar con validaciones |
| W-FE-03 | Ver stock | ✅ | Modal con lista de productos por bodega |

---

## 3.4 TRANSFERS - Transferencias

### Archivos
```
Backend:
├── apps/api/src/transfers/transfers.module.ts
├── apps/api/src/transfers/transfers.controller.ts
├── apps/api/src/transfers/transfers.service.ts
├── apps/api/src/transfers/dto/create-transfer.dto.ts
├── apps/api/src/transfers/dto/ship-transfer.dto.ts
├── apps/api/src/transfers/dto/receive-transfer.dto.ts
└── apps/api/src/database/entities/transfer.entity.ts

Frontend PWA:
├── apps/pwa/src/pages/TransfersPage.tsx
└── apps/pwa/src/services/transfers.service.ts
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| T-BE-01 | Crear transferencia | ✅ | create con items |
| T-BE-02 | Bodega origen/destino | ✅ | from_warehouse_id, to_warehouse_id |
| T-BE-03 | Items a transferir | ✅ | TransferItem con quantity, variant, cost |
| T-BE-04 | Estados (pending, in_transit, completed, cancelled) | ✅ | TransferStatus enum completo |
| T-BE-05 | Validar stock suficiente | ✅ | Validación en create y ship |
| T-BE-06 | Ship y Receive | ✅ | Endpoints separados con cantidades |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| T-FE-01 | Crear transferencia | ✅ | Modal con búsqueda de productos |
| T-FE-02 | Listado transferencias | ✅ | Con filtros de estado y bodega |
| T-FE-03 | Confirmar envío | ✅ | Modal Ship con cantidades |
| T-FE-04 | Confirmar recepción | ✅ | Modal Receive con cantidades |
| T-FE-05 | Cancelar transferencia | ✅ | Acción con confirmación |

---

# FASE 4: MÓDULOS COMERCIALES

## 4.1 PROMOTIONS - Promociones

### Archivos
```
Backend:
├── apps/api/src/promotions/promotions.module.ts
├── apps/api/src/promotions/promotions.controller.ts
├── apps/api/src/promotions/promotions.service.ts
├── apps/api/src/promotions/dto/create-promotion.dto.ts
├── apps/api/src/database/entities/promotion.entity.ts
├── apps/api/src/database/entities/promotion-product.entity.ts
└── apps/api/src/database/entities/promotion-usage.entity.ts

Frontend PWA:
├── apps/pwa/src/pages/PromotionsPage.tsx
└── apps/pwa/src/services/promotions.service.ts
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| PR-BE-01 | CRUD promociones | ✅ | createPromotion, getActivePromotions, getPromotionById |
| PR-BE-02 | Fecha inicio/fin | ✅ | valid_from, valid_until con validación |
| PR-BE-03 | Tipo (%, monto, NxM) | ✅ | percentage, fixed_amount, buy_x_get_y, bundle |
| PR-BE-04 | Productos aplicables | ✅ | PromotionProduct + getApplicablePromotions |
| PR-BE-05 | Validar vigencia | ✅ | validatePromotion con límites de uso |
| PR-BE-06 | Aplicar en venta | ✅ | calculatePromotionDiscount + recordPromotionUsage |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| PR-FE-01 | Listado promociones | ✅ | PromotionsPage con grid responsivo |
| PR-FE-02 | Crear/editar promoción | ✅ | Dialog con formulario completo |

---

## 4.2 DISCOUNTS - Descuentos

### Archivos
```
Backend:
├── apps/api/src/discounts/discounts.module.ts
├── apps/api/src/discounts/discounts.controller.ts
├── apps/api/src/discounts/discount-configs.service.ts
├── apps/api/src/discounts/discount-authorizations.service.ts
├── apps/api/src/discounts/discount-rules.service.ts
├── apps/api/src/discounts/dto/create-discount-config.dto.ts
├── apps/api/src/discounts/dto/authorize-discount.dto.ts
├── apps/api/src/database/entities/discount-config.entity.ts
└── apps/api/src/database/entities/discount-authorization.entity.ts

Frontend PWA:
├── apps/pwa/src/pages/DiscountsPage.tsx
├── apps/pwa/src/services/discounts.service.ts
├── apps/pwa/src/components/discounts/DiscountConfigModal.tsx
├── apps/pwa/src/components/discounts/DiscountAuthorizationModal.tsx
├── apps/pwa/src/components/discounts/DiscountAuthorizationsList.tsx
└── apps/pwa/src/components/discounts/DiscountSummary.tsx
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| DI-BE-01 | Descuento por porcentaje | ✅ | max_percentage en config |
| DI-BE-02 | Descuento monto fijo | ✅ | max_amount_bs, max_amount_usd |
| DI-BE-03 | Autorización requerida | ✅ | authorization_role + PIN opcional |
| DI-BE-04 | Límite máximo descuento | ✅ | Validación en discount-rules.service |
| DI-BE-05 | Registro de autorizaciones | ✅ | createAuthorization, getDiscountSummary |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| DI-FE-01 | Aplicar descuento en POS | ✅ | CheckoutModal integrado |
| DI-FE-02 | Modal autorización | ✅ | DiscountAuthorizationModal completo |
| DI-FE-03 | Configuración de límites | ✅ | DiscountConfigModal |
| DI-FE-04 | Historial de autorizaciones | ✅ | DiscountAuthorizationsList + tabs |
| DI-FE-05 | Resumen de descuentos | ✅ | DiscountSummary component |

---

## 4.3 PRICE-LISTS - Listas de Precios

### Archivos
```
Backend:
├── apps/api/src/price-lists/price-lists.module.ts
├── apps/api/src/price-lists/price-lists.controller.ts
├── apps/api/src/price-lists/price-lists.service.ts
├── apps/api/src/price-lists/dto/create-price-list.dto.ts
├── apps/api/src/price-lists/dto/create-price-list-item.dto.ts
├── apps/api/src/database/entities/price-list.entity.ts
└── apps/api/src/database/entities/price-list-item.entity.ts

Frontend PWA:
├── apps/pwa/src/pages/PriceListsPage.tsx
└── apps/pwa/src/services/price-lists.service.ts
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| PL-BE-01 | CRUD listas de precio | ✅ | createPriceList, getPriceListsByStore, getById |
| PL-BE-02 | Productos en lista | ✅ | addPriceListItem con variantes |
| PL-BE-03 | Precio especial por producto | ✅ | getProductPrice con cantidad mínima |
| PL-BE-04 | Lista por defecto | ✅ | is_default + getDefaultPriceList |
| PL-BE-05 | Vigencia de listas | ✅ | valid_from, valid_until |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| PL-FE-01 | Gestionar listas | ✅ | PriceListsPage con CRUD |
| PL-FE-02 | Crear/editar lista | ✅ | Dialog con formulario completo |
| PL-FE-03 | Asignar productos | ✅ | Items en lista con precios

---

# FASE 5: MÓDULOS FISCALES

## 5.1 FISCAL-INVOICES - Facturación Fiscal

### Archivos
```
Backend:
├── apps/api/src/fiscal-invoices/fiscal-invoices.module.ts
├── apps/api/src/fiscal-invoices/fiscal-invoices.controller.ts
├── apps/api/src/fiscal-invoices/fiscal-invoices.service.ts
├── apps/api/src/fiscal-invoices/seniat-integration.service.ts
├── apps/api/src/fiscal-invoices/dto/create-fiscal-invoice.dto.ts
├── apps/api/src/fiscal-invoices/guards/seniat-audit.guard.ts
├── apps/api/src/database/entities/fiscal-invoice.entity.ts
└── apps/api/src/database/entities/fiscal-invoice-item.entity.ts

Frontend PWA:
├── apps/pwa/src/pages/FiscalInvoicesPage.tsx
├── apps/pwa/src/pages/FiscalInvoiceDetailPage.tsx
├── apps/pwa/src/components/fiscal/CreateFiscalInvoiceFromSaleModal.tsx
└── apps/pwa/src/services/fiscal-invoices.service.ts
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| FI-BE-01 | Generar factura fiscal | ✅ | createFromSale transaccional |
| FI-BE-02 | Número correlativo | ✅ | generateInvoiceNumber + InvoiceSeries |
| FI-BE-03 | Datos cliente (RIF) | ✅ | customer_tax_id desde Customer |
| FI-BE-04 | Cálculo IVA | ✅ | tax_rate + tax_amount_bs/usd |
| FI-BE-05 | Nota de crédito | ✅ | createCreditNote |
| FI-BE-06 | Formato SENIAT | ✅ | SeniatIntegrationService |
| FI-BE-07 | Estados de factura | ✅ | draft, issued, cancelled, rejected |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| FI-FE-01 | Emitir factura desde venta | ✅ | CreateFiscalInvoiceFromSaleModal |
| FI-FE-02 | Listado facturas | ✅ | FiscalInvoicesPage con filtros |
| FI-FE-03 | Detalle factura | ✅ | FiscalInvoiceDetailPage |
| FI-FE-04 | Emitir/cancelar | ✅ | Mutations con confirmación |

---

## 5.2 FISCAL-CONFIGS - Configuración Fiscal

### Archivos
```
Backend:
├── apps/api/src/fiscal-configs/fiscal-configs.module.ts
├── apps/api/src/fiscal-configs/fiscal-configs.controller.ts
├── apps/api/src/fiscal-configs/fiscal-configs.service.ts
├── apps/api/src/fiscal-configs/dto/create-fiscal-config.dto.ts
├── apps/api/src/fiscal-configs/dto/update-fiscal-config.dto.ts
└── apps/api/src/database/entities/fiscal-config.entity.ts

Frontend PWA:
├── apps/pwa/src/pages/FiscalConfigPage.tsx
└── apps/pwa/src/services/fiscal-configs.service.ts
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| FC-BE-01 | RIF empresa | ✅ | tax_id field |
| FC-BE-02 | Razón social | ✅ | business_name field |
| FC-BE-03 | Dirección fiscal | ✅ | business_address field |
| FC-BE-04 | Tasa IVA | ✅ | default_tax_rate (16% default) |
| FC-BE-05 | Autorización fiscal | ✅ | fiscal_authorization_* fields |
| FC-BE-06 | Series de facturación | ✅ | InvoiceSeriesService integrado |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| FC-FE-01 | Formulario configuración | ✅ | FiscalConfigPage con React Hook Form |
| FC-FE-02 | Alerta expiración | ✅ | isExpired, isExpiringSoon states |
| FC-FE-03 | Validación Zod | ✅ | fiscalConfigSchema completo |

---

# FASE 6: SEGURIDAD Y AUTH

## 6.1 AUTH - Autenticación

### Archivos
```
Backend:
├── apps/api/src/auth/auth.module.ts
├── apps/api/src/auth/auth.controller.ts
├── apps/api/src/auth/auth.service.ts
├── apps/api/src/auth/strategies/jwt.strategy.ts
├── apps/api/src/auth/guards/jwt-auth.guard.ts
├── apps/api/src/auth/guards/login-rate-limit.guard.ts
├── apps/api/src/auth/guards/license.guard.ts
├── apps/api/src/auth/dto/*.ts
└── apps/api/src/database/entities/refresh-token.entity.ts

Frontend PWA:
├── apps/pwa/src/pages/LoginPage.tsx
├── apps/pwa/src/stores/auth.store.ts
├── apps/pwa/src/services/auth.service.ts
├── apps/pwa/src/lib/api.ts (interceptors)
└── apps/pwa/src/components/layout/ProtectedRoute.tsx
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| AU-BE-01 | Login con PIN | ✅ | login() en auth.service.ts |
| AU-BE-02 | JWT access token | ✅ | 15 min expiry + JwtService |
| AU-BE-03 | Refresh token | ✅ | 30 días + RefreshToken entity |
| AU-BE-04 | Logout (invalidar token) | ✅ | deleteRefreshToken |
| AU-BE-05 | Hash de password (bcrypt) | ✅ | bcrypt.hash/compare |
| AU-BE-06 | Rate limiting login | ✅ | LoginRateLimitGuard |
| AU-BE-07 | License validation | ✅ | LicenseGuard + grace days |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| AU-FE-01 | Formulario login | ✅ | LoginPage con store + cashier select |
| AU-FE-02 | Persistir sesión | ✅ | Zustand persist + localStorage |
| AU-FE-03 | Auto-refresh token | ✅ | Interceptor en api.ts |
| AU-FE-04 | Prefetch post-login | ✅ | prefetchAllData() |
| AU-FE-05 | License blocked page | ✅ | LicenseBlockedPage |

---

## 6.2 ROLES - Control de Acceso

### Archivos
```
Backend:
├── apps/api/src/auth/guards/roles.guard.ts
├── apps/api/src/auth/decorators/roles.decorator.ts
└── apps/api/src/database/entities/store-member.entity.ts

Frontend PWA:
├── apps/pwa/src/lib/permissions.ts
├── apps/pwa/src/components/layout/ProtectedRoute.tsx
└── apps/pwa/src/components/layout/MainLayout.tsx (menu filtering)
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| RO-BE-01 | Roles definidos | ✅ | owner, cashier en StoreMember |
| RO-BE-02 | Guard de roles | ✅ | RolesGuard + @Roles decorator |
| RO-BE-03 | Permisos por endpoint | ✅ | @Roles('owner') en controllers |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| RO-FE-01 | Ocultar opciones sin permiso | ✅ | isRouteAllowed en MainLayout |
| RO-FE-02 | Redirect si no autorizado | ✅ | ProtectedRoute + getDefaultRoute |
| RO-FE-03 | Rutas permitidas por rol | ✅ | CASHIER_ALLOWED_ROUTES

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

### Archivos
```
Backend:
├── apps/api/src/dashboard/dashboard.module.ts
├── apps/api/src/dashboard/dashboard.controller.ts
└── apps/api/src/dashboard/dashboard.service.ts

Frontend PWA:
├── apps/pwa/src/pages/DashboardPage.tsx
└── apps/pwa/src/services/dashboard.service.ts
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| DA-BE-01 | KPIs ventas del día | ✅ | sales.today_count/amount |
| DA-BE-02 | Productos más vendidos | ✅ | top_selling_product en performance |
| DA-BE-03 | Comparativo período anterior | ✅ | growth_percentage |
| DA-BE-04 | KPIs inventario | ✅ | total_products, low_stock, expiring |
| DA-BE-05 | KPIs finanzas | ✅ | debt, collected, pending |
| DA-BE-06 | KPIs fiscal | ✅ | issued_invoices, tax_collected |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| DA-FE-01 | Cards de KPIs | ✅ | KPICard component grid responsivo |
| DA-FE-02 | Tablas de productos | ✅ | Top selling con quantity |
| DA-FE-03 | Filtros de fecha | ✅ | startDate/endDate inputs |
| DA-FE-04 | Loading states | ✅ | Skeleton placeholders |

---

## 7.2 REPORTS - Reportes

### Archivos
```
Backend:
├── apps/api/src/reports/reports.module.ts
├── apps/api/src/reports/reports.controller.ts
└── apps/api/src/reports/reports.service.ts

Frontend PWA:
├── apps/pwa/src/pages/ReportsPage.tsx
└── apps/pwa/src/services/reports.service.ts
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| RE-BE-01 | Reporte ventas por período | ✅ | getSalesReport |
| RE-BE-02 | Reporte inventario valorizado | ✅ | getInventoryReport |
| RE-BE-03 | Reporte productos vendidos | ✅ | getProductsReport |
| RE-BE-04 | Exportar PDF | ✅ | PDF generation |
| RE-BE-05 | Exportar Excel | ✅ | Excel/CSV export |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| RE-FE-01 | Selector de reporte | ✅ | Select component |
| RE-FE-02 | Filtros de fecha | ✅ | Date range picker |
| RE-FE-03 | Vista previa | ✅ | Table preview |
| RE-FE-04 | Botón descargar | ✅ | Download PDF/Excel |

---

## 7.3 ML - Machine Learning

### Archivos
```
Backend:
├── apps/api/src/ml/ml.module.ts
├── apps/api/src/ml/ml.controller.ts
├── apps/api/src/ml/ml.service.ts
├── apps/api/src/ml/anomaly-detection.service.ts
├── apps/api/src/ml/demand-forecasting.service.ts
├── apps/api/src/ml/product-clustering.service.ts
└── apps/api/src/ml/recommendation.service.ts

Frontend PWA:
├── apps/pwa/src/pages/MLDashboardPage.tsx
├── apps/pwa/src/services/ml.service.ts
├── apps/pwa/src/hooks/useAnomalies.ts
├── apps/pwa/src/hooks/useRecommendations.ts
└── apps/pwa/src/components/ml/ProductRecommendations.tsx
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| ML-BE-01 | Predicción de demanda | ✅ | DemandForecastingService |
| ML-BE-02 | Detección de anomalías | ✅ | AnomalyDetectionService |
| ML-BE-03 | Recomendaciones | ✅ | RecommendationService |
| ML-BE-04 | Clustering productos | ✅ | ProductClusteringService |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| ML-FE-01 | Dashboard ML | ✅ | MLDashboardPage completo |
| ML-FE-02 | Alertas inteligentes | ✅ | Anomalías críticas + hooks |
| ML-FE-03 | Recomendaciones UI | ✅ | ProductRecommendations |

---

# FASE 8: SINCRONIZACIÓN OFFLINE

## 8.1 SYNC - Sistema de Sincronización

### Archivos
```
Backend:
├── apps/api/src/sync/sync.module.ts
├── apps/api/src/sync/sync.controller.ts
├── apps/api/src/sync/sync.service.ts
├── apps/api/src/sync/vector-clock.service.ts
├── apps/api/src/sync/crdt.service.ts
├── apps/api/src/sync/conflict-resolution.service.ts
└── apps/api/src/sync/dto/*.ts

Frontend PWA:
├── apps/pwa/src/services/sync.service.ts
├── apps/pwa/src/hooks/use-sync.ts
├── apps/pwa/src/db/database.ts (IndexedDB)
└── packages/sync/src/*.ts (SyncQueue, VectorClockManager, CircuitBreaker)
```

### Checklist Backend
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| SY-BE-01 | Endpoint de sync | ✅ | POST /sync/push |
| SY-BE-02 | Recibir eventos offline | ✅ | push() con validación |
| SY-BE-03 | Resolver conflictos | ✅ | ConflictResolutionService |
| SY-BE-04 | Vector clocks | ✅ | VectorClockService |
| SY-BE-05 | CRDT | ✅ | CRDTService para LWW |
| SY-BE-06 | Delta compression | ✅ | payload hash |

### Checklist Frontend PWA
| ID | Verificación | Estado | Notas |
|----|--------------|--------|-------|
| SY-FE-01 | Detectar estado conexión | ✅ | setupConnectivityListeners |
| SY-FE-02 | Cola de eventos offline | ✅ | SyncQueue + IndexedDB |
| SY-FE-03 | Sincronizar al reconectar | ✅ | onlineListener → flush() |
| SY-FE-04 | Indicador de estado sync | ✅ | use-sync hook |
| SY-FE-05 | Circuit breaker | ✅ | CircuitBreaker class |
| SY-FE-06 | Métricas de sync | ✅ | SyncMetricsCollector |

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
| ISS-026 | DEBTS/PWA | Sin UI para gestión de deudas (listado, detalle, pagos) | ✅ Cerrado | 2026-01-16 |
| ISS-027 | EXCHANGE/PWA | Sin UI para mostrar tasa actual e historial | ✅ Cerrado | 2026-01-16 |

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
| 2026-01-16 | PRODUCTS/Desktop | Desktop: Importar CSV + limpiar duplicados en productos | Codex |
| 2026-01-16 | PRODUCTS/Desktop | Desktop: Variantes, lotes, seriales y stock por bodega | Codex |
| 2026-01-16 | PRODUCTS/Desktop | Desktop: cache offline de productos + fallback local | Codex |
| 2026-01-16 | DEBTS | Verificado UI PWA completa: DebtsPage, CustomerDebtCard, DebtDetailModal, AddPaymentModal | Codex |
| 2026-01-16 | EXCHANGE | Creado ExchangeRateIndicator en header: tasa BCV, otras tasas, refresh, offline-first | Codex |
| 2026-01-16 | CUSTOMERS | Verificado módulo completo: CRUD, búsqueda, formulario | Codex |
| 2026-01-16 | CUSTOMERS | END-TO-END: migración credit_limit + email, getPurchaseHistory, checkCreditAvailable | Codex |
| 2026-01-16 | CUSTOMERS | PWA: CustomerHistoryModal, credit badge, formulario con email/credit | Codex |
| 2026-01-16 | SUPPLIERS | Verificado módulo completo: CRUD, estadísticas, órdenes, import CSV | Codex |
| 2026-01-16 | WAREHOUSES | Verificado módulo completo: CRUD, stock por bodega, bodega default | Codex |
| 2026-01-16 | TRANSFERS | Verificado módulo completo: crear, ship, receive, cancel, filtros | Codex |
| 2026-01-16 | PROMOTIONS | END-TO-END: CRUD, tipos %, monto, NxM, validación vigencia, productos | Codex |
| 2026-01-16 | DISCOUNTS | END-TO-END: Configuración, autorizaciones, límites, historial, resumen | Codex |
| 2026-01-16 | PRICE-LISTS | END-TO-END: CRUD listas, items, precios por cantidad, vigencia | Codex |
| 2026-01-16 | FISCAL-INVOICES | END-TO-END: Crear desde venta, correlativos, IVA, SENIAT, NC | Codex |
| 2026-01-16 | FISCAL-CONFIGS | END-TO-END: RIF, razón social, tasa IVA, autorización fiscal | Codex |
| 2026-01-16 | AUTH | END-TO-END: Login PIN, JWT, refresh tokens, bcrypt, rate limit | Codex |
| 2026-01-16 | ROLES | END-TO-END: owner/cashier, guards, permisos, rutas protegidas | Codex |
| 2026-01-16 | DASHBOARD | END-TO-END: KPIs ventas, inventario, finanzas, fiscal, performance | Codex |
| 2026-01-16 | REPORTS | END-TO-END: Reportes ventas/inventario/productos, PDF/Excel | Codex |
| 2026-01-16 | ML | END-TO-END: Anomalías, predicciones, recomendaciones, clustering | Codex |
| 2026-01-16 | SYNC | END-TO-END: Vector clocks, CRDT, conflict resolution, IndexedDB | Codex |

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

**Última actualización:** 2026-01-16 (AUDITORÍA END-TO-END COMPLETA)
**Próxima revisión programada:** Al implementar Desktop parity o nuevas features

## RESUMEN AUDITORÍA FINAL

| Fase | Módulos | Estado |
|------|---------|--------|
| FASE 1 | PRODUCTS, INVENTORY, SALES, CASH, PAYMENTS | ✅ 100% |
| FASE 2 | SHIFTS, ORDERS, TABLES, PERIPHERALS | ✅ 100% |
| FASE 3 | DEBTS, EXCHANGE, CUSTOMERS, SUPPLIERS, WAREHOUSES, TRANSFERS | ✅ 100% |
| FASE 4 | PROMOTIONS, DISCOUNTS, PRICE-LISTS | ✅ 100% |
| FASE 5 | FISCAL-INVOICES, FISCAL-CONFIGS | ✅ 100% |
| FASE 6 | AUTH, ROLES | ✅ 100% |
| FASE 7 | DASHBOARD, REPORTS, ML | ✅ 100% |
| FASE 8 | SYNC OFFLINE | ✅ 100% |

**Pendiente Desktop:** Paridad completa con PWA (modo offline, sincronización)
