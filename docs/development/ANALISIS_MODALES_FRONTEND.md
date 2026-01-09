# 📋 Análisis Completo de Relaciones entre Modales - Frontend

**Fecha:** Enero 2025  
**Analista:** Senior Frontend Developer  
**Alcance:** Todos los modales en `apps/pwa/src/components`

---

## 📊 Resumen Ejecutivo

### Estado General: **75/100** ⚠️

**Fortalezas:**
- ✅ Estructura de modales bien definida
- ✅ Uso consistente de Dialog de Radix UI
- ✅ Separación clara de responsabilidades

**Problemas Críticos:**
- 🔴 **Falta limpieza de estado en varios modales**
- 🔴 **Inconsistencia en manejo de onSuccess**
- 🟡 **Modales anidados sin coordinación adecuada**
- 🟡 **Falta invalidación de queries en algunos casos**

---

## 🔍 Análisis por Categoría

### 1. Modales Anidados (Modal dentro de Modal)

#### ✅ **Bien Implementados:**

**PurchaseOrderDetailModal → PurchaseOrderReceptionModal / PurchaseOrderFormModal**
```tsx
// ✅ CORRECTO: Cierra modal padre cuando hijo tiene éxito
<PurchaseOrderReceptionModal
  onSuccess={() => {
    setIsReceptionOpen(false)
    onClose()  // Cierra modal padre
    onSuccess?.()
  }}
/>
```

**SaleDetailModal → CreateFiscalInvoiceFromSaleModal**
```tsx
// ✅ CORRECTO: Maneja estado interno correctamente
const [showCreateModal, setShowCreateModal] = useState(false)
// ✅ Refresca datos después de crear
const handleCreateSuccess = () => {
  setShowCreateModal(false)
  // Refresca query automáticamente
}
```

#### ⚠️ **Problemas Detectados:**

**OrderModal → OrderItemModal / PartialPaymentModal / CheckoutModal**
```tsx
// ⚠️ PROBLEMA: No invalida queries después de acciones
<OrderItemModal
  onConfirm={handleAddItem}  // ✅ OK
  // ❌ FALTA: No invalida queries en onSuccess
/>

<PartialPaymentModal
  onConfirm={handlePartialPayment}  // ✅ OK
  // ❌ FALTA: No invalida queries en onSuccess
/>
```

**DebtDetailModal → AddPaymentModal**
```tsx
// ⚠️ PROBLEMA: Cierra modal padre pero no refresca datos
<AddPaymentModal
  onSuccess={() => {
    setIsDetailOpen(false)  // ❌ Cierra modal padre
    setIsPaymentOpen(false)
    setSelectedDebt(null)
    // ✅ Invalida queries (OK)
  }}
/>
```

---

### 2. Limpieza de Estado

#### ✅ **Bien Implementados:**

**CheckoutModal**
```tsx
// ✅ EXCELENTE: Limpia TODO cuando se cierra
useEffect(() => {
  if (!isOpen) {
    setCustomerName('')
    setCustomerDocumentId('')
    // ... limpia todos los estados
  }
}, [isOpen])
```

**AddPaymentModal**
```tsx
// ✅ CORRECTO: Resetea form cuando se abre
useEffect(() => {
  if (isOpen && debtId) {
    reset({ /* valores por defecto */ })
  }
}, [isOpen, debtId, reset])
```

#### 🔴 **Problemas Críticos:**

**ProductFormModal**
```tsx
// ❌ PROBLEMA: Solo resetea cuando cambia `product`, no cuando se cierra
useEffect(() => {
  if (product) {
    reset({ /* datos del producto */ })
  } else {
    reset({ /* valores por defecto */ })
  }
}, [product, reset])  // ❌ Falta dependencia de isOpen

// ✅ SOLUCIÓN:
useEffect(() => {
  if (!isOpen) {
    reset({ /* valores por defecto */ })
    return
  }
  if (product) {
    reset({ /* datos del producto */ })
  } else {
    reset({ /* valores por defecto */ })
  }
}, [isOpen, product, reset])
```

