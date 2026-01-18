# 🧪 Guía de Testing Paso a Paso - LA CAJA PWA

> Guía práctica para verificar todas las funcionalidades de la aplicación de forma sistemática

**Fecha:** 2024-12-28  
**Versión:** 1.0

---

## 🎯 Objetivo

Verificar que todas las funcionalidades de la app funcionan correctamente, incluyendo casos offline y edge cases.

---

## 📋 Pre-requisitos

1. **Backend corriendo**: `npm run dev:api`
2. **Frontend corriendo**: `npm run dev:pwa`
3. **Credenciales de prueba**:
   - Store ID: `9b8d1b2a-5635-4678-bef6-82b43a2b4c0a  `
   - Owner PIN: `012026`
   - Cashier PIN: `202601`

---

## 🚀 Plan de Testing

### Fase 1: Autenticación y Acceso (15 min)

#### ✅ 1.1 Landing Page
- [ ] ⬜ Abre navegador en `http://localhost:5173`
- [ ] ⬜ Verificar que página de landing carga
- [ ] ⬜ Click en "Iniciar Sesión" → debe ir a `/login`

#### ✅ 1.2 Login - Owner
- [ ] ⬜ Seleccionar store: `550e8400-e29b-41d4-a716-446655440000`
- [ ] ⬜ Seleccionar cashier: `Juan Pérez - Owner`
- [ ] ⬜ Ingresar PIN: `1234`
- [ ] ⬜ Click en "Iniciar Sesión"
- [ ] ⬜ **Resultado esperado**: Redirección a `/app/dashboard`
- [ ] ⬜ Verificar que menú lateral muestra opciones de owner

#### ✅ 1.3 Login - Cashier
- [ ] ⬜ Logout si está logueado
- [ ] ⬜ Hacer login con cashier PIN: `5678`
- [ ] ⬜ **Resultado esperado**: Redirección a `/app/pos`
- [ ] ⬜ Verificar que menú lateral tiene opciones limitadas

#### ✅ 1.4 Validaciones
- [ ] ⬜ Intentar login con PIN incorrecto
- [ ] ⬜ **Resultado esperado**: Mensaje de error "PIN incorrecto"
- [ ] ⬜ Intentar login sin seleccionar store
- [ ] ⬜ **Resultado esperado**: Validación previene submit

#### ✅ 1.5 Persistencia de Sesión
- [ ] ⬜ Después de login exitoso, presionar F5
- [ ] ⬜ **Resultado esperado**: Sesión se mantiene, no vuelve a login
- [ ] ⬜ Verificar que datos del usuario se cargan correctamente

---

### Fase 2: Módulo POS - Funcionalidad Básica (30 min)

#### ✅ 2.1 Apertura de Caja (Requerido)
- [ ] ⬜ Ir a `/app/cash`
- [ ] ⬜ Click en "Abrir Caja" si no hay caja abierta
- [ ] ⬜ Ingresar monto inicial (ej: 100 USD en BS, 10 USD)
- [ ] ⬜ Click en "Abrir"
- [ ] ⬜ **Resultado esperado**: Caja se abre, mensaje de éxito

#### ✅ 2.2 Búsqueda de Productos
- [ ] ⬜ Ir a `/app/pos`
- [ ] ⬜ En campo de búsqueda, escribir nombre de producto existente
- [ ] ⬜ **Resultado esperado**: Lista de productos se filtra
- [ ] ⬜ Buscar por código de barras (si hay productos con barcode)
- [ ] ⬜ **Resultado esperado**: Producto se encuentra

#### ✅ 2.3 Agregar Productos al Carrito
- [ ] ⬜ Click en producto de la lista
- [ ] ⬜ **Resultado esperado**: Producto aparece en carrito
- [ ] ⬜ Agregar otro producto diferente
- [ ] ⬜ **Resultado esperado**: Ambos productos en carrito
- [ ] ⬜ Cambiar cantidad de un producto (usar botones +/-)
- [ ] ⬜ **Resultado esperado**: Cantidad se actualiza, total se recalcula

#### ✅ 2.4 Crear Venta - Efectivo BS
- [ ] ⬜ Con items en carrito, click en "Cobrar"
- [ ] ⬜ Seleccionar método de pago: "Efectivo BS"
- [ ] ⬜ Click en "Confirmar Venta"
- [ ] ⬜ **Resultado esperado**: 
  - Venta se crea exitosamente
  - Toast de éxito aparece
  - Carrito se limpia
  - Venta aparece en `/app/sales`

