# ✅ Verificación Funcional Completa - LA CAJA PWA

> Checklist exhaustivo para verificar todas las funcionalidades de la aplicación

**Fecha de creación:** 2024-12-28  
**Versión:** 1.0  
**Estado:** ⬜ En progreso

---

## 📋 Índice

1. [Autenticación y Acceso](#1-autenticación-y-acceso)
2. [Módulo: POS (Punto de Venta)](#2-módulo-pos-punto-de-venta)
3. [Módulo: Productos](#3-módulo-productos)
4. [Módulo: Inventario](#4-módulo-inventario)
5. [Módulo: Ventas](#5-módulo-ventas)
6. [Módulo: Caja y Turnos](#6-módulo-caja-y-turnos)
7. [Módulo: Clientes y Deudas](#7-módulo-clientes-y-deudas)
8. [Módulo: Proveedores](#8-módulo-proveedores)
9. [Módulo: Bodegas y Transferencias](#9-módulo-bodegas-y-transferencias)
10. [Módulo: Descuentos y Promociones](#10-módulo-descuentos-y-promociones)
11. [Módulo: Lotes y Seriales](#11-módulo-lotes-y-seriales)
12. [Módulo: Dashboard y Reportes](#12-módulo-dashboard-y-reportes)
13. [Módulo: Configuración Fiscal](#13-módulo-configuración-fiscal)
14. [Módulo: Machine Learning](#14-módulo-machine-learning)
15. [Módulo: Analítica en Tiempo Real](#15-módulo-analítica-en-tiempo-real)
16. [Módulo: Mesas (Restaurante)](#16-módulo-mesas-restaurante)
17. [Módulo: Periféricos](#17-módulo-periféricos)
18. [Funcionalidades Offline](#18-funcionalidades-offline)
19. [Funcionalidades Globales](#19-funcionalidades-globales)
20. [Seguridad y Permisos](#20-seguridad-y-permisos)

---

## Leyenda de Estados

| Símbolo | Estado |
|---------|--------|
| ⬜ | Pendiente de verificar |
| ✅ | Verificado y funciona correctamente |
| ❌ | Verificado y tiene problemas |
| ⚠️ | Verificado con advertencias/observaciones |
| 🔄 | Verificación en progreso |
| ➖ | No aplica / No disponible |

---

## 1. Autenticación y Acceso

### 1.1 Página de Landing
- [ ] ⬜ Página carga correctamente sin autenticación
- [ ] ⬜ Navegación a login funciona
- [ ] ⬜ Redirección automática si ya está autenticado

### 1.2 Login
- [ ] ⬜ Login con credenciales válidas (owner)
- [ ] ⬜ Login con credenciales válidas (cashier)
- [ ] ⬜ Validación de campos requeridos
- [ ] ⬜ Mensaje de error con credenciales inválidas
- [ ] ⬜ Redirección según rol (owner → dashboard, cashier → POS)
- [ ] ⬜ Persistencia de sesión (refresh mantiene sesión)
- [ ] ⬜ Logout funciona correctamente

### 1.3 Rutas Protegidas
- [ ] ⬜ Rutas requieren autenticación
- [ ] ⬜ Redirección a login si no autenticado
- [ ] ⬜ Permisos por rol funcionan (owner puede acceder a todo, cashier tiene restricciones)
- [ ] ⬜ Página de licencia bloqueada aparece cuando corresponde

### 1.4 Admin Panel
- [ ] ⬜ Acceso directo a `/admin` sin autenticación (con admin key)
- [ ] ⬜ Funcionalidades de administración disponibles

---

## 2. Módulo: POS (Punto de Venta)

**Ruta:** `/app/pos`

### 2.1 Búsqueda de Productos
- [ ] ⬜ Búsqueda por nombre funciona
- [ ] ⬜ Búsqueda por código de barras funciona
- [ ] ⬜ Búsqueda por SKU funciona
- [ ] ⬜ Scanner de código de barras funciona
- [ ] ⬜ Autocompletado muestra sugerencias
- [ ] ⬜ Debounce funciona (no busca en cada tecla)
- [ ] ⬜ Búsqueda funciona offline (usa cache)

### 2.2 Lista de Productos
- [ ] ⬜ Productos se muestran correctamente
- [ ] ⬜ Iconos de categoría aparecen
- [ ] ⬜ Productos con stock bajo se destacan
- [ ] ⬜ Precios por peso se muestran correctamente
- [ ] ⬜ Virtualización funciona con muchos productos

### 2.3 Carrito
- [ ] ⬜ Agregar producto al carrito funciona
- [ ] ⬜ Animación al agregar producto
- [ ] ⬜ Actualizar cantidad funciona
- [ ] ⬜ Eliminar item del carrito funciona
- [ ] ⬜ Swipe para eliminar en móvil funciona
- [ ] ⬜ Badge de cantidad en carrito se actualiza
- [ ] ⬜ Cálculo de totales es correcto (BS y USD)
- [ ] ⬜ Recuperación de carrito al recargar (si está habilitado)

### 2.4 Productos por Peso
- [ ] ⬜ Modal de entrada de peso aparece para productos por peso
- [ ] ⬜ Cálculo de precio por peso es correcto
- [ ] ⬜ Unidades de peso se muestran correctamente

### 2.5 Checkout
- [ ] ⬜ Modal de checkout se abre correctamente
- [ ] ⬜ Métodos de pago disponibles funcionan:
  - [ ] ⬜ CASH_BS
  - [ ] ⬜ CASH_USD
  - [ ] ⬜ PAGO_MOVIL
  - [ ] ⬜ TRANSFER
  - [ ] ⬜ FIAO (fiado)
  - [ ] ⬜ SPLIT (pago dividido)
- [ ] ⬜ Cálculo de cambio funciona (CASH_USD)
- [ ] ⬜ Selección de cliente funciona (FIAO)
- [ ] ⬜ Crear cliente desde checkout funciona
- [ ] ⬜ Split payment funciona correctamente
- [ ] ⬜ Notas en venta se guardan
- [ ] ⬜ Confirmación con Enter funciona

### 2.6 Validaciones
- [ ] ⬜ Error si no hay caja abierta
- [ ] ⬜ Validación de stock antes de agregar
- [ ] ⬜ Error si stock insuficiente
- [ ] ⬜ Confirmación antes de limpiar carrito
- [ ] ⬜ Manejo de productos eliminados/inactivos

### 2.7 Offline
- [ ] ⬜ Crear venta offline funciona
- [ ] ⬜ Venta se guarda localmente
- [ ] ⬜ Notificación de "guardada localmente"
- [ ] ⬜ Sincronización automática cuando vuelve conexión

### 2.8 Móvil/Tablet
- [ ] ⬜ Vista optimizada para móvil
- [ ] ⬜ Teclado numérico en cantidades
- [ ] ⬜ Modo landscape en tablets
- [ ] ⬜ Bottom sheet para checkout en móvil

---

## 3. Módulo: Productos

**Ruta:** `/app/products`

### 3.1 Lista de Productos
- [ ] ⬜ Tabla de productos carga correctamente
- [ ] ⬜ Paginación funciona
- [ ] ⬜ Filtros funcionan (nombre, categoría, activo/inactivo)
- [ ] ⬜ Búsqueda funciona
- [ ] ⬜ Vista de cards en móvil
- [ ] ⬜ Colores por categoría se muestran
- [ ] ⬜ Badges de estado (activo/inactivo/sin stock)

### 3.2 Crear Producto
- [ ] ⬜ Modal de crear producto se abre
- [ ] ⬜ Formulario valida campos requeridos
- [ ] ⬜ Guardar producto funciona
- [ ] ⬜ Producto aparece en lista después de crear
- [ ] ⬜ Preview de cómo se ve en POS funciona

### 3.3 Editar Producto
- [ ] ⬜ Edición inline de precios funciona
- [ ] ⬜ Modal de edición carga datos correctos
- [ ] ⬜ Guardar cambios funciona
- [ ] ⬜ Validación de precios (no negativos)
- [ ] ⬜ Advertencia si precio < costo

### 3.4 Funciones Avanzadas
- [ ] ⬜ Duplicar producto funciona
- [ ] ⬜ Eliminar producto (con confirmación)
- [ ] ⬜ Cambio masivo de precios funciona
- [ ] ⬜ Importación CSV funciona
- [ ] ⬜ Exportar a Excel funciona
- [ ] ⬜ Limpiar productos duplicados funciona
- [ ] ⬜ Variantes de producto (talla, color, etc.)

### 3.5 Validaciones
- [ ] ⬜ Código de barras único se valida
- [ ] ⬜ SKU único se valida
- [ ] ⬜ Precios no pueden ser negativos

---

## 4. Módulo: Inventario

**Ruta:** `/app/inventory`

### 4.1 Lista de Movimientos
- [ ] ⬜ Movimientos se muestran correctamente
- [ ] ⬜ Paginación funciona
- [ ] ⬜ Filtros por fecha funcionan
- [ ] ⬜ Filtros por tipo de movimiento funcionan
- [ ] ⬜ Código de colores por tipo de movimiento

### 4.2 Recepción de Stock
- [ ] ⬜ Modal de recepción se abre
- [ ] ⬜ Seleccionar producto funciona
- [ ] ⬜ Registrar recepción funciona
- [ ] ⬜ Stock se actualiza correctamente
- [ ] ⬜ Nota se guarda
- [ ] ⬜ Escaneo con cámara funciona (móvil)

### 4.3 Ajuste de Inventario
- [ ] ⬜ Modal de ajuste se abre
- [ ] ⬜ Ajuste aumenta/disminuye stock correctamente
- [ ] ⬜ Razón de ajuste se requiere
- [ ] ⬜ Confirmación para ajustes grandes
- [ ] ⬜ Validación de stock no negativo

### 4.4 Alertas y Reportes
- [ ] ⬜ Productos con stock bajo se destacan
- [ ] ⬜ Barra de progreso stock vs mínimo funciona
- [ ] ⬜ Exportar inventario a Excel funciona
- [ ] ⬜ Alertas configurables funcionan

### 4.5 Offline
- [ ] ⬜ Recepción funciona offline
- [ ] ⬜ Ajuste funciona offline
- [ ] ⬜ Movimientos se sincronizan al reconectar

---

## 5. Módulo: Ventas

**Ruta:** `/app/sales`

### 5.1 Lista de Ventas
- [ ] ⬜ Lista de ventas carga correctamente
- [ ] ⬜ Paginación funciona
- [ ] ⬜ Filtros avanzados funcionan (fecha, monto, método)
- [ ] ⬜ Búsqueda por número de venta funciona
- [ ] ⬜ Estado de venta con colores (completada/anulada)
- [ ] ⬜ Vista de cards swipeables en móvil

### 5.2 Detalle de Venta
- [ ] ⬜ Modal de detalle se abre
- [ ] ⬜ Información completa se muestra
- [ ] ⬜ Vista de ticket funciona
- [ ] ⬜ Productos en venta se listan
- [ ] ⬜ Mini-preview de productos

### 5.3 Acciones de Venta
- [ ] ⬜ Reimprimir ticket funciona
- [ ] ⬜ Anular venta funciona (con razón)
- [ ] ⬜ Confirmación antes de anular
- [ ] ⬜ Validación de permisos para anular
- [ ] ⬜ Devolución parcial funciona
- [ ] ⬜ Compartir ticket por WhatsApp (móvil)

### 5.4 Exportación
- [ ] ⬜ Exportar ventas a Excel funciona
- [ ] ⬜ Filtros se aplican a exportación

---

## 6. Módulo: Caja y Turnos

**Ruta:** `/app/cash` y `/app/shifts`

### 6.1 Apertura de Caja
- [ ] ⬜ Modal de apertura funciona
- [ ] ⬜ Monto inicial se registra
- [ ] ⬜ Nota opcional se guarda
- [ ] ⬜ Validación de monto inicial

### 6.2 Estado de Caja
- [ ] ⬜ Dashboard de caja muestra métricas correctas
- [ ] ⬜ Indicador de turno activo se muestra
- [ ] ⬜ Resumen visual en tiempo real
- [ ] ⬜ Vista simplificada para móvil

### 6.3 Cierre de Caja
- [ ] ⬜ Wizard de cierre paso a paso funciona
- [ ] ⬜ Calculadora de denominaciones funciona
- [ ] ⬜ Comparación automática efectivo físico vs sistema
- [ ] ⬜ Alertas de diferencias significativas
- [ ] ⬜ Imprimir resumen funciona

### 6.4 Turnos
- [ ] ⬜ Lista de turnos se muestra
- [ ] ⬜ Historial de cortes X/Z se muestra
- [ ] ⬜ Imprimir resumen de turno funciona
- [ ] ⬜ Notificación de turno por cerrar (después de 8h)

---

## 7. Módulo: Clientes y Deudas

**Ruta:** `/app/customers` y `/app/debts`

### 7.1 Clientes
- [ ] ⬜ Lista de clientes carga correctamente
- [ ] ⬜ Búsqueda rápida funciona (cédula/teléfono/email)
- [ ] ⬜ Crear cliente funciona
- [ ] ⬜ Editar cliente funciona
- [ ] ⬜ Eliminar cliente (con confirmación si tiene deuda)
- [ ] ⬜ Vista de tarjeta en móvil
- [ ] ⬜ Avatar/iniciales se muestran

### 7.2 Deudas
- [ ] ⬜ Lista de deudas se muestra
- [ ] ⬜ Filtrar por estado funciona
- [ ] ⬜ Deudas por cliente se muestran
- [ ] ⬜ Indicador de saldo deudor prominente
- [ ] ⬜ Timeline de pagos funciona
- [ ] ⬜ Código de colores por estado

### 7.3 Pagos
- [ ] ⬜ Registrar pago funciona
- [ ] ⬜ Abono parcial funciona
- [ ] ⬜ Métodos de pago funcionan
- [ ] ⬜ Estado de cuenta imprimible

### 7.4 Crédito
- [ ] ⬜ Límite de crédito configurable
- [ ] ⬜ Verificación de crédito disponible
- [ ] ⬜ Bloqueo si excede límite

### 7.5 Móvil
- [ ] ⬜ Llamar directo desde lista
- [ ] ⬜ Enviar mensaje por WhatsApp

---

## 8. Módulo: Proveedores

**Ruta:** `/app/suppliers` y `/app/purchase-orders`

### 8.1 Proveedores
- [ ] ⬜ Lista de proveedores carga
- [ ] ⬜ Crear proveedor funciona
- [ ] ⬜ Editar proveedor funciona
- [ ] ⬜ Estado con colores

### 8.2 Órdenes de Compra
- [ ] ⬜ Lista de órdenes carga
- [ ] ⬜ Crear orden funciona
- [ ] ⬜ Duplicar orden anterior funciona
- [ ] ⬜ Autocomplete de productos en orden
- [ ] ⬜ Recepción parcial funciona
- [ ] ⬜ Historial de compras por proveedor
- [ ] ⬜ Importar lista de precios funciona

---

## 9. Módulo: Bodegas y Transferencias

**Ruta:** `/app/warehouses` y `/app/transfers`

### 9.1 Bodegas
- [ ] ⬜ Lista de bodegas carga
- [ ] ⬜ Crear bodega funciona
- [ ] ⬜ Indicador de stock por bodega
- [ ] ⬜ Prevenir eliminar bodega con stock

### 9.2 Transferencias
- [ ] ⬜ Lista de transferencias carga
- [ ] ⬜ Crear transferencia funciona
- [ ] ⬜ Validación de stock en origen
- [ ] ⬜ Confirmación de recepción funciona
- [ ] ⬜ Estado con colores (pending/in_transit/completed)

---

## 10. Módulo: Descuentos y Promociones

**Ruta:** `/app/discounts` y `/app/promotions`

### 10.1 Descuentos
- [ ] ⬜ Lista de descuentos carga
- [ ] ⬜ Configurar descuentos funciona
- [ ] ⬜ Autorización de descuento por supervisor
- [ ] ⬜ Límites por rol funcionan
- [ ] ⬜ Indicador visual en POS
- [ ] ⬜ Preview de descuento aplicado
- [ ] ⬜ Historial de descuentos aplicados

### 10.2 Promociones
- [ ] ⬜ Lista de promociones carga
- [ ] ⬜ Crear promoción funciona
- [ ] ⬜ Promociones automáticas (2x1, etc)
- [ ] ⬜ Badge de promoción en POS

---

## 11. Módulo: Lotes y Seriales

**Ruta:** `/app/lots`

### 11.1 Lotes
- [ ] ⬜ Lista de lotes carga
- [ ] ⬜ Indicador de vencimiento próximo
- [ ] ⬜ Dashboard de lotes por vencer
- [ ] ⬜ Alerta automática de productos próximos a vencer

### 11.2 Seriales
- [ ] ⬜ Código de colores por estado
- [ ] ⬜ Selección de lote en venta (FIFO automático)
- [ ] ⬜ Registro de serial en venta
- [ ] ⬜ Validación de serial único
- [ ] ⬜ Bloqueo de serial ya vendido

---

## 12. Módulo: Dashboard y Reportes

**Ruta:** `/app/dashboard` y `/app/reports`

### 12.1 Dashboard
- [ ] ⬜ Dashboard carga correctamente
- [ ] ⬜ KPIs se muestran con indicadores de tendencia
- [ ] ⬜ Gráficos interactivos de ventas
- [ ] ⬜ Comparación período anterior
- [ ] ⬜ Top productos visualizado
- [ ] ⬜ Filtros de fecha rápidos funcionan

### 12.2 Reportes
- [ ] ⬜ Reportes se generan correctamente
- [ ] ⬜ Exportar a PDF funciona
- [ ] ⬜ Exportar a Excel funciona
- [ ] ⬜ Comparar períodos específicos

---

## 13. Módulo: Configuración Fiscal

**Ruta:** `/app/fiscal-config` y `/app/fiscal-invoices`

### 13.1 Configuración Fiscal
- [ ] ⬜ Configuración de datos fiscales funciona
- [ ] ⬜ Datos del negocio se guardan
- [ ] ⬜ RIF se valida

### 13.2 Facturas Fiscales
- [ ] ⬜ Lista de facturas carga
- [ ] ⬜ Generar factura desde venta funciona
- [ ] ⬜ Preview de factura fiscal
- [ ] ⬜ Anular factura con nota de crédito
- [ ] ⬜ Formato para imprimir funciona
- [ ] ⬜ Libro de ventas exportable

---

## 14. Módulo: Machine Learning

**Ruta:** `/app/ml/dashboard`, `/app/ml/predictions`, `/app/ml/anomalies`

### 14.1 Dashboard ML
- [ ] ⬜ Dashboard ML carga
- [ ] ⬜ Gráficos de predicción (si están implementados)
- [ ] ⬜ Indicador de anomalías críticas

### 14.2 Predicciones
- [ ] ⬜ Predicciones de demanda se muestran
- [ ] ⬜ Intervalo de confianza se muestra

### 14.3 Anomalías
- [ ] ⬜ Lista de anomalías carga
- [ ] ⬜ Alertas de anomalías en tiempo real

---

## 15. Módulo: Analítica en Tiempo Real

**Ruta:** `/app/realtime-analytics`

### 15.1 Métricas
- [ ] ⬜ Métricas con actualización animada
- [ ] ⬜ Indicador de conexión WebSocket
- [ ] ⬜ Gráfico de línea en tiempo real

### 15.2 Alertas
- [ ] ⬜ Alertas con prioridad por color
- [ ] ⬜ Configuración de umbrales funciona
- [ ] ⬜ Reconexión automática WebSocket funciona

---

## 16. Módulo: Mesas (Restaurante)

**Ruta:** `/app/tables`

### 16.1 Gestión de Mesas
- [ ] ⬜ Grid de mesas carga
- [ ] ⬜ Estado con colores (libre/ocupada/cuenta)
- [ ] ⬜ Agregar items a mesa abierta
- [ ] ⬜ Badge de monto pendiente

### 16.2 Órdenes
- [ ] ⬜ Abrir orden en mesa funciona
- [ ] ⬜ Agregar items funciona
- [ ] ⬜ Prevenir cerrar mesa con items pendientes
- [ ] ⬜ Confirmación antes de cancelar orden

---

## 17. Módulo: Periféricos

**Ruta:** `/app/peripherals`

### 17.1 Configuración
- [ ] ⬜ Lista de periféricos carga
- [ ] ⬜ Configurar impresora funciona
- [ ] ⬜ Test de impresión funciona
- [ ] ⬜ Indicador de estado de conexión

---

## 18. Funcionalidades Offline

### 18.1 Persistencia
- [ ] ⬜ App carga offline (F5 sin conexión funciona)
- [ ] ⬜ Service Worker funciona correctamente
- [ ] ⬜ Cache de assets funciona
- [ ] ⬜ IndexedDB funciona

### 18.2 Sincronización
- [ ] ⬜ Eventos se guardan localmente offline
- [ ] ⬜ Sincronización automática al reconectar
- [ ] ⬜ Background Sync funciona
- [ ] ⬜ Indicador de estado de sync
- [ ] ⬜ Contador de eventos pendientes

### 18.3 Conflictos
- [ ] ⬜ Conflictos se detectan automáticamente
- [ ] ⬜ Página de conflictos muestra conflictos
- [ ] ⬜ Resolución de conflictos funciona
- [ ] ⬜ UI de resolución es clara

### 18.4 Funcionalidades Offline por Módulo
- [ ] ⬜ POS funciona offline (crear ventas)
- [ ] ⬜ Búsqueda de productos offline (cache)
- [ ] ⬜ Búsqueda de clientes offline (cache)
- [ ] ⬜ Recepción de inventario offline
- [ ] ⬜ Ajustes de inventario offline

---

## 19. Funcionalidades Globales

### 19.1 Navegación
- [ ] ⬜ Menú lateral funciona
- [ ] ⬜ Breadcrumbs funcionan
- [ ] ⬜ Navegación por rutas funciona
- [ ] ⬜ Rutas protegidas funcionan

### 19.2 Notificaciones
- [ ] ⬜ Notificaciones push funcionan (si están habilitadas)
- [ ] ⬜ Toasts de éxito/error funcionan
- [ ] ⬜ Panel de notificaciones funciona

### 19.3 UI Global
- [ ] ⬜ Error boundary funciona
- [ ] ⬜ Loading states se muestran
- [ ] ⬜ Transiciones suaves entre páginas
- [ ] ⬜ Shortcuts de teclado funcionan (documentados con '?')

### 19.4 Responsive
- [ ] ⬜ App funciona en móvil
- [ ] ⬜ App funciona en tablet
- [ ] ⬜ App funciona en desktop
- [ ] ⬜ Layout se adapta correctamente

---

## 20. Seguridad y Permisos

### 20.1 Autenticación
- [ ] ⬜ Tokens JWT se gestionan correctamente
- [ ] ⬜ Renovación de tokens funciona
- [ ] ⬜ Logout limpia tokens

### 20.2 Autorización
- [ ] ⬜ Permisos por rol funcionan:
  - [ ] ⬜ Owner puede acceder a todo
  - [ ] ⬜ Cashier tiene restricciones
- [ ] ⬜ Rutas protegidas funcionan
- [ ] ⬜ Funciones administrativas solo para owner

### 20.3 Validaciones
- [ ] ⬜ Validaciones de datos en frontend
- [ ] ⬜ Mensajes de error claros
- [ ] ⬜ Prevención de acciones no autorizadas

---

## 📊 Resumen de Verificación

**Total de Items:** ~300+  
**Items Verificados:** 0  
**Items con Problemas:** 0  
**Items Pendientes:** ~300+

### Próximos Pasos

1. **Comenzar con Módulos Críticos:**
   - Autenticación
   - POS
   - Ventas
   - Productos

2. **Probar Flujos Completos:**
   - Crear venta completa (búsqueda → carrito → checkout → pago)
   - Recepción de inventario completa
   - Cierre de caja completo

3. **Verificar Offline:**
   - Desactivar conexión
   - Probar funcionalidades críticas
   - Verificar sincronización al reconectar

4. **Testing en Diferentes Dispositivos:**
   - Móvil (iOS/Android)
   - Tablet
   - Desktop (Chrome/Firefox/Safari)

---

**Última actualización:** 2024-12-28  
**Responsable:** Equipo QA/Desarrollo  
**Próxima revisión:** Después de cada sprint