**EntryFormModal**
```tsx
// ❌ PROBLEMA: Mismo patrón - no limpia al cerrar
useEffect(() => {
  if (entry) {
    reset({ /* datos del asiento */ })
  } else {
    reset({ /* valores por defecto */ })
  }
}, [entry, reset])  // ❌ Falta limpieza cuando isOpen = false
```

**CustomerFormModal**
```tsx
// ❌ PROBLEMA: No limpia cuando se cierra sin editar
useEffect(() => {
  if (customer) {
    reset({ /* datos del cliente */ })
  } else {
    reset({ /* valores por defecto */ })
  }
}, [customer, reset])  // ❌ Falta limpieza al cerrar
```

---

### 3. Invalidación de Queries

#### ✅ **Bien Implementados:**

**AccountingPage**
```tsx
// ✅ CORRECTO: Invalida queries después de acciones
<EntryFormModal
  onSuccess={() => {
    setIsEntryFormOpen(false)
    queryClient.invalidateQueries({ queryKey: ['accounting', 'entries'] })
  }}
/>
```

**InventoryPage**
```tsx
// ✅ CORRECTO: Invalida queries y limpia estado
<StockReceivedModal
  onSuccess={() => {
    queryClient.invalidateQueries({ queryKey: ['inventory'] })
    handleCloseModals()  // Limpia todos los modales
  }}
/>
```

#### ⚠️ **Problemas Detectados:**

**ProductsPage**
```tsx
// ⚠️ PROBLEMA: Invalida queries pero no refresca stock
<ProductFormModal
  onSuccess={() => {
    queryClient.invalidateQueries({ queryKey: ['products'] })
    handleCloseForm()
    // ❌ FALTA: No invalida ['inventory', 'status']
  }}
/>
```

**SalesPage**
```tsx
// ⚠️ PROBLEMA: No invalida queries después de ver detalle
<SaleDetailModal
  isOpen={isDetailModalOpen}
  onClose={handleCloseDetail}
  sale={selectedSale}
  // ❌ FALTA: onSuccess para invalidar queries si se crea factura fiscal
/>
```

---

### 4. Coordinación entre Modales

#### ✅ **Bien Implementados:**

**DebtsPage**
```tsx
// ✅ EXCELENTE: Coordinación perfecta entre modales
const handleDetailAddPayment = () => {
  setIsDetailOpen(false)  // Cierra modal de detalle
  setIsPaymentOpen(true)  // Abre modal de pago
}

<DebtDetailModal
  onAddPayment={handleDetailAddPayment}  // ✅ Callback coordinado
/>

<AddPaymentModal
  onSuccess={handlePaymentSuccess}  // ✅ Invalida y limpia
/>
```

#### ⚠️ **Problemas Detectados:**

**PurchaseOrdersPage**
```tsx
// ⚠️ PROBLEMA: Modal de detalle puede abrir edición, pero no coordina bien
<PurchaseOrderDetailModal
  onSuccess={() => {
    handleCloseDetail()  // ✅ Cierra
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
    // ⚠️ PERO: Si se edita desde el detalle, el detalle se cierra
    // y no se vuelve a abrir con los datos actualizados
  }}
/>
```

**TablesPage → OrderModal**
```tsx
// ⚠️ PROBLEMA: OrderModal puede abrir CheckoutModal, pero:
<CheckoutModal
  onConfirm={(data) => {
    handleCloseOrder(saleData)
    setIsCloseModalOpen(false)  // ✅ Cierra checkout
    // ⚠️ PERO: OrderModal también se cierra, pero no se refresca
    // la lista de órdenes abiertas inmediatamente
  }}
/>
```

---

### 5. Patrones Inconsistentes

#### 🔴 **Inconsistencias Críticas:**

**1. Nombres de Props:**
- ✅ Mayoría usa: `isOpen`, `onClose`, `onSuccess`
- ❌ Algunos usan: `open` (CleanDuplicatesModal, ImportCSVModal)

