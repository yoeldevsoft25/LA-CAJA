# 📦 Guía de Implementación: Órdenes de Compra Frontend
## Paso a Paso para Completar la UI de Purchase Orders

**Versión:** 1.0  
**Fecha:** Enero 2025  
**Prioridad:** CRÍTICA  
**Tiempo Estimado:** 14-19 horas

---

## 📋 Tabla de Contenidos

1. [Overview](#overview)
2. [Paso 1: Crear Servicio](#paso-1-crear-servicio)
3. [Paso 2: Crear Tipos TypeScript](#paso-2-crear-tipos-typescript)
4. [Paso 3: Crear Componente FormModal](#paso-3-crear-componente-formmodal)
5. [Paso 4: Crear Componente DetailModal](#paso-4-crear-componente-detailmodal)
6. [Paso 5: Crear Componente ReceptionModal](#paso-5-crear-componente-receptionmodal)
7. [Paso 6: Crear Página Principal](#paso-6-crear-página-principal)
8. [Paso 7: Integración Completa](#paso-7-integración-completa)
9. [Testing y Verificación](#testing-y-verificación)

---

## Overview

### Objetivo
Implementar completamente la interfaz de usuario para gestión de órdenes de compra, integrando con:
- ✅ Backend API (`/purchase-orders/*`)
- ✅ Módulo de Proveedores
- ✅ Módulo de Bodegas
- ✅ Módulo de Inventario (actualización automática)
- ✅ Módulo Contable (asientos automáticos)

### Estructura de Archivos a Crear

```
apps/pwa/src/
├── services/
│   └── purchase-orders.service.ts          # Paso 1
├── components/
│   └── purchase-orders/
│       ├── PurchaseOrderFormModal.tsx      # Paso 3
│       ├── PurchaseOrderDetailModal.tsx    # Paso 4
│       └── PurchaseOrderReceptionModal.tsx # Paso 5
└── pages/
    └── PurchaseOrdersPage.tsx              # Paso 6
```

---

## Paso 1: Crear Servicio

### Archivo: `apps/pwa/src/services/purchase-orders.service.ts`

**Referencia:** `apps/pwa/src/services/transfers.service.ts` o `warehouses.service.ts`

```typescript
import { api } from '@/lib/api'

// Tipos (definir según respuesta del backend)
export interface PurchaseOrder {
  id: string
  order_number: string
  supplier_id: string
  supplier?: {
    id: string
    name: string
    code?: string
  }
  warehouse_id: string | null
  warehouse?: {
    id: string
    name: string
    code?: string
  }
  status: 'draft' | 'sent' | 'confirmed' | 'completed' | 'cancelled'
  expected_delivery_date: string | null
  requested_at: string
  requested_by?: string
  requested_by_user?: {
    id: string
    full_name: string
  }
  sent_at: string | null
  confirmed_at: string | null
  received_at: string | null
  received_by?: string
  received_by_user?: {
    id: string
    full_name: string
  }
  total_amount_bs: number
  total_amount_usd: number
  items: PurchaseOrderItem[]
  note?: string
  cancelled_at?: string | null
  cancellation_reason?: string | null
}

export interface PurchaseOrderItem {
  id: string
  product_id: string
  product?: {
    id: string
    name: string
    sku?: string
    barcode?: string
  }
  quantity: number
  quantity_received: number
  unit_cost_bs: number
  unit_cost_usd: number
  total_cost_bs: number
  total_cost_usd: number
}

export type PurchaseOrderStatus = 'draft' | 'sent' | 'confirmed' | 'completed' | 'cancelled'

export interface CreatePurchaseOrderDto {
  supplier_id: string
  warehouse_id?: string | null
  expected_delivery_date?: string | null
  items: CreatePurchaseOrderItemDto[]
  note?: string
}

export interface CreatePurchaseOrderItemDto {
  product_id: string
  quantity: number
  unit_cost_bs: number
  unit_cost_usd: number
}

export interface UpdatePurchaseOrderDto {
  supplier_id?: string
  warehouse_id?: string | null
  expected_delivery_date?: string | null
  items?: CreatePurchaseOrderItemDto[]
  note?: string
}

export interface ReceivePurchaseOrderDto {
  items: ReceivePurchaseOrderItemDto[]
  note?: string
}

export interface ReceivePurchaseOrderItemDto {
  quantity_received: number
}

export interface CancelPurchaseOrderDto {
  reason?: string
}

export const purchaseOrdersService = {
  /**
   * Obtiene todas las órdenes de compra
   */
  async getAll(
    status?: PurchaseOrderStatus,
    supplierId?: string,
    warehouseId?: string
  ): Promise<PurchaseOrder[]> {
    const params: Record<string, string> = {}
    if (status) params.status = status
    if (supplierId) params.supplier_id = supplierId
    if (warehouseId) params.warehouse_id = warehouseId

    const response = await api.get<PurchaseOrder[]>('/purchase-orders', { params })
    return response.data
  },

  /**
   * Obtiene una orden de compra por ID
   */
  async getById(id: string): Promise<PurchaseOrder> {
    const response = await api.get<PurchaseOrder>(`/purchase-orders/${id}`)
    return response.data
  },

  /**
   * Crea una nueva orden de compra
   */
  async create(data: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    const response = await api.post<PurchaseOrder>('/purchase-orders', data)
    return response.data
  },

  /**
   * Actualiza una orden de compra (solo si está en estado draft)
   */
  async update(id: string, data: UpdatePurchaseOrderDto): Promise<PurchaseOrder> {
    const response = await api.put<PurchaseOrder>(`/purchase-orders/${id}`, data)
    return response.data
  },

  /**
   * Envía una orden al proveedor (cambia estado de draft a sent)
   */
  async send(id: string): Promise<PurchaseOrder> {
    const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/send`)
    return response.data
  },

  /**
   * Confirma una orden (cambia estado de sent a confirmed)
   */
  async confirm(id: string): Promise<PurchaseOrder> {
    const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/confirm`)
    return response.data
  },

  /**
   * Recibe una orden de compra (cambia estado a completed y actualiza inventario)
   */
  async receive(id: string, data: ReceivePurchaseOrderDto): Promise<PurchaseOrder> {
    const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/receive`, data)
    return response.data
  },

  /**
   * Cancela una orden de compra
   */
  async cancel(id: string, data?: CancelPurchaseOrderDto): Promise<PurchaseOrder> {
    const response = await api.post<PurchaseOrder>(`/purchase-orders/${id}/cancel`, data)
    return response.data
  },
}
```

**Verificación:**
- ✅ Tipos TypeScript completos
- ✅ Todos los endpoints del backend cubiertos
- ✅ Manejo de errores delegado a llamadas (api.get, api.post, etc.)

---

## Paso 2: Verificar Tipos TypeScript

### Verificar Tipos del Backend

**Archivo:** `apps/api/src/purchase-orders/dto/create-purchase-order.dto.ts`

Revisar DTOs del backend para asegurar que los tipos frontend coincidan. Si hay discrepancias, ajustar los tipos en el servicio.

**Tipos críticos a verificar:**
- Estructura de `PurchaseOrder`
- Estructura de `PurchaseOrderItem`
- Valores de `status` enum
- Campos opcionales vs requeridos

---

## Paso 3: Crear Componente FormModal

### Archivo: `apps/pwa/src/components/purchase-orders/PurchaseOrderFormModal.tsx`

**Referencia:** `apps/pwa/src/pages/TransfersPage.tsx` (modal de crear transferencia)

**Funcionalidades:**
- Crear nueva orden de compra
- Editar orden existente (solo si está en estado `draft`)
- Formulario con:
  - Selector de proveedor (con búsqueda)
  - Selector de bodega (opcional)
  - Date picker para fecha esperada de entrega
  - Lista dinámica de items (producto, cantidad, costos)
  - Campo de notas
- Validaciones:
  - Proveedor requerido
  - Al menos un item
  - Cantidades > 0
  - Costos >= 0

**Implementación Base:**

```typescript
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { X, Plus } from 'lucide-react'
import { purchaseOrdersService, CreatePurchaseOrderDto, PurchaseOrder } from '@/services/purchase-orders.service'
import { suppliersService } from '@/services/suppliers.service'
import { warehousesService } from '@/services/warehouses.service'
import { productsService, Product } from '@/services/products.service'
import toast from 'react-hot-toast'

const itemSchema = z.object({
  product_id: z.string().min(1, 'Producto requerido'),
  quantity: z.number().positive('Cantidad debe ser mayor a 0'),
  unit_cost_bs: z.number().min(0, 'Costo debe ser >= 0'),
  unit_cost_usd: z.number().min(0, 'Costo debe ser >= 0'),
})

const formSchema = z.object({
  supplier_id: z.string().min(1, 'Proveedor requerido'),
  warehouse_id: z.string().nullable().optional(),
  expected_delivery_date: z.string().nullable().optional(),
  note: z.string().optional(),
}).refine(() => true) // Validar items por separado

type FormData = z.infer<typeof formSchema>

interface PurchaseOrderItemForm {
  product_id: string
  quantity: number
  unit_cost_bs: number
  unit_cost_usd: number
  product?: Product
}

interface PurchaseOrderFormModalProps {
  isOpen: boolean
  onClose: () => void
  order?: PurchaseOrder | null
  onSuccess?: () => void
}

export default function PurchaseOrderFormModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: PurchaseOrderFormModalProps) {
  const queryClient = useQueryClient()
  const isEditing = !!order
  
  // Estados
  const [items, setItems] = useState<PurchaseOrderItemForm[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('')
  const [note, setNote] = useState<string>('')

  // Queries
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersService.getAll(),
    enabled: isOpen,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(),
    enabled: isOpen,
  })

  const { data: productsData } = useQuery({
    queryKey: ['products', 'search', productSearch],
    queryFn: () => productsService.search({ q: productSearch, limit: 20 }),
    enabled: productSearch.length >= 2,
  })

  // Cargar datos si es edición
  useEffect(() => {
    if (order && isOpen) {
      setSelectedSupplierId(order.supplier_id)
      setSelectedWarehouseId(order.warehouse_id || '')
      setExpectedDeliveryDate(order.expected_delivery_date || '')
      setNote(order.note || '')
      setItems(
        order.items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost_bs: Number(item.unit_cost_bs),
          unit_cost_usd: Number(item.unit_cost_usd),
          product: item.product,
        }))
      )
    } else if (isOpen) {
      // Reset para nueva orden
      setSelectedSupplierId('')
      setSelectedWarehouseId('')
      setExpectedDeliveryDate('')
      setNote('')
      setItems([])
    }
  }, [order, isOpen])

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreatePurchaseOrderDto) => purchaseOrdersService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Orden de compra creada exitosamente')
      onClose()
      onSuccess?.()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al crear la orden de compra'
      toast.error(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: CreatePurchaseOrderDto) => {
      if (!order) throw new Error('Order is required for update')
      return purchaseOrdersService.update(order.id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Orden de compra actualizada exitosamente')
      onClose()
      onSuccess?.()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al actualizar la orden de compra'
      toast.error(message)
    },
  })

  // Handlers
  const addItem = (product: Product) => {
    const existingItem = items.find((item) => item.product_id === product.id)
    if (existingItem) {
      setItems(
        items.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      )
    } else {
      setItems([
        ...items,
        {
          product_id: product.id,
          quantity: 1,
          unit_cost_bs: Number(product.cost_bs) || 0,
          unit_cost_usd: Number(product.cost_usd) || 0,
          product,
        },
      ])
    }
    setProductSearch('')
  }

  const removeItem = (productId: string) => {
    setItems(items.filter((item) => item.product_id !== productId))
  }

  const updateItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId)
    } else {
      setItems(
        items.map((item) =>
          item.product_id === productId ? { ...item, quantity } : item
        )
      )
    }
  }

  const updateItemCost = (
    productId: string,
    field: 'unit_cost_bs' | 'unit_cost_usd',
    value: number
  ) => {
    setItems(
      items.map((item) =>
        item.product_id === productId ? { ...item, [field]: value } : item
      )
    )
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Validaciones
    if (!selectedSupplierId) {
      toast.error('Selecciona un proveedor')
      return
    }

    if (items.length === 0) {
      toast.error('Agrega al menos un producto')
      return
    }

    // Validar items
    for (const item of items) {
      if (item.quantity <= 0) {
        toast.error(`La cantidad de ${item.product?.name || 'producto'} debe ser mayor a 0`)
        return
      }
      if (item.unit_cost_bs < 0 || item.unit_cost_usd < 0) {
        toast.error(`Los costos de ${item.product?.name || 'producto'} deben ser >= 0`)
        return
      }
    }

    const data: CreatePurchaseOrderDto = {
      supplier_id: selectedSupplierId,
      warehouse_id: selectedWarehouseId || null,
      expected_delivery_date: expectedDeliveryDate || null,
      items: items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost_bs: item.unit_cost_bs,
        unit_cost_usd: item.unit_cost_usd,
      })),
      note: note || undefined,
    }

    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  // Calcular totales
  const totalBs = items.reduce((sum, item) => sum + item.quantity * item.unit_cost_bs, 0)
  const totalUsd = items.reduce((sum, item) => sum + item.quantity * item.unit_cost_usd, 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica la información de la orden de compra'
              : 'Crea una nueva orden de compra para un proveedor'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Proveedor y Bodega */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier">Proveedor *</Label>
              <Select
                value={selectedSupplierId}
                onValueChange={setSelectedSupplierId}
                required
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers
                    .filter((s) => s.is_active)
                    .map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name} {supplier.code && `(${supplier.code})`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="warehouse">Bodega</Label>
              <Select
                value={selectedWarehouseId}
                onValueChange={setSelectedWarehouseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una bodega (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Ninguna</SelectItem>
                  {warehouses
                    .filter((w) => w.is_active)
                    .map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fecha esperada de entrega */}
          <div>
            <Label htmlFor="expected_delivery_date">Fecha Esperada de Entrega</Label>
            <Input
              id="expected_delivery_date"
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            />
          </div>

          {/* Items */}
          <div>
            <Label>Productos *</Label>
            <div className="space-y-2 mt-2">
              {/* Búsqueda de productos */}
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Buscar producto..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                {productSearch.length >= 2 && productsData?.products && (
                  <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {productsData.products.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addItem(product)}
                        className="w-full text-left px-4 py-2 hover:bg-accent transition-colors"
                      >
                        <p className="font-medium">{product.name}</p>
                        {product.sku && (
                          <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista de items */}
              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map((item) => {
                    const product = item.product || productsData?.products.find((p) => p.id === item.product_id)
                    return (
                      <Card key={item.product_id}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium">
                                {product?.name || 'Producto'}
                              </p>
                              {product?.sku && (
                                <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col gap-1">
                                <Label className="text-xs">Cantidad</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateItemQuantity(
                                      item.product_id,
                                      parseInt(e.target.value) || 1
                                    )
                                  }
                                  className="w-20"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <Label className="text-xs">Costo BS</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unit_cost_bs}
                                  onChange={(e) =>
                                    updateItemCost(
                                      item.product_id,
                                      'unit_cost_bs',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-24"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <Label className="text-xs">Costo USD</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unit_cost_usd}
                                  onChange={(e) =>
                                    updateItemCost(
                                      item.product_id,
                                      'unit_cost_usd',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-24"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(item.product_id)}
                                className="h-8 w-8"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Totales */}
          {items.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total:</span>
                  <div className="text-right">
                    <div className="font-bold">Bs. {totalBs.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">
                      ${totalUsd.toFixed(2)} USD
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notas */}
          <div>
            <Label htmlFor="note">Notas</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Guardando...'
                : isEditing
                ? 'Actualizar'
                : 'Crear Orden'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Verificación:**
- ✅ Formulario completo con todos los campos
- ✅ Validaciones funcionando
- ✅ Integración con servicios (suppliers, warehouses, products)
- ✅ Manejo de estados (crear/editar)

---

## Paso 4: Crear Componente DetailModal

### Archivo: `apps/pwa/src/components/purchase-orders/PurchaseOrderDetailModal.tsx`

**Referencia:** Modal de detalle en `TransfersPage.tsx`

**Funcionalidades:**
- Mostrar información completa de la orden
- Mostrar items con cantidades
- Mostrar historial (fechas de envío, confirmación, recepción)
- Acciones según estado:
  - `draft`: Editar, Enviar, Cancelar
  - `sent`: Confirmar, Cancelar
  - `confirmed`: Recibir, Cancelar
  - `completed`: Solo visualización
  - `cancelled`: Solo visualización

**Implementación:** (Similar a DetailModal de Transfers, adaptar para Purchase Orders)

---

## Paso 5: Crear Componente ReceptionModal

### Archivo: `apps/pwa/src/components/purchase-orders/PurchaseOrderReceptionModal.tsx`

**Referencia:** Modal de recepción en `TransfersPage.tsx`

**Funcionalidades:**
- Mostrar items de la orden con cantidades solicitadas
- Input para cantidad recibida de cada item
- Validación: recibida <= solicitada
- Opción de recepción parcial
- Campo de notas

**Implementación:** (Similar a ReceiveModal de Transfers, adaptar para Purchase Orders)

---

## Paso 6: Crear Página Principal

### Archivo: `apps/pwa/src/pages/PurchaseOrdersPage.tsx`

**Referencia:** `apps/pwa/src/pages/TransfersPage.tsx`

**Estructura:**
1. Header con título y botón "Nueva Orden"
2. Filtros (Card): Estado, Proveedor, Bodega
3. Lista de órdenes (Cards o Table)
4. Modales integrados

**Pasos:**
1. Copiar estructura base de `TransfersPage.tsx`
2. Adaptar para Purchase Orders
3. Integrar todos los componentes creados
4. Agregar filtros apropiados
5. Agregar acciones según estado

---

## Paso 7: Integración Completa

### 7.1 Agregar Ruta

**Archivo:** `apps/pwa/src/App.tsx`

```typescript
import PurchaseOrdersPage from './pages/PurchaseOrdersPage'

// En Routes:
<Route path="purchase-orders" element={<PurchaseOrdersPage />} />
```

### 7.2 Agregar al Menú

**Archivo:** `apps/pwa/src/components/layout/MainLayout.tsx`

Agregar en sección "Productos e Inventario":
```typescript
{ path: '/purchase-orders', label: 'Órdenes de Compra', icon: ShoppingBag, badge: null },
```

### 7.3 Integración con SuppliersPage

Agregar botón "Nueva Orden" que abra modal con proveedor preseleccionado:
```typescript
<Button onClick={() => navigate(`/purchase-orders?supplier_id=${supplier.id}`)}>
  Nueva Orden
</Button>
```

### 7.4 Integración con WarehousesPage

Similar para bodegas.

---

## Testing y Verificación

### Checklist de Verificación

#### Funcionalidad Básica
- [ ] Crear nueva orden de compra
- [ ] Editar orden en estado draft
- [ ] Enviar orden (draft → sent)
- [ ] Confirmar orden (sent → confirmed)
- [ ] Recibir orden (confirmed → completed)
- [ ] Cancelar orden en cualquier estado

#### Validaciones
- [ ] Validar que proveedor es requerido
- [ ] Validar que al menos un item es requerido
- [ ] Validar cantidades > 0
- [ ] Validar costos >= 0
- [ ] Validar recepción: cantidad recibida <= cantidad solicitada

#### Integraciones
- [ ] Verificar que al recibir orden se actualiza inventario
- [ ] Verificar que se crea asiento contable automáticamente
- [ ] Verificar que se actualizan KPIs en dashboard
- [ ] Verificar que se muestran órdenes en SuppliersPage
- [ ] Verificar que se muestran órdenes en WarehousesPage

#### UX/UI
- [ ] Loading states funcionan
- [ ] Mensajes de error son claros
- [ ] Mensajes de éxito aparecen
- [ ] Navegación es intuitiva
- [ ] Diseño responsive funciona

---

## Notas Finales

### Consideraciones

1. **Offline-First**: Las mutaciones funcionan offline automáticamente (backend maneja eventos)
2. **Multi-moneda**: Siempre mostrar BS y USD
3. **Estados**: Respetar estados y transiciones válidas
4. **Permisos**: Considerar permisos de usuario (backend maneja esto)

### Próximos Pasos

Después de completar esta implementación:
1. Probar flujo completo end-to-end
2. Verificar integraciones
3. Ajustar UX según feedback
4. Documentar casos de uso

---

**Última actualización:** Enero 2025  
**Estado:** Guía de implementación - Lista para ejecutar

