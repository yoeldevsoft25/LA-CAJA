import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { inventoryService, StockReceivedRequest, StockStatus } from '@/services/inventory.service'
import { productsService, Product } from '@/services/products.service'
import { productsCacheService } from '@/services/products-cache.service'
import { exchangeService } from '@/services/exchange.service'
import { warehousesService } from '@/services/warehouses.service'
import { useAuth } from '@/stores/auth.store'
import { Plus, Trash2, Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface StockReceivedModalProps {
  isOpen: boolean
  onClose: () => void
  product?: StockStatus | null
  onSuccess?: () => void
}

interface ProductItem {
  id: string
  product_id: string
  product_name: string
  qty: number
  unit_cost_usd: number
  unit_cost_bs: number
}

export default function StockReceivedModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: StockReceivedModalProps) {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [productItems, setProductItems] = useState<ProductItem[]>([])
  const [supplier, setSupplier] = useState('')
  const [invoice, setInvoice] = useState('')
  const [note, setNote] = useState('')
  const [warehouseId, setWarehouseId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Obtener productos para selección (con cache offline persistente)
  const { data: productsData } = useQuery({
    queryKey: ['products', 'list', user?.store_id],
    queryFn: () => productsService.search({ limit: 1000 }, user?.store_id),
    enabled: isOpen && !!user?.store_id,
    staleTime: 1000 * 60 * 5, // 5 minutos
    gcTime: Infinity, // Nunca eliminar del cache
    placeholderData: undefined, // Se carga desde cache en useEffect
  })

  // Cargar desde cache cuando se abre el modal
  const [initialProducts, setInitialProducts] = useState<{ products: any[]; total: number } | undefined>(undefined);

  useEffect(() => {
    if (user?.store_id && isOpen) {
      productsCacheService.getProductsFromCache(user.store_id, { limit: 1000 })
        .then(cached => {
          if (cached.length > 0) {
            setInitialProducts({ products: cached, total: cached.length });
          }
        })
        .catch(error => {
          console.warn('[StockReceivedModal] Error cargando cache:', error);
        });
    }
  }, [user?.store_id, isOpen]);

  // Obtener tasa BCV (usa cache del prefetch)
  const { data: bcvRateData } = useQuery({
    queryKey: ['exchange', 'bcv'],
    queryFn: () => exchangeService.getBCVRate(),
    staleTime: 1000 * 60 * 60 * 2, // 2 horas
    gcTime: Infinity, // Nunca eliminar
    enabled: isOpen,
  })

  // Obtener bodegas
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(),
    enabled: isOpen && !!user?.store_id,
  })

  // Obtener bodega por defecto
  const { data: defaultWarehouse } = useQuery({
    queryKey: ['warehouses', 'default'],
    queryFn: () => warehousesService.getDefault(),
    enabled: isOpen && !!user?.store_id,
  })

  // Prellenar bodega por defecto
  useEffect(() => {
    if (isOpen && defaultWarehouse && !warehouseId) {
      setWarehouseId(defaultWarehouse.id)
    }
  }, [isOpen, defaultWarehouse, warehouseId])

  const products = (productsData?.products || initialProducts?.products || []) as any[]
  const exchangeRate = bcvRateData?.rate || 36

  // Filtrar productos según búsqueda (excluyendo los ya agregados)
  const addedProductIds = new Set(productItems.map((item) => item.product_id))
  const filteredProducts = products.filter((p: any) => {
    if (addedProductIds.has(p.id)) return false
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      p.name.toLowerCase().includes(searchLower) ||
      p.sku?.toLowerCase().includes(searchLower) ||
      p.barcode?.toLowerCase().includes(searchLower)
    )
  })

  // Si se pasa un producto específico, agregarlo automáticamente
  useEffect(() => {
    if (isOpen && product && productItems.length === 0) {
      setProductItems([
        {
          id: `item-${Date.now()}`,
          product_id: product.product_id,
          product_name: product.product_name,
          qty: 1,
          unit_cost_usd: 0,
          unit_cost_bs: 0,
        },
      ])
    } else if (isOpen && !product) {
      setProductItems([])
    }
  }, [isOpen, product, productItems.length])

  // Limpiar al cerrar
  useEffect(() => {
    if (!isOpen) {
      setProductItems([])
      setSupplier('')
      setInvoice('')
      setNote('')
      setSearchQuery('')
      setShowProductSearch(false)
      setWarehouseId(null)
    }
  }, [isOpen])

  // Focus en el input de búsqueda cuando se abre
  useEffect(() => {
    if (showProductSearch && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [showProductSearch])

  const addProduct = (product: Product) => {
    const newItem: ProductItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      product_id: product.id,
      product_name: product.name,
      qty: 1,
      unit_cost_usd: 0,
      unit_cost_bs: 0,
    }
    setProductItems([...productItems, newItem])
    setSearchQuery('')
    setShowProductSearch(false)
  }

  const removeProduct = (itemId: string) => {
    setProductItems(productItems.filter((item) => item.id !== itemId))
  }

  const updateProductItem = (
    itemId: string,
    field: keyof ProductItem,
    value: number | string
  ) => {
    setProductItems(
      productItems.map((item) => {
        if (item.id === itemId) {
          const updated = { ...item, [field]: value }
          // Si cambia unit_cost_usd, recalcular unit_cost_bs
          if (field === 'unit_cost_usd') {
            updated.unit_cost_bs = Math.round(Number(value) * exchangeRate * 100) / 100
          }
          return updated
        }
        return item
      })
    )
  }

  const stockReceivedMutation = useMutation({
    mutationFn: async (requests: StockReceivedRequest[]) => {
      // Ejecutar todas las peticiones en paralelo
      const promises = requests.map((req) => inventoryService.stockReceived(req))
      return Promise.all(promises)
    },
    onSuccess: (results) => {
      toast.success(
        `Stock recibido exitosamente para ${results.length} producto${results.length > 1 ? 's' : ''}`
      )
      onClose()
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al recibir stock')
    },
  })

  const handleSubmit = () => {
    if (productItems.length === 0) {
      toast.error('Debes agregar al menos un producto')
      return
    }

    // Validar que todos los productos tengan cantidad y costo
    const invalidItems = productItems.filter(
      (item) => item.qty <= 0 || item.unit_cost_usd < 0
    )
    if (invalidItems.length > 0) {
      toast.error('Todos los productos deben tener cantidad mayor a 0 y costo válido')
      return
    }

    // Crear las peticiones
    const requests: StockReceivedRequest[] = productItems.map((item) => ({
      product_id: item.product_id,
      qty: item.qty,
      unit_cost_bs: item.unit_cost_bs,
      unit_cost_usd: item.unit_cost_usd,
      note: note || undefined,
      warehouse_id: warehouseId || undefined,
      ref:
        supplier || invoice
          ? {
              supplier: supplier || undefined,
              invoice: invoice || undefined,
            }
          : undefined,
    }))

    stockReceivedMutation.mutate(requests)
  }

  const isLoading = stockReceivedMutation.isPending
  const totalProducts = productItems.length
  const totalItems = productItems.reduce((sum, item) => sum + item.qty, 0)
  const totalCostUsd = productItems.reduce(
    (sum, item) => sum + item.unit_cost_usd * item.qty,
    0
  )
  const totalCostBs = productItems.reduce(
    (sum, item) => sum + item.unit_cost_bs * item.qty,
    0
  )

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          onClose()
        }}
        onPointerDownOutside={(e) => {
          e.preventDefault()
        }}
        onInteractOutside={(e) => {
          e.preventDefault()
        }}
      >
        <DialogHeader className="px-4 sm:px-6 py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-xl">
            Recibir Stock {totalProducts > 0 && `(${totalProducts} productos)`}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Registra la recepción de stock de productos
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          <div className="space-y-6">
            {/* Buscador de productos con diseño colapsable */}
            {!showProductSearch ? (
              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed"
                onClick={() => setShowProductSearch(true)}
              >
                <Plus className="w-5 h-5 mr-2" />
                Agregar Producto
              </Button>
            ) : (
              <Card className="border-2 border-primary">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Buscar Producto</CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setShowProductSearch(false)
                        setSearchQuery('')
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Buscar por nombre, SKU o código de barras..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <ScrollArea className="h-[200px] rounded-md border">
                    {filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        {searchQuery ? 'No se encontraron productos' : 'Escribe para buscar productos'}
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filteredProducts.map((p: any) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addProduct(p)}
                            className="w-full px-3 py-2.5 text-left hover:bg-muted transition-colors"
                          >
                            <p className="font-medium text-sm">{p.name}</p>
                            {p.sku && <p className="text-xs text-muted-foreground mt-0.5">SKU: {p.sku}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Lista de productos agregados */}
            {productItems.length > 0 && (
              <div className="space-y-3">
                {productItems.map((item) => (
                  <Card key={item.id} className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-semibold text-sm sm:text-base">
                          {item.product_name}
                        </h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeProduct(item.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Cantidad */}
                        <div>
                          <Label className="text-xs mb-1.5 block">
                            Cantidad <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="number"
                            step="1"
                            min="1"
                            value={item.qty}
                            onChange={(e) =>
                              updateProductItem(item.id, 'qty', parseInt(e.target.value) || 1)
                            }
                          />
                        </div>

                        {/* Costo USD */}
                        <div>
                          <Label className="text-xs mb-1.5 block">
                            Costo Unit. USD <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_cost_usd || ''}
                            onChange={(e) =>
                              updateProductItem(item.id, 'unit_cost_usd', parseFloat(e.target.value) || 0)
                            }
                            placeholder="0.00"
                          />
                        </div>

                        {/* Costo BS (calculado) */}
                        <div>
                          <Label className="text-xs mb-1.5 block">
                            Costo Unit. Bs
                            <span className="text-xs font-normal text-muted-foreground ml-1">
                              (Calculado)
                            </span>
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unit_cost_bs.toFixed(2)}
                            className="bg-muted cursor-not-allowed"
                            readOnly
                          />
                        </div>
                      </div>

                      {/* Subtotal */}
                      <div className="mt-2 text-right text-sm">
                        <span className="text-muted-foreground">Subtotal: </span>
                        <span className="font-semibold">
                          ${(item.unit_cost_usd * item.qty).toFixed(2)} USD /{' '}
                          {(item.unit_cost_bs * item.qty).toFixed(2)} Bs
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Información compartida */}
            {productItems.length > 0 && (
              <div className="border-t pt-4 space-y-4">
                {/* Selector de bodega */}
                {warehouses.length > 0 && (
                  <div>
                    <Label htmlFor="warehouse">Bodega (Opcional)</Label>
                    <Select
                      value={warehouseId || 'default'}
                      onValueChange={(value) =>
                        setWarehouseId(value === 'default' ? null : value)
                      }
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Usar bodega por defecto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Usar bodega por defecto</SelectItem>
                        {warehouses
                          .filter((w) => w.is_active)
                          .map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.name} {w.is_default && '(Por defecto)'}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Si no se selecciona, se usará la bodega por defecto
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="supplier">Proveedor</Label>
                    <Input
                      id="supplier"
                      type="text"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      className="mt-2"
                      placeholder="Nombre del proveedor"
                    />
                  </div>
                  <div>
                    <Label htmlFor="invoice">N° Factura</Label>
                    <Input
                      id="invoice"
                      type="text"
                      value={invoice}
                      onChange={(e) => setInvoice(e.target.value)}
                      className="mt-2"
                      placeholder="Número de factura"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="note">Nota</Label>
                  <Textarea
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="mt-2 resize-none"
                    placeholder="Notas adicionales (opcional)"
                  />
                </div>
              </div>
            )}

            {/* Resumen total */}
            {productItems.length > 0 && (
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Resumen</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Productos:</span>
                      <span className="ml-2 font-semibold">{totalProducts}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Unidades:</span>
                      <span className="ml-2 font-semibold">{totalItems}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total USD:</span>
                      <span className="ml-2 font-semibold">
                        ${totalCostUsd.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Bs:</span>
                      <span className="ml-2 font-semibold">
                        {totalCostBs.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {bcvRateData?.available && bcvRateData.rate && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Tasa BCV: {bcvRateData.rate.toFixed(2)} Bs/USD
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t px-4 sm:px-6 py-4">
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || productItems.length === 0}
              className="flex-1"
            >
              {isLoading
                ? 'Registrando...'
                : `Recibir Stock${totalProducts > 0 ? ` (${totalProducts})` : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