#### ✅ 2.5 Crear Venta - Efectivo USD
- [ ] ⬜ Agregar productos al carrito
- [ ] ⬜ Seleccionar método: "Efectivo USD"
- [ ] ⬜ Ingresar monto recibido (mayor al total)
- [ ] ⬜ **Resultado esperado**: Cambio se calcula automáticamente
- [ ] ⬜ Confirmar venta
- [ ] ⬜ **Resultado esperado**: Venta creada correctamente

#### ✅ 2.6 Crear Venta - Fiado (FIAO)
- [ ] ⬜ Agregar productos al carrito
- [ ] ⬜ Seleccionar método: "Fiado (FIAO)"
- [ ] ⬜ Ingresar nombre del cliente: "Test Cliente"
- [ ] ⬜ Ingresar cédula: "12345678"
- [ ] ⬜ Click en "Confirmar Venta"
- [ ] ⬜ **Resultado esperado**: 
  - Venta se crea
  - Cliente se crea automáticamente
  - Deuda se crea en `/app/debts`

---

### Fase 3: Módulo POS - Funcionalidad Offline (20 min)

#### ✅ 3.1 Preparar Test Offline
- [ ] ⬜ Abrir DevTools (F12) → Tab "Network"
- [ ] ⬜ Activar checkbox "Offline"
- [ ] ⬜ Verificar indicador de conexión muestra "Sin conexión"

#### ✅ 3.2 Crear Venta Offline
- [ ] ⬜ Con app offline, agregar productos al carrito
- [ ] ⬜ Realizar checkout completo
- [ ] ⬜ **Resultado esperado**: 
  - Toast muestra "guardada localmente"
  - Venta no aparece en `/app/sales` (todavía)
  - Console muestra evento guardado en IndexedDB

#### ✅ 3.3 Sincronización
- [ ] ⬜ Desactivar modo offline en DevTools
- [ ] ⬜ Esperar 30 segundos (sincronización periódica)
- [ ] ⬜ **Resultado esperado**: 
  - Toast de sincronización aparece
  - Venta ahora aparece en `/app/sales`
  - Evento sincronizado

#### ✅ 3.4 Verificar IndexedDB
- [ ] ⬜ DevTools → Application → IndexedDB → `LaCajaDB`
- [ ] ⬜ Tabla `localEvents` → Verificar eventos pendientes
- [ ] ⬜ **Resultado esperado**: Eventos con `sync_status: 'pending'` o `'synced'`

---

### Fase 4: Módulo Productos (20 min)

#### ✅ 4.1 Lista de Productos
- [ ] ⬜ Ir a `/app/products`
- [ ] ⬜ **Resultado esperado**: Tabla de productos carga
- [ ] ⬜ Verificar paginación funciona
- [ ] ⬜ Probar filtros (activo/inactivo, categoría)

#### ✅ 4.2 Crear Producto
- [ ] ⬜ Click en "Agregar Producto"
- [ ] ⬜ Llenar formulario:
  - Nombre: "Producto Test"
  - Precio BS: 10
  - Precio USD: 0.30
  - Costo BS: 8
  - Costo USD: 0.24
- [ ] ⬜ Guardar producto
- [ ] ⬜ **Resultado esperado**: Producto aparece en lista

#### ✅ 4.3 Editar Producto
- [ ] ⬜ Click en producto existente para editar
- [ ] ⬜ Cambiar precio
- [ ] ⬜ Guardar cambios
- [ ] ⬜ **Resultado esperado**: Precio actualizado en lista

#### ✅ 4.4 Edición Inline de Precios
- [ ] ⬜ Doble click en celda de precio en tabla
- [ ] ⬜ Cambiar precio directamente
- [ ] ⬜ Presionar Enter o hacer click fuera
- [ ] ⬜ **Resultado esperado**: Precio se actualiza sin abrir modal

---

### Fase 5: Módulo Inventario (20 min)

#### ✅ 5.1 Lista de Movimientos
- [ ] ⬜ Ir a `/app/inventory`
- [ ] ⬜ **Resultado esperado**: Movimientos de inventario se muestran
- [ ] ⬜ Probar filtros por fecha y tipo

#### ✅ 5.2 Recepción de Stock
- [ ] ⬜ Click en "Recepción de Mercancía"
- [ ] ⬜ Seleccionar producto existente
- [ ] ⬜ Ingresar cantidad: 10
- [ ] ⬜ Ingresar costo unitario
- [ ] ⬜ Guardar recepción
- [ ] ⬜ **Resultado esperado**: 
  - Movimiento aparece en lista
  - Stock del producto aumenta

