import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  purchaseOrdersService,
  CreatePurchaseOrderDto,
  PurchaseOrder,
} from '@/services/purchase-orders.service'
import { suppliersService } from '@/services/suppliers.service'
import { warehousesService } from '@/services/warehouses.service'
import { productsService, Product } from '@la-caja/app-core'
import { useAuth } from '@/stores/auth.store'
import toast from '@/lib/toast'

interface PurchaseOrderItemForm {
  product_id: string
  variant_id?: string | null
  quantity: number
  unit_cost_bs: number
  unit_cost_usd: number
  product?: Product
}

interface PurchaseOrderFormModalProps {
  isOpen: boolean
  onClose: () => void
  order?: PurchaseOrder | null
  initialSupplierId?: string
  initialProducts?: Array<{ product_id: string; quantity?: number }> // Productos para pre-llenar (ej: desde stock bajo)
  onSuccess?: () => void
}

export default function PurchaseOrderFormModal({
  isOpen,
  onClose,
  order,
  initialSupplierId,
  initialProducts,
  onSuccess,
}: PurchaseOrderFormModalProps) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
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
    queryFn: () => productsService.search({ q: productSearch, limit: 20 }, user?.store_id),
    enabled: isOpen && productSearch.length >= 2 && !!user?.store_id,
    staleTime: 1000 * 60 * 5,
  })

  // Cargar datos si es edición o si hay productos iniciales
  useEffect(() => {
    if (order && isOpen) {
      setSelectedSupplierId(order.supplier_id)
      setSelectedWarehouseId(order.warehouse_id || '')
      setExpectedDeliveryDate(
        order.expected_delivery_date
          ? new Date(order.expected_delivery_date).toISOString().split('T')[0]
          : ''
      )
      setNote(order.note || '')
      setItems(
        order.items.map((item) => {
          // Buscar el producto completo si existe en la respuesta
          const fullProduct = item.product
          return {
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            quantity: item.quantity,
            unit_cost_bs: Number(item.unit_cost_bs),
            unit_cost_usd: Number(item.unit_cost_usd),
            product: fullProduct ? ({
              id: fullProduct.id,
              name: fullProduct.name,
              sku: fullProduct.sku || null,
              barcode: fullProduct.barcode || null,
            } as Product) : undefined,
          }
        })
      )
    } else if (isOpen) {
      // Reset para nueva orden
      setSelectedSupplierId(initialSupplierId || '')
      setSelectedWarehouseId('')
      setExpectedDeliveryDate('')
      setNote('')
      setItems([])
      setProductSearch('')
    }
  }, [order, isOpen, initialSupplierId])

  // Cargar productos iniciales cuando se abre el modal
  useEffect(() => {
    if (!isOpen || order || !initialProducts || initialProducts.length === 0) return
    if (!user?.store_id) return

    const loadInitialProducts = async () => {
      try {
        const loadedItems: PurchaseOrderItemForm[] = []
        
        for (const { product_id, quantity = 1 } of initialProducts) {
          try {
            const product = await productsService.getById(product_id, user.store_id)
            loadedItems.push({
              product_id: product.id,
              variant_id: null,
              quantity,
              unit_cost_bs: Number(product.cost_bs) || 0,
              unit_cost_usd: Number(product.cost_usd) || 0,
              product,
            })
          } catch (error) {
            console.warn(`[PurchaseOrderFormModal] No se pudo cargar producto ${product_id}:`, error)
            // Continuar con los demás productos
          }
        }

        if (loadedItems.length > 0) {
          setItems(loadedItems)
          toast.success(`${loadedItems.length} producto(s) agregado(s) desde stock bajo`)
        }
      } catch (error) {
        console.error('[PurchaseOrderFormModal] Error cargando productos iniciales:', error)
        toast.error('Error al cargar productos iniciales')
      }
    }

    loadInitialProducts()
  }, [isOpen, initialProducts, user?.store_id, order])

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreatePurchaseOrderDto) => purchaseOrdersService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Orden de compra creada exitosamente')
      onClose()
      onSuccess?.()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al crear la orden de compra'
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
          variant_id: null,
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
        toast.error(
          `La cantidad de ${item.product?.name || 'producto'} debe ser mayor a 0`
        )
        return
      }
      if (item.unit_cost_bs < 0 || item.unit_cost_usd < 0) {
        toast.error(
          `Los costos de ${item.product?.name || 'producto'} deben ser >= 0`
        )
        return
      }
    }

    const data: CreatePurchaseOrderDto = {
      supplier_id: selectedSupplierId,
      warehouse_id: selectedWarehouseId || null,
      expected_delivery_date: expectedDeliveryDate || null,
      items: items.map((item) => ({
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        quantity: item.quantity,
        unit_cost_bs: item.unit_cost_bs,
        unit_cost_usd: item.unit_cost_usd,
      })),
      note: note || undefined,
    }

    createMutation.mutate(data)
  }

  // Calcular totales
  const totalBs = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_cost_bs,
    0
  )
  const totalUsd = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_cost_usd,
    0
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0 bg-card">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl">
            {isEditing ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica la información de la orden de compra'
              : 'Crea una nueva orden de compra para un proveedor'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
            <div className="space-y-4 sm:space-y-5">
          {/* Proveedor y Bodega */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier">
                Proveedor <span className="text-destructive">*</span>
              </Label>
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
                value={selectedWarehouseId || undefined}
                onValueChange={(value) => setSelectedWarehouseId(value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una bodega (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguna</SelectItem>
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
            <Label>
              Productos <span className="text-destructive">*</span>
            </Label>
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
                  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
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
                        <p className="text-xs text-muted-foreground">
                          Costo: ${Number(product.cost_usd || 0).toFixed(2)} USD
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista de items */}
              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map((item) => {
                    const product =
                      item.product ||
                      productsData?.products.find((p) => p.id === item.product_id)
                    return (
                      <Card key={item.product_id} className="border border-border">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium">{product?.name || 'Producto'}</p>
                              {product?.sku && (
                                <p className="text-xs text-muted-foreground">
                                  SKU: {product.sku}
                                </p>
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
                                className="h-8 w-8 mt-6"
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
              placeholder="Notas adicionales sobre la orden..."
            />
          </div>
            </div>
          </div>
          <DialogFooter className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-border flex-shrink-0">
            <Button type="button" variant="outline" className="btn-glass-neutral" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="outline" className="btn-glass-neutral" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creando...' : 'Crear Orden'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
