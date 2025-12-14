# 🗺️ Roadmap Completo: Migración de Estilos + Integración de Componentes shadcn/ui

## 📋 Objetivo
Migrar completamente la aplicación a shadcn/ui, reemplazando estilos hardcodeados y componentes custom por componentes de shadcn/ui, mejorando la consistencia visual, accesibilidad y mantenibilidad.

---

## 🎯 Fase 0: Preparación e Instalación de Componentes Base

### Instalación de Componentes de Alta Prioridad
- [ ] Instalar `table`
  ```bash
  npx shadcn@latest add table
  ```
- [ ] Instalar `calendar`
  ```bash
  npx shadcn@latest add calendar
  ```
- [ ] Instalar `popover` (requerido para Date Picker)
  ```bash
  npx shadcn@latest add popover
  ```
- [ ] Instalar `dialog`
  ```bash
  npx shadcn@latest add dialog
  ```
- [ ] Instalar `tabs`
  ```bash
  npx shadcn@latest add tabs
  ```
- [ ] Instalar `accordion`
  ```bash
  npx shadcn@latest add accordion
  ```

### Instalación de Componentes de Media Prioridad
- [ ] Instalar `alert`
  ```bash
  npx shadcn@latest add alert
  ```
- [ ] Instalar `progress`
  ```bash
  npx shadcn@latest add progress
  ```
- [ ] Instalar `switch`
  ```bash
  npx shadcn@latest add switch
  ```
- [ ] Instalar `radio-group`
  ```bash
  npx shadcn@latest add radio-group
  ```

### Instalación de Componentes de Baja Prioridad (Opcional - Fase 3)
- [ ] Instalar `chart` (requiere recharts)
  ```bash
  npm install recharts
  npx shadcn@latest add chart
  ```
- [ ] Instalar `pagination`
  ```bash
  npx shadcn@latest add pagination
  ```
- [ ] Instalar `command` o `combobox`
  ```bash
  npx shadcn@latest add command
  # o
  npx shadcn@latest add combobox
  ```
- [ ] Instalar `sonner` (reemplazar react-hot-toast)
  ```bash
  npx shadcn@latest add sonner
  ```
- [ ] Instalar `empty`
  ```bash
  npx shadcn@latest add empty
  ```

---

## 🚀 Fase 1: Migración de Páginas Principales

### 1.1 ProductsPage ✅ (Ya migrado parcialmente)
**Estado actual:** Estilos migrados, falta implementar componentes avanzados

#### Migración de Estilos (Completado)
- [x] Reemplazar `text-gray-*` → `text-foreground`/`text-muted-foreground`
- [x] Reemplazar `bg-gray-*` → `bg-background`/`bg-muted`
- [x] Reemplazar `border-gray-*` → `border-border`
- [x] Reemplazar botones raw → `Button` component
- [x] Reemplazar inputs raw → `Input` component
- [x] Reemplazar tabla → `Card` con estilos shadcn
- [x] Reemplazar badges → `Badge` component