#### ✅ 5.3 Ajuste de Inventario
- [ ] ⬜ Click en "Ajuste de Inventario"
- [ ] ⬜ Seleccionar producto
- [ ] ⬜ Ajustar cantidad (aumentar o disminuir)
- [ ] ⬜ Ingresar razón: "Conteo físico"
- [ ] ⬜ Guardar ajuste
- [ ] ⬜ **Resultado esperado**: 
  - Movimiento aparece
  - Stock se actualiza

---

### Fase 6: Módulo Ventas (15 min)

#### ✅ 6.1 Lista de Ventas
- [ ] ⬜ Ir a `/app/sales`
- [ ] ⬜ **Resultado esperado**: Lista de ventas recientes carga
- [ ] ⬜ Probar filtros (fecha, método de pago)
- [ ] ⬜ Buscar por número de venta

#### ✅ 6.2 Detalle de Venta
- [ ] ⬜ Click en una venta de la lista
- [ ] ⬜ **Resultado esperado**: 
  - Modal de detalle se abre
  - Información completa se muestra
  - Productos se listan
  - Vista de ticket funciona

#### ✅ 6.3 Anular Venta
- [ ] ⬜ Abrir detalle de venta reciente
- [ ] ⬜ Click en "Anular Venta"
- [ ] ⬜ Ingresar razón: "Test de anulación"
- [ ] ⬜ Confirmar anulación
- [ ] ⬜ **Resultado esperado**: 
  - Venta se marca como anulada
  - Stock se restaura (si aplica)

---

### Fase 7: Módulo Caja (15 min)

#### ✅ 7.1 Estado de Caja
- [ ] ⬜ Ir a `/app/cash`
- [ ] ⬜ **Resultado esperado**: 
  - Dashboard de caja se muestra
  - Indicador de turno activo visible
  - Métricas se calculan correctamente

#### ✅ 7.2 Cierre de Caja
- [ ] ⬜ Click en "Cerrar Caja"
- [ ] ⬜ Paso 1: Ingresar montos físicos contados
- [ ] ⬜ Paso 2: Revisar resumen
- [ ] ⬜ Paso 3: Confirmar cierre
- [ ] ⬜ **Resultado esperado**: 
  - Caja se cierra correctamente
  - Resumen se guarda

---

### Fase 8: Módulo Clientes y Deudas (15 min)

#### ✅ 8.1 Lista de Clientes
- [ ] ⬜ Ir a `/app/customers`
- [ ] ⬜ **Resultado esperado**: Lista de clientes carga
- [ ] ⬜ Buscar cliente por nombre/cédula/teléfono

#### ✅ 8.2 Crear Cliente
- [ ] ⬜ Click en "Agregar Cliente"
- [ ] ⬜ Llenar formulario completo
- [ ] ⬜ Guardar cliente
- [ ] ⬜ **Resultado esperado**: Cliente aparece en lista

#### ✅ 8.3 Lista de Deudas
- [ ] ⬜ Ir a `/app/debts`
- [ ] ⬜ **Resultado esperado**: Deudas se listan
- [ ] ⬜ Verificar que deuda creada desde venta FIAO aparece

#### ✅ 8.4 Registrar Pago
- [ ] ⬜ Click en deuda abierta
- [ ] ⬜ Click en "Registrar Pago"
- [ ] ⬜ Ingresar monto y método de pago
- [ ] ⬜ Guardar pago
- [ ] ⬜ **Resultado esperado**: 
  - Pago se registra
  - Saldo de deuda se actualiza

---

### Fase 9: Funcionalidades Offline Avanzadas (20 min)

#### ✅ 9.1 Múltiples Ventas Offline
- [ ] ⬜ Activar modo offline
- [ ] ⬜ Crear 5 ventas offline
- [ ] ⬜ **Resultado esperado**: Todas se guardan localmente

#### ✅ 9.2 Sincronización Masiva
- [ ] ⬜ Desactivar modo offline
- [ ] ⬜ Esperar sincronización
- [ ] ⬜ **Resultado esperado**: Todas las ventas se sincronizan
- [ ] ⬜ Verificar que todas aparecen en `/app/sales`

#### ✅ 9.3 App Offline - Refrescar Página
- [ ] ⬜ Con app offline, presionar F5
- [ ] ⬜ **Resultado esperado**: App carga correctamente (no página de error de Chrome)
- [ ] ⬜ Service Worker sirve desde cache