**2. Manejo de onSuccess:**
- ✅ Algunos: `onSuccess?.()` y luego `onClose()`
- ❌ Otros: Solo `onSuccess?.()` sin cerrar
- ❌ Otros: Cierran pero no llaman `onSuccess?.()`

**3. Limpieza de Estado:**
- ✅ Algunos: Limpian en `useEffect(() => { if (!isOpen) ... }, [isOpen])`
- ❌ Otros: Solo limpian cuando cambia el prop (product, order, etc.)
- ❌ Otros: No limpian nunca

**4. Invalidación de Queries:**
- ✅ Algunos: Invalidan en `onSuccess`
- ⚠️ Otros: Invalidan en el componente padre
- ❌ Otros: No invalidan

---

## 🐛 Problemas Específicos por Modal

### 🔴 **Críticos (Deben Arreglarse)**

1. **ProductFormModal**
   - ❌ No limpia formulario cuando se cierra sin guardar
   - ❌ No invalida queries de inventario después de crear/editar

2. **EntryFormModal**
   - ❌ No limpia formulario cuando se cierra
   - ❌ No resetea `balanceError` cuando se cierra

3. **CustomerFormModal**
   - ❌ No limpia formulario cuando se cierra sin guardar

4. **OrderModal**
   - ⚠️ Después de cerrar orden, no refresca lista de órdenes abiertas
   - ⚠️ Después de pago parcial, no refresca totales inmediatamente

5. **SaleDetailModal**
   - ⚠️ Después de crear factura fiscal, no refresca la factura en el modal

### 🟡 **Medios (Mejoras Recomendadas)**

6. **PurchaseOrderDetailModal**
   - ⚠️ Después de editar, debería refrescar datos del modal
   - ⚠️ Después de recibir, debería actualizar estado visual

7. **DebtDetailModal → AddPaymentModal**
   - ⚠️ Cierra modal padre cuando debería mantenerlo abierto y refrescar

8. **AccountingPage - EntryDetailModal**
   - ⚠️ Después de postear/cancelar, debería refrescar datos del modal

9. **ProductsPage - Varios Modales**
   - ⚠️ ChangePriceModal no invalida queries
   - ⚠️ BulkPriceChangeModal no invalida queries de inventario

### 🟢 **Menores (Optimizaciones)**

10. **Inconsistencia en nombres de props**
    - Algunos modales usan `open` en lugar de `isOpen`

11. **Falta de loading states**
    - Algunos modales no muestran loading durante mutaciones

12. **Falta de manejo de errores**
    - Algunos modales no manejan errores de mutación correctamente

---

## 📋 Checklist de Verificación

### Para Cada Modal:

- [ ] ¿Limpia el estado cuando `isOpen` cambia a `false`?
- [ ] ¿Resetea el formulario cuando se cierra?
- [ ] ¿Invalida las queries necesarias en `onSuccess`?
- [ ] ¿Cierra el modal padre si es anidado?
- [ ] ¿Mantiene el modal padre abierto si es necesario refrescar datos?
- [ ] ¿Maneja errores de mutación correctamente?
- [ ] ¿Muestra estados de loading durante operaciones?
- [ ] ¿Usa nombres de props consistentes (`isOpen`, `onClose`, `onSuccess`)?

---

## 🔧 Recomendaciones de Mejora

### 1. **Crear Hook Personalizado para Modales**

```typescript
// hooks/use-modal-form.ts
export function useModalForm<T>({
  isOpen,
  defaultValues,
  entity,
  onSuccess,
  onClose,
}: UseModalFormOptions<T>) {
  const form = useForm<T>({ defaultValues })
  const queryClient = useQueryClient()

  // Limpiar cuando se cierra
  useEffect(() => {
    if (!isOpen) {
      form.reset(defaultValues)
    }
  }, [isOpen, form, defaultValues])

  // Cargar datos cuando se abre con entidad
  useEffect(() => {
    if (isOpen && entity) {
      form.reset(entity)
    } else if (isOpen) {
      form.reset(defaultValues)
    }
  }, [isOpen, entity, form, defaultValues])

  const handleSuccess = useCallback(() => {
    onSuccess?.()
    onClose()
  }, [onSuccess, onClose])

  return { form, handleSuccess, queryClient }
}
```