#### Implementación de Componentes Nuevos
- [ ] Reemplazar tabla HTML → `Table` component de shadcn
  - [ ] Implementar `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
  - [ ] Agregar sorting por columnas (nombre, precio, stock)
  - [ ] Mantener responsive design (mobile cards, desktop table)
- [ ] Migrar modales → `Dialog` component
  - [ ] `ProductFormModal` → `Dialog`
  - [ ] `ChangePriceModal` → `Dialog`
  - [ ] `BulkPriceChangeModal` → `Dialog`
- [ ] Agregar estados vacíos → `Empty` component (si se instala)
- [ ] Verificar consistencia de colores y espaciado

**Archivos a modificar:**
- `apps/pwa/src/pages/ProductsPage.tsx`
- `apps/pwa/src/components/products/ProductFormModal.tsx`
- `apps/pwa/src/components/products/ChangePriceModal.tsx`
- `apps/pwa/src/components/products/BulkPriceChangeModal.tsx`

---

### 1.2 CustomersPage ✅ (Ya migrado parcialmente)
**Estado actual:** Estilos migrados, falta implementar componentes avanzados

#### Migración de Estilos (Completado)
- [x] Reemplazar `text-gray-*` → `text-foreground`/`text-muted-foreground`
- [x] Reemplazar `bg-gray-*` → `bg-background`/`bg-muted`
- [x] Reemplazar `border-gray-*` → `border-border`
- [x] Reemplazar botones raw → `Button` component
- [x] Reemplazar inputs raw → `Input` component
- [x] Reemplazar tabla → `Card` con estilos shadcn
- [x] Reemplazar avatares → `Avatar` component

#### Implementación de Componentes Nuevos
- [ ] Reemplazar tabla HTML → `Table` component
  - [ ] Implementar estructura de tabla shadcn
  - [ ] Mantener vista mobile (cards) y desktop (table)
- [ ] Migrar modal → `Dialog` component
  - [ ] `CustomerFormModal` → `Dialog`
- [ ] Mejorar búsqueda con `Command` o `Combobox` (opcional)
- [ ] Agregar estados vacíos → `Empty` component

**Archivos a modificar:**
- `apps/pwa/src/pages/CustomersPage.tsx`
- `apps/pwa/src/components/customers/CustomerFormModal.tsx`

---

### 1.3 SalesPage
**Estado actual:** Estilos hardcodeados, necesita migración completa

#### Migración de Estilos
- [ ] Reemplazar `text-gray-*` → `text-foreground`/`text-muted-foreground`
- [ ] Reemplazar `bg-gray-*` → `bg-background`/`bg-muted`
- [ ] Reemplazar `border-gray-*` → `border-border`
- [ ] Reemplazar botones raw → `Button` component
- [ ] Reemplazar inputs raw → `Input` component
- [ ] Reemplazar tabla → `Card` con estilos shadcn
- [ ] Reemplazar badges de estado → `Badge` component

#### Implementación de Componentes Nuevos
- [ ] Reemplazar inputs de fecha → `Date Picker` (Calendar + Popover)
  - [ ] Filtro "Desde" → Date Picker
  - [ ] Filtro "Hasta" → Date Picker
  - [ ] Agregar presets rápidos (hoy, semana, mes)
- [ ] Reemplazar tabla HTML → `Table` component
  - [ ] Implementar estructura completa
  - [ ] Agregar sorting por fecha, total, etc.
- [ ] Reemplazar paginación custom → `Pagination` component
- [ ] Migrar modal → `Dialog` component
  - [ ] `SaleDetailModal` → `Dialog`
- [ ] Agregar estados vacíos → `Empty` component

**Archivos a modificar:**
- `apps/pwa/src/pages/SalesPage.tsx`
- `apps/pwa/src/components/sales/SaleDetailModal.tsx`

---

### 1.4 InventoryPage
**Estado actual:** Estilos hardcodeados, necesita migración completa

#### Migración de Estilos
- [ ] Reemplazar `text-gray-*` → `text-foreground`/`text-muted-foreground`
- [ ] Reemplazar `bg-gray-*` → `bg-background`/`bg-muted`
- [ ] Reemplazar `border-gray-*` → `border-border`
- [ ] Reemplazar botones raw → `Button` component
- [ ] Reemplazar inputs raw → `Input` component
- [ ] Reemplazar tabla → `Card` con estilos shadcn
- [ ] Reemplazar alertas de stock bajo → `Alert` component

#### Implementación de Componentes Nuevos
- [ ] Reemplazar checkbox "Solo stock bajo" → `Switch` component
- [ ] Reemplazar tabla HTML → `Table` component
  - [ ] Implementar estructura completa
  - [ ] Agregar indicadores visuales de stock
- [ ] Agregar `Progress` component para nivel de stock
  - [ ] Indicador visual del nivel de stock (bajo/medio/alto)
- [ ] Implementar `Tabs` para organizar filtros
  - [ ] Tab "Todos"
  - [ ] Tab "Stock Bajo"
  - [ ] Tab "Sin Stock"
- [ ] Migrar modales → `Dialog` component
  - [ ] `StockReceivedModal` → `Dialog`
  - [ ] `StockAdjustModal` → `Dialog`
  - [ ] `MovementsModal` → `Dialog`
- [ ] Agregar estados vacíos → `Empty` component

**Archivos a modificar:**
- `apps/pwa/src/pages/InventoryPage.tsx`
- `apps/pwa/src/components/inventory/StockReceivedModal.tsx`
- `apps/pwa/src/components/inventory/StockAdjustModal.tsx`
- `apps/pwa/src/components/inventory/MovementsModal.tsx`

---

### 1.5 CashPage
**Estado actual:** Estilos hardcodeados, necesita migración completa

#### Migración de Estilos
- [ ] Reemplazar `text-gray-*` → `text-foreground`/`text-muted-foreground`
- [ ] Reemplazar `bg-gray-*` → `bg-background`/`bg-muted`
- [ ] Reemplazar `border-gray-*` → `border-border`
- [ ] Reemplazar botones raw → `Button` component
- [ ] Reemplazar cards de estadísticas → `Card` component
- [ ] Reemplazar alertas de estado → `Alert` component

#### Implementación de Componentes Nuevos
- [ ] Migrar modales → `Dialog` component
  - [ ] `OpenCashModal` → `Dialog`
  - [ ] `CloseCashModal` → `Dialog`
  - [ ] `CashSessionDetailModal` → `Dialog`
- [ ] Agregar `Alert` para estado de sesión
  - [ ] Sesión abierta → Alert success
  - [ ] Sesión cerrada → Alert info
- [ ] Agregar `Chart` para visualización de sesiones (opcional - Fase 3)
- [ ] Mejorar cards de resumen con `Card` component
- [ ] Agregar estados vacíos → `Empty` component

**Archivos a modificar:**
- `apps/pwa/src/pages/CashPage.tsx`
- `apps/pwa/src/components/cash/OpenCashModal.tsx`
- `apps/pwa/src/components/cash/CloseCashModal.tsx`
- `apps/pwa/src/components/cash/CashSessionDetailModal.tsx`
- `apps/pwa/src/components/cash/CashSessionsList.tsx`

---

### 1.6 DebtsPage
**Estado actual:** Estilos hardcodeados, necesita migración completa

#### Migración de Estilos
- [ ] Reemplazar `text-gray-*` → `text-foreground`/`text-muted-foreground`
- [ ] Reemplazar `bg-gray-*` → `bg-background`/`bg-muted`
- [ ] Reemplazar `border-gray-*` → `border-border`
- [ ] Reemplazar botones raw → `Button` component
- [ ] Reemplazar inputs raw → `Input` component
- [ ] Reemplazar cards → `Card` component
- [ ] Reemplazar alertas → `Alert` component

#### Implementación de Componentes Nuevos
- [ ] Reemplazar botones de vista → `Tabs` component
  - [ ] Tab "Por Cliente"
  - [ ] Tab "Todas las Deudas"
- [ ] Reemplazar filtros de estado → `Radio Group` o `Tabs`
- [ ] Agregar `Alert` para deudas pendientes
  - [ ] Alert warning para deudas abiertas
  - [ ] Alert success para deudas pagadas
- [ ] Agregar `Progress` para progreso de pago
  - [ ] Indicador visual del porcentaje pagado
- [ ] Migrar modales → `Dialog` component
  - [ ] `DebtDetailModal` → `Dialog`
  - [ ] `AddPaymentModal` → `Dialog`
- [ ] Mejorar cards de cliente con `Card` component
- [ ] Agregar estados vacíos → `Empty` component

**Archivos a modificar:**
- `apps/pwa/src/pages/DebtsPage.tsx`
- `apps/pwa/src/components/debts/DebtDetailModal.tsx`
- `apps/pwa/src/components/debts/AddPaymentModal.tsx`
- `apps/pwa/src/components/debts/CustomerDebtCard.tsx`

---

### 1.7 ReportsPage
**Estado actual:** Estilos hardcodeados, necesita migración completa

#### Migración de Estilos
- [ ] Reemplazar `text-gray-*` → `text-foreground`/`text-muted-foreground`
- [ ] Reemplazar `bg-gray-*` → `bg-background`/`bg-muted`
- [ ] Reemplazar `border-gray-*` → `border-border`
- [ ] Reemplazar botones raw → `Button` component
- [ ] Reemplazar inputs raw → `Input` component
- [ ] Reemplazar cards de estadísticas → `Card` component
- [ ] Reemplazar alertas → `Alert` component

#### Implementación de Componentes Nuevos
- [ ] Reemplazar inputs de fecha → `Date Picker` (Calendar + Popover)
  - [ ] Presets: Hoy, Semana, Mes
  - [ ] Rango personalizado con Date Picker
- [ ] Reemplazar botones de rango → `Radio Group` o `Tabs`
  - [ ] Radio buttons para: Hoy / Semana / Mes / Personalizado
- [ ] Reemplazar secciones colapsables → `Accordion` component
  - [ ] "Top 10 Productos Más Vendidos" → Accordion
  - [ ] "Top 10 Deudores" → Accordion
  - [ ] "Ventas por Día" → Accordion
- [ ] Reemplazar barras de progreso custom → `Progress` component
  - [ ] Barras en Top Productos
- [ ] Reemplazar cards de estadísticas → `Alert` component con variantes
  - [ ] Total Ventas → Alert info
  - [ ] Ingresos USD → Alert default
  - [ ] Ganancia Neta → Alert success
  - [ ] Margen → Alert default
- [ ] Agregar `Chart` component (Fase 3)
  - [ ] Gráfico de línea: Ventas por día
  - [ ] Gráfico de barras: Métodos de pago
  - [ ] Gráfico de barras: Top productos
- [ ] Reemplazar toggles de mostrar/ocultar → `Switch` component
- [ ] Agregar estados vacíos → `Empty` component

**Archivos a modificar:**
- `apps/pwa/src/pages/ReportsPage.tsx`

---

### 1.8 POSPage ✅ (Ya migrado)
**Estado actual:** Estilos migrados, componentes básicos implementados

#### Migración de Estilos (Completado)
- [x] Reemplazar `text-gray-*` → `text-foreground`/`text-muted-foreground`
- [x] Reemplazar `bg-gray-*` → `bg-background`/`bg-muted`
- [x] Reemplazar `border-gray-*` → `border-border`
- [x] Reemplazar botones raw → `Button` component
- [x] Reemplazar inputs raw → `Input` component
- [x] Reemplazar cards → `Card` component
- [x] Implementar `ScrollArea` para listas

#### Mejoras Opcionales (Fase 3)
- [ ] Mejorar búsqueda con `Command` o `Combobox`
  - [ ] Búsqueda con sugerencias
  - [ ] Keyboard navigation mejorada
- [ ] Agregar `Hover Card` para preview de productos (opcional)

**Archivos a modificar:**
- `apps/pwa/src/pages/POSPage.tsx` (mejoras opcionales)

---

## 🔧 Fase 2: Migración de Componentes y Modales

### 2.1 Modales de Productos ✅ (Ya migrados parcialmente)
**Estado actual:** Estilos migrados, falta migrar a Dialog

- [x] `ProductFormModal` - Estilos migrados
- [ ] `ProductFormModal` - Migrar a `Dialog` component
- [x] `ChangePriceModal` - Estilos migrados
- [ ] `ChangePriceModal` - Migrar a `Dialog` component
- [x] `BulkPriceChangeModal` - Estilos migrados
- [ ] `BulkPriceChangeModal` - Migrar a `Dialog` component
  - [ ] Reemplazar botones de modo → `Radio Group`

**Archivos:**
- `apps/pwa/src/components/products/ProductFormModal.tsx`
- `apps/pwa/src/components/products/ChangePriceModal.tsx`
- `apps/pwa/src/components/products/BulkPriceChangeModal.tsx`

---

### 2.2 Modales de Clientes
- [ ] `CustomerFormModal` - Migrar estilos
- [ ] `CustomerFormModal` - Migrar a `Dialog` component

**Archivos:**
- `apps/pwa/src/components/customers/CustomerFormModal.tsx`

---

### 2.3 Modales de Inventario
- [ ] `StockReceivedModal` - Migrar estilos
- [ ] `StockReceivedModal` - Migrar a `Dialog` component
- [ ] `StockAdjustModal` - Migrar estilos
- [ ] `StockAdjustModal` - Migrar a `Dialog` component
- [ ] `MovementsModal` - Migrar estilos
- [ ] `MovementsModal` - Migrar a `Dialog` component

**Archivos:**
- `apps/pwa/src/components/inventory/StockReceivedModal.tsx`
- `apps/pwa/src/components/inventory/StockAdjustModal.tsx`
- `apps/pwa/src/components/inventory/MovementsModal.tsx`

---

### 2.4 Modales de Caja
- [ ] `OpenCashModal` - Migrar estilos
- [ ] `OpenCashModal` - Migrar a `Dialog` component
- [ ] `CloseCashModal` - Migrar estilos
- [ ] `CloseCashModal` - Migrar a `Dialog` component
- [ ] `CashSessionDetailModal` - Migrar estilos
- [ ] `CashSessionDetailModal` - Migrar a `Dialog` component

**Archivos:**
- `apps/pwa/src/components/cash/OpenCashModal.tsx`
- `apps/pwa/src/components/cash/CloseCashModal.tsx`
- `apps/pwa/src/components/cash/CashSessionDetailModal.tsx`

---

### 2.5 Modales de Deudas
- [ ] `DebtDetailModal` - Migrar estilos
- [ ] `DebtDetailModal` - Migrar a `Dialog` component
- [ ] `AddPaymentModal` - Migrar estilos
- [ ] `AddPaymentModal` - Migrar a `Dialog` component

**Archivos:**
- `apps/pwa/src/components/debts/DebtDetailModal.tsx`
- `apps/pwa/src/components/debts/AddPaymentModal.tsx`

---

### 2.6 Modales de Ventas
- [ ] `SaleDetailModal` - Migrar estilos
- [ ] `SaleDetailModal` - Migrar a `Dialog` component

**Archivos:**
- `apps/pwa/src/components/sales/SaleDetailModal.tsx`

---

### 2.7 CheckoutModal ✅ (Ya migrado parcialmente)
**Estado actual:** Estilos migrados, falta migrar a Dialog

- [x] Estilos migrados a shadcn/ui
- [ ] Migrar a `Dialog` component (opcional, funciona bien como está)

**Archivos:**
- `apps/pwa/src/components/pos/CheckoutModal.tsx`

---

## 🎨 Fase 3: Refinamiento y Mejoras Avanzadas

### 3.1 Sistema de Notificaciones
- [ ] Instalar `sonner`
- [ ] Reemplazar `react-hot-toast` → `sonner`
- [ ] Actualizar todas las llamadas a `toast.success()` y `toast.error()`
- [ ] Configurar tema y posicionamiento

**Archivos a modificar:**
- Todos los archivos que usan `toast` de `react-hot-toast`

---

### 3.2 Visualización de Datos
- [ ] Instalar `chart` y `recharts`
- [ ] Implementar gráficos en `ReportsPage`
  - [ ] Gráfico de línea: Ventas por día
  - [ ] Gráfico de barras: Métodos de pago
  - [ ] Gráfico de barras: Top productos
- [ ] Implementar gráficos en `CashPage` (opcional)
  - [ ] Gráfico de sesiones de caja

**Archivos a modificar:**
- `apps/pwa/src/pages/ReportsPage.tsx`
- `apps/pwa/src/pages/CashPage.tsx` (opcional)

---

### 3.3 Componentes de Navegación y Búsqueda
- [ ] Instalar `command` o `combobox`
- [ ] Mejorar búsqueda en `POSPage`
  - [ ] Búsqueda con sugerencias
  - [ ] Keyboard navigation
- [ ] Mejorar búsqueda en `ProductsPage`
- [ ] Mejorar búsqueda en `CustomersPage`

**Archivos a modificar:**
- `apps/pwa/src/pages/POSPage.tsx`
- `apps/pwa/src/pages/ProductsPage.tsx`
- `apps/pwa/src/pages/CustomersPage.tsx`

---

### 3.4 Componentes de UI Adicionales
- [ ] Instalar `pagination`
- [ ] Reemplazar paginación custom en `SalesPage`
- [ ] Instalar `empty`
- [ ] Reemplazar estados vacíos en todas las páginas
- [ ] Instalar `hover-card` (opcional)
  - [ ] Preview de productos en `ProductsPage`
  - [ ] Detalles rápidos en `SalesPage`

**Archivos a modificar:**
- `apps/pwa/src/pages/SalesPage.tsx`
- Todas las páginas (estados vacíos)

---

### 3.5 Consistencia Final
- [ ] Revisar todos los colores hardcodeados
  - [ ] Buscar `text-gray-*`, `bg-gray-*`, `border-gray-*`
  - [ ] Reemplazar por variables de tema
- [ ] Revisar todos los botones
  - [ ] Asegurar uso de `Button` component
- [ ] Revisar todos los inputs
  - [ ] Asegurar uso de `Input` component
- [ ] Revisar todos los labels
  - [ ] Asegurar uso de `Label` component
- [ ] Verificar responsive design en todos los componentes
- [ ] Verificar accesibilidad (ARIA labels, keyboard navigation)
- [ ] Testing visual en diferentes tamaños de pantalla

---

## 📊 Progreso General

### Fase 0: Preparación
- [ ] 0/6 Componentes de Alta Prioridad instalados
- [ ] 0/4 Componentes de Media Prioridad instalados
- [ ] 0/5 Componentes de Baja Prioridad instalados (opcional)

### Fase 1: Páginas Principales
- [x] ProductsPage - Estilos migrados
- [ ] ProductsPage - Componentes nuevos
- [x] CustomersPage - Estilos migrados
- [ ] CustomersPage - Componentes nuevos
- [ ] SalesPage - Completo
- [ ] InventoryPage - Completo
- [ ] CashPage - Completo
- [ ] DebtsPage - Completo
- [ ] ReportsPage - Completo
- [x] POSPage - Estilos migrados

### Fase 2: Componentes y Modales
- [x] Modales de Productos - Estilos migrados
- [ ] Modales de Productos - Dialog
- [ ] Modales de Clientes
- [ ] Modales de Inventario
- [ ] Modales de Caja
- [ ] Modales de Deudas
- [ ] Modales de Ventas
- [x] CheckoutModal - Estilos migrados

### Fase 3: Refinamiento
- [ ] Sistema de Notificaciones
- [ ] Visualización de Datos
- [ ] Componentes de Navegación
- [ ] Componentes de UI Adicionales
- [ ] Consistencia Final

---

## 🎯 Priorización Recomendada

### Semana 1: Fundamentos
1. Instalar componentes de Alta Prioridad (Fase 0)
2. Completar `SalesPage` (migración completa)
3. Completar `InventoryPage` (migración completa)

### Semana 2: Páginas Restantes
4. Completar `CashPage`
5. Completar `DebtsPage`
6. Completar `ReportsPage`

### Semana 3: Componentes y Modales
7. Migrar todos los modales a `Dialog`
8. Implementar mejoras en páginas ya migradas

### Semana 4: Refinamiento
9. Agregar gráficos (Chart)
10. Mejorar búsquedas (Command/Combobox)
11. Reemplazar toast (Sonner)
12. Consistencia final y testing

---

## 📝 Notas de Implementación

### Patrón para Migrar Tablas
```tsx
// Antes
<table className="divide-y divide-gray-200">
  <thead className="bg-gray-50">
    <tr>
      <th className="text-gray-700">...</th>
    </tr>
  </thead>
  <tbody className="bg-white">
    <tr className="hover:bg-gray-50">
      <td className="text-gray-900">...</td>
    </tr>
  </tbody>