#### ✅ 9.4 Sincronización de Conflictos
- [ ] ⬜ Si hay conflictos, ir a `/app/conflicts`
- [ ] ⬜ **Resultado esperado**: Conflictos se muestran
- [ ] ⬜ Resolver conflicto (keep_mine o take_theirs)
- [ ] ⬜ **Resultado esperado**: Conflicto se resuelve correctamente

---

### Fase 10: Validaciones y Manejo de Errores (15 min)

#### ✅ 10.1 POS - Sin Caja Abierta
- [ ] ⬜ Cerrar caja si está abierta
- [ ] ⬜ Intentar crear venta en POS
- [ ] ⬜ **Resultado esperado**: Error claro "Debes abrir una caja primero"

#### ✅ 10.2 Stock Insuficiente
- [ ] ⬜ En POS, intentar agregar producto con stock = 0
- [ ] ⬜ **Resultado esperado**: Error "Stock insuficiente" o producto no se agrega

#### ✅ 10.3 Validaciones de Formularios
- [ ] ⬜ Intentar crear producto sin nombre
- [ ] ⬜ **Resultado esperado**: Validación previene guardar, mensaje claro

#### ✅ 10.4 Productos Inactivos
- [ ] ⬜ Desactivar producto en `/app/products`
- [ ] ⬜ Intentar agregarlo al carrito en POS
- [ ] ⬜ **Resultado esperado**: Producto no aparece en búsqueda o no se agrega

---

### Fase 11: Testing Móvil/Responsive (20 min)

#### ✅ 11.1 Vista Móvil
- [ ] ⬜ Abrir DevTools → Toggle device toolbar (Ctrl+Shift+M)
- [ ] ⬜ Seleccionar dispositivo móvil (iPhone 12 Pro)
- [ ] ⬜ Verificar que layout se adapta
- [ ] ⬜ Probar POS en móvil
- [ ] ⬜ **Resultado esperado**: Vista optimizada, botones accesibles

#### ✅ 11.2 Gestos Móviles
- [ ] ⬜ En `/app/sales`, hacer swipe en card de venta
- [ ] ⬜ **Resultado esperado**: Acciones rápidas aparecen

#### ✅ 11.3 Teclado Numérico
- [ ] ⬜ En POS, click en campo de cantidad
- [ ] ⬜ **Resultado esperado**: Teclado numérico aparece (en móvil)

---

### Fase 12: Módulos Secundarios - Verificación Rápida (30 min)

#### ✅ 12.1 Dashboard
- [ ] ⬜ Ir a `/app/dashboard`
- [ ] ⬜ **Resultado esperado**: KPIs y gráficos se muestran
- [ ] ⬜ Cambiar filtros de fecha
- [ ] ⬜ **Resultado esperado**: Datos se actualizan

#### ✅ 12.2 Proveedores
- [ ] ⬜ Ir a `/app/suppliers`
- [ ] ⬜ Verificar lista carga
- [ ] ⬜ Crear proveedor de prueba
- [ ] ⬜ Ir a `/app/purchase-orders`
- [ ] ⬜ Crear orden de compra

#### ✅ 12.3 Bodegas
- [ ] ⬜ Ir a `/app/warehouses`
- [ ] ⬜ Verificar lista carga
- [ ] ⬜ Crear bodega de prueba
- [ ] ⬜ Ir a `/app/transfers`
- [ ] ⬜ Crear transferencia entre bodegas

#### ✅ 12.4 Descuentos
- [ ] ⬜ Ir a `/app/discounts`
- [ ] ⬜ Configurar descuento
- [ ] ⬜ Volver a POS y aplicar descuento
- [ ] ⬜ **Resultado esperado**: Descuento se aplica correctamente

#### ✅ 12.5 Lotes
- [ ] ⬜ Ir a `/app/lots`
- [ ] ⬜ Verificar dashboard de lotes por vencer
- [ ] ⬜ Crear lote de prueba

---

## 📊 Resumen de Verificación

**Total de Fases:** 12  
**Tiempo Estimado:** ~3.5 horas  
**Items Verificados:** 0  
**Items con Problemas:** 0  

---

## 🐛 Reporte de Problemas

Si encuentras problemas durante el testing, documentarlos aquí:

| Fase | Item | Problema | Severidad | Estado |
|------|------|----------|-----------|--------|
| | | | | |

---

## ✅ Checklist Final

Después de completar todas las fases:

- [ ] ⬜ Todas las funcionalidades críticas verificadas
- [ ] ⬜ Funcionalidades offline verificadas
- [ ] ⬜ Problemas documentados
- [ ] ⬜ Resumen de verificación actualizado

---

**Última actualización:** 2024-12-28  
**Próxima revisión:** Después de cada release