### 2. **Estandarizar Patrón de Modales Anidados**

```typescript
// Patrón recomendado para modales anidados
const [isChildModalOpen, setIsChildModalOpen] = useState(false)

<ChildModal
  isOpen={isChildModalOpen}
  onClose={() => setIsChildModalOpen(false)}
  onSuccess={() => {
    setIsChildModalOpen(false)
    // Opción A: Cerrar modal padre y refrescar
    queryClient.invalidateQueries({ queryKey: ['parent-data'] })
    onClose()
    onSuccess?.()
    
    // Opción B: Mantener modal padre abierto y refrescar
    // queryClient.invalidateQueries({ queryKey: ['parent-data'] })
    // refetchParentData()
  }}
/>
```

### 3. **Invalidación de Queries Estandarizada**

```typescript
// Crear función helper
const invalidateRelatedQueries = (entityType: string) => {
  const queries: Record<string, string[][]> = {
    product: [
      ['products'],
      ['inventory', 'status'],
      ['inventory', 'stock-status'],
    ],
    sale: [
      ['sales'],
      ['orders', 'open'],
      ['debts'],
    ],
    // ... más mapeos
  }
  
  const toInvalidate = queries[entityType] || []
  toInvalidate.forEach(queryKey => {
    queryClient.invalidateQueries({ queryKey })
  })
}
```

---

## 🎯 Prioridades de Corrección

### 🔴 **Alta Prioridad (Esta Semana)**

1. **ProductFormModal**: Agregar limpieza de estado al cerrar
2. **EntryFormModal**: Agregar limpieza de estado al cerrar
3. **CustomerFormModal**: Agregar limpieza de estado al cerrar
4. **OrderModal**: Mejorar invalidación de queries después de acciones
5. **SaleDetailModal**: Refrescar factura fiscal después de crear

### 🟡 **Media Prioridad (Próximas 2 Semanas)**

6. Estandarizar nombres de props (`open` → `isOpen`)
7. Crear hook `useModalForm` para reutilización
8. Mejorar coordinación entre modales anidados
9. Agregar invalidación de queries relacionadas

### 🟢 **Baja Prioridad (Mejoras Continuas)**

10. Agregar loading states consistentes
11. Mejorar manejo de errores
12. Documentar patrones de modales

---

## 📝 Ejemplos de Correcciones Necesarias

### Ejemplo 1: ProductFormModal

**Antes:**
```tsx
useEffect(() => {
  if (product) {
    reset({ /* datos */ })
  } else {
    reset({ /* defaults */ })
  }
}, [product, reset])
```

**Después:**
```tsx
useEffect(() => {
  if (!isOpen) {
    reset({ /* defaults */ })
    return
  }
  if (product) {
    reset({ /* datos */ })
  } else {
    reset({ /* defaults */ })
  }
}, [isOpen, product, reset])

// Y en onSuccess:
onSuccess={() => {
  queryClient.invalidateQueries({ queryKey: ['products'] })
  queryClient.invalidateQueries({ queryKey: ['inventory', 'status'] })
  onClose()
}}
```

### Ejemplo 2: SaleDetailModal

**Antes:**
```tsx
const handleCreateSuccess = () => {
  setShowCreateModal(false)
  // No refresca factura fiscal
}
```

**Después:**
```tsx
const handleCreateSuccess = () => {
  setShowCreateModal(false)
  queryClient.invalidateQueries({ 
    queryKey: ['fiscal-invoices', 'by-sale', sale?.id] 
  })
}
```

---

## ✅ Conclusión

El sistema de modales está **funcionalmente completo** pero tiene **inconsistencias importantes** en:

1. **Limpieza de estado** (crítico)
2. **Invalidación de queries** (importante)
3. **Coordinación entre modales anidados** (mejorable)
4. **Estandarización de patrones** (recomendado)

**Recomendación:** Implementar las correcciones de alta prioridad primero, luego crear hooks reutilizables para estandarizar el comportamiento.