</table>

// Después
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>...</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>...</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Patrón para Migrar Modales
```tsx
// Antes
<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
  <div className="bg-white rounded-lg max-w-md w-full">
    ...
  </div>
</div>

// Después
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    ...
  </DialogContent>
</Dialog>
```

### Patrón para Date Picker
```tsx
// Antes
<input type="date" value={date} onChange={...} />

// Después
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">
      <CalendarIcon />
      {date ? format(date, "PPP") : "Seleccionar fecha"}
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <Calendar mode="single" selected={date} onSelect={setDate} />
  </PopoverContent>
</Popover>
```

---

## ✅ Checklist de Verificación Final

Antes de considerar completada la migración, verificar:

- [ ] Todos los `text-gray-*` reemplazados
- [ ] Todos los `bg-gray-*` reemplazados
- [ ] Todos los `border-gray-*` reemplazados
- [ ] Todos los botones usan `Button` component
- [ ] Todos los inputs usan `Input` component
- [ ] Todas las tablas usan `Table` component
- [ ] Todos los modales usan `Dialog` component
- [ ] Todos los date inputs usan `Date Picker`
- [ ] Todos los estados vacíos usan `Empty` component
- [ ] Todas las notificaciones usan `Sonner`
- [ ] Responsive design verificado en todas las páginas
- [ ] Accesibilidad verificada (ARIA, keyboard nav)
- [ ] Testing visual completado
- [ ] No hay errores de consola
- [ ] Performance aceptable

---

**Última actualización:** [Fecha]
**Estado:** En progreso
**Próximo paso:** Instalar componentes de Alta Prioridad (Fase 0)
