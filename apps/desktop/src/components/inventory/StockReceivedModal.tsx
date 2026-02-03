import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from '@/lib/toast'
import { inventoryService, StockReceivedRequest, StockStatus } from '@/services/inventory.service'
import { productsService, Product } from '@/services/products.service'
import { productsCacheService } from '@/services/products-cache.service'
import { exchangeService } from '@/services/exchange.service'
import { warehousesService } from '@/services/warehouses.service'
import { useAuth } from '@/stores/auth.store'
import { useMobileOptimizedQuery } from '@/hooks/use-mobile-optimized-query'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { Plus, Trash2, Search, Scale } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@la-caja/ui-core'
import { Input } from '@la-caja/ui-core'
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
  is_weight_product?: boolean
  weight_unit?: 'kg' | 'g' | 'lb' | 'oz' | null
  qty: number
  unit_cost_usd: number
  unit_cost_bs: number
  total_cost_bs?: number // Campo para input de total exacto en Bs (Factura)
  total_cost_usd?: number // Campo para input de total exacto en USD (Factura)
  cost_calculation_currency: 'BS' | 'USD' // Moneda base para el cálculo del total
}

type WeightUnit = 'kg' | 'g' | 'lb' | 'oz'

const WEIGHT_UNIT_TO_KG: Record<WeightUnit, number> = {
  kg: 1,
  g: 0.001,
  lb: 0.45359237,
  oz: 0.028349523125,
}

const getCostPerWeightFromBase = (costPerKg: number, unit: WeightUnit | null) => {
  if (!unit) return costPerKg
  return costPerKg * WEIGHT_UNIT_TO_KG[unit]
}

export default function StockReceivedModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: StockReceivedModalProps) {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [productItems, setProductItems] = useState<ProductItem[]>([])
  const [supplier, setSupplier] = useState('')
  const [invoice, setInvoice] = useState('')
  const [note, setNote] = useState('')
  const [warehouseId, setWarehouseId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Optimización para mobile: diferir carga de queries pesadas
  const { shouldLoad: shouldLoadProducts } = useMobileOptimizedQuery(isOpen)

  // Obtener productos para selección (con cache offline persistente)
  const { data: productsData } = useQuery({
    queryKey: ['products', 'list', user?.store_id],
    queryFn: () => productsService.search({ limit: 1000 }, user?.store_id),
    enabled: shouldLoadProducts && !!user?.store_id,
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

  // Obtener tasa BCV (usa cache del prefetch) - carga inmediata porque es ligera
  const { data: bcvRateData } = useQuery({
    queryKey: ['exchange', 'bcv'],
    queryFn: () => exchangeService.getBCVRate(),
    staleTime: 1000 * 60 * 60 * 2, // 2 horas
    gcTime: Infinity, // Nunca eliminar
    enabled: isOpen,
  })

  // Obtener bodegas - carga inmediata porque es ligera
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(),
    enabled: isOpen && !!user?.store_id,
  })

  // Obtener bodega por defecto - carga inmediata porque es ligera
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
    if (!isOpen || !product) return
    if (products.length === 0) return

    setProductItems((current) => {
      if (current.length > 0) return current

      // Buscar el producto completo para obtener los costos predeterminados
      const fullProduct = products.find((p: any) => p.id === product.product_id)

      // Usar is_weight_product y weight_unit del StockStatus (viene del backend)
      // Si no está en StockStatus, intentar obtener del producto completo
      const isWeightProduct = product.is_weight_product ?? fullProduct?.is_weight_product ?? false
      const weightUnit = product.weight_unit ?? fullProduct?.weight_unit ?? null

      // Para productos por peso, usar cost_per_weight si existe
      // Si no existe, usar cost_usd (podría estar en unidad base como kg)
      let defaultCostUsd: number
      let defaultCostBs: number

      const costPerWeightUsd =
        fullProduct?.cost_per_weight_usd ?? product.cost_per_weight_usd ?? null
      const costPerWeightBs =
        fullProduct?.cost_per_weight_bs ?? product.cost_per_weight_bs ?? null

      if (isWeightProduct && costPerWeightUsd != null) {
        // Usar costo por unidad de peso (ej: costo por gramo)
        defaultCostUsd = Number(costPerWeightUsd) || 0
        defaultCostBs = costPerWeightBs != null
          ? Number(costPerWeightBs)
          : Math.round(defaultCostUsd * exchangeRate * 1000000) / 1000000
      } else if (isWeightProduct && fullProduct?.cost_usd) {
        // Fallback: asumir costo base por kg y convertir a la unidad de peso
        const baseCostUsd = Number(fullProduct.cost_usd) || 0
        defaultCostUsd = getCostPerWeightFromBase(baseCostUsd, weightUnit)
        defaultCostBs = Math.round(defaultCostUsd * exchangeRate * 1000000) / 1000000
      } else {
        // Producto normal o sin costo por peso configurado
        defaultCostUsd = fullProduct?.cost_usd ? Number(fullProduct.cost_usd) : 0
        defaultCostBs = fullProduct?.cost_bs ? Number(fullProduct.cost_bs) : 0
      }

      // Si USD es 0 pero Bs > 0, derivar USD desde la tasa para no guardar 0
      if (defaultCostUsd === 0 && defaultCostBs > 0 && exchangeRate > 0) {
        defaultCostUsd = Math.round((defaultCostBs / exchangeRate) * 1000000) / 1000000
      }

      return [
        {
          id: `item-${Date.now()}`,
          product_id: product.product_id,
          product_name: product.product_name,
          is_weight_product: isWeightProduct,
          weight_unit: weightUnit,
          qty: isWeightProduct ? 0 : 1, // Para productos por peso, iniciar en 0 para forzar al usuario a ingresar
          unit_cost_usd: defaultCostUsd,
          unit_cost_bs: defaultCostBs > 0 ? defaultCostBs : Math.round(defaultCostUsd * exchangeRate * 1000000) / 1000000,
          cost_calculation_currency: 'BS', // Por defecto en Bs
        },
      ]
    })
  }, [isOpen, product, products, exchangeRate])

  // Limpiar al cerrar
  useEffect(() => {
    if (!isOpen) {
      setProductItems([])
      setSupplier('')
      setInvoice('')
      setNote('')
      setSearchQuery('')
      setWarehouseId(null)
    }
  }, [isOpen])

  // Auto-focus en el input de búsqueda cuando se abre el modal
  useEffect(() => {
    if (isOpen && searchInputRef.current && productItems.length === 0) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, productItems.length])

  const addProduct = (product: Product) => {
    const isWeightProduct = !!product.is_weight_product
    let defaultCostUsd: number
    let defaultCostBs: number

    const weightUnit = (product.weight_unit ?? null) as WeightUnit | null
    const costPerWeightUsd = product.cost_per_weight_usd ?? null
    const costPerWeightBs = product.cost_per_weight_bs ?? null

    if (isWeightProduct && costPerWeightUsd != null) {
      // Para productos por peso, usar costo por unidad de peso
      defaultCostUsd = Number(costPerWeightUsd) || 0
      defaultCostBs = costPerWeightBs != null
        ? Number(costPerWeightBs)
        : Math.round(defaultCostUsd * exchangeRate * 1000000) / 1000000
    } else if (isWeightProduct && product.cost_usd) {
      // Fallback: asumir costo base por kg y convertir a la unidad de peso
      const baseCostUsd = Number(product.cost_usd) || 0
      defaultCostUsd = getCostPerWeightFromBase(baseCostUsd, weightUnit)
      defaultCostBs = Math.round(defaultCostUsd * exchangeRate * 1000000) / 1000000
    } else {
      // Producto normal
      defaultCostUsd = Number(product.cost_usd) || 0
      defaultCostBs = Number(product.cost_bs) || 0
    }

    // Si USD es 0 pero Bs > 0, derivar USD desde la tasa para no guardar 0
    if (defaultCostUsd === 0 && defaultCostBs > 0 && exchangeRate > 0) {
      defaultCostUsd = Math.round((defaultCostBs / exchangeRate) * 1000000) / 1000000
    }

    const newItem: ProductItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      product_id: product.id,
      product_name: product.name,
      is_weight_product: isWeightProduct,
      weight_unit: product.weight_unit ?? null,
      qty: isWeightProduct ? 0 : 1,
      unit_cost_usd: defaultCostUsd,
      unit_cost_bs: defaultCostBs > 0 ? defaultCostBs : Math.round(defaultCostUsd * exchangeRate * 1000000) / 1000000,
      cost_calculation_currency: 'BS',
    }
    setProductItems((prev) => [...prev, newItem])
    setSearchQuery('')
  }

  const removeProduct = (itemId: string) => {
    setProductItems(productItems.filter((item) => item.id !== itemId))
  }

  // Handler para escaneo de código de barras
  const handleBarcodeScan = async (barcode: string) => {
    try {
      const products = productsData?.products || []

      // Buscar producto por código de barras exacto
      const product = products.find(
        (p) => p.barcode?.toLowerCase() === barcode.toLowerCase()
      )

      if (!product) {
        toast.error(`Producto no encontrado: ${barcode}`, {
          icon: '🔍',
          duration: 3000,
        })
        return
      }

      // Verificar si el producto ya está en la lista
      const existingItem = productItems.find(
        (item) => item.product_id === product.id
      )

      if (existingItem) {
        // Si ya existe, incrementar cantidad (solo si no es por peso)
        if (!existingItem.is_weight_product) {
          updateProductItem(existingItem.id, 'qty', existingItem.qty + 1)
          toast.success(`${product.name} - Cantidad incrementada`, {
            icon: '✅',
            duration: 2000,
          })
        } else {
          toast(`${product.name} es un producto por peso. Ingresa la cantidad manualmente.`, {
            icon: '⚖️',
            duration: 3000,
          })
        }
      } else {
        // Agregar nuevo producto
        addProduct(product)
        toast.success(`${product.name} agregado`, {
          icon: '✅',
          duration: 2000,
        })
      }
    } catch (error) {
      console.error('[StockReceivedModal] Error al buscar producto por código de barras:', error)
      toast.error('Error al buscar producto')
    }
  }

  // Integrar scanner de código de barras (solo cuando el modal está abierto y no hay input activo)
  useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: isOpen && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA',
    minLength: 4,
    maxLength: 50,
    maxIntervalMs: 50,
  })

  const updateProductItem = (
    itemId: string,
    field: keyof ProductItem,
    value: number | string
  ) => {
    setProductItems(
      productItems.map((item) => {
        if (item.id === itemId) {
          let updated = { ...item, [field]: value }

          // Lógica de cálculo bidireccional
          if (field === 'qty') {
            const qty = Number(value) || 0
            // Si cambiamos cantidad, recalculamos totales basado en unitarios existentes
            if (item.unit_cost_bs > 0) {
              updated.total_cost_bs = Number((item.unit_cost_bs * qty).toFixed(2))
              if (exchangeRate > 0) {
                updated.total_cost_usd = Number((updated.unit_cost_usd * qty).toFixed(2))
              }
            }
          } else if (field === 'unit_cost_usd') {
            const unitCostUsd = Number(value) || 0
            // Si cambiamos costo unitario USD:
            // 1. Recalcular Unit Bs
            const unitCostBs = Math.round(unitCostUsd * exchangeRate * 100) / 100
            updated.unit_cost_bs = unitCostBs
            // 2. Recalcular Totales
            updated.total_cost_bs = Number((unitCostBs * item.qty).toFixed(2))
            updated.total_cost_usd = Number((unitCostUsd * item.qty).toFixed(2))
          } else if (field === 'total_cost_bs') {
            const totalCostBs = Number(value) || 0
            // Si cambiamos total Bs (Factura):
            // 1. Recalcular Unit Bs con alta precisión
            if (item.qty > 0) {
              const preciseUnitBs = totalCostBs / item.qty
              updated.unit_cost_bs = Number(preciseUnitBs.toFixed(4))
              // 2. Recalcular Unit USD y Total USD
              if (exchangeRate > 0) {
                const preciseUnitUsd = preciseUnitBs / exchangeRate
                updated.unit_cost_usd = Number(preciseUnitUsd.toFixed(4))
                updated.total_cost_usd = Number((preciseUnitUsd * item.qty).toFixed(2))
              }
            }
          } else if (field === 'total_cost_usd') {
            const totalCostUsd = Number(value) || 0
            // Si cambiamos total USD (Factura):
            // 1. Recalcular Unit USD con alta precisión
            if (item.qty > 0) {
              const preciseUnitUsd = totalCostUsd / item.qty
              updated.unit_cost_usd = Number(preciseUnitUsd.toFixed(4))
              // 2. Recalcular Unit Bs y Total Bs
              const preciseUnitBs = preciseUnitUsd * exchangeRate
              updated.unit_cost_bs = Number(preciseUnitBs.toFixed(4))
              updated.total_cost_bs = Number((preciseUnitBs * item.qty).toFixed(2))
            }
          } else if (field === 'cost_calculation_currency') {
            // Al cambiar la moneda, recalculamos el total de la nueva moneda basándonos en el total de la anterior
            // para que el valor visual sea consistente con el costo actual
            if (value === 'USD') {
              if (item.total_cost_bs && exchangeRate > 0) {
                updated.total_cost_usd = Number((item.total_cost_bs / exchangeRate).toFixed(2))
              }
            } else {
              if (item.total_cost_usd) {
                updated.total_cost_bs = Number((item.total_cost_usd * exchangeRate).toFixed(2))
              }
            }
          }

          return updated
        }
        return item
      })
    )
  }

  const queryClient = useQueryClient()

  const stockReceivedMutation = useMutation({
    mutationFn: async (requests: StockReceivedRequest[]) => {
      // Ejecutar todas las peticiones en paralelo
      const promises = requests.map((req) => inventoryService.stockReceived(req))
      return Promise.all(promises)
    },
    onMutate: async (newRequests) => {
      // Cancelar refetches en curso
      await queryClient.cancelQueries({ queryKey: ['inventory', 'stock-status'] })

      // Snapshot del valor anterior
      const previousStock = queryClient.getQueryData(['inventory', 'stock-status'])

      // Optimistic update para CADA producto en la solicitud
      queryClient.setQueriesData({ queryKey: ['inventory', 'stock-status'] }, (old: any) => {
        if (!old) return old

        const isPaged = old.items && Array.isArray(old.items)
        const items = isPaged ? old.items : (Array.isArray(old) ? old : [])

        // Crear mapa de cambios por producto
        const changesByProduct = new Map<string, number>()
        newRequests.forEach(req => {
          const current = changesByProduct.get(req.product_id) || 0
          changesByProduct.set(req.product_id, current + req.qty)
        })

        const newItems = items.map((item: StockStatus) => {
          const qtyToAdd = changesByProduct.get(item.product_id)
          if (qtyToAdd) {
            return {
              ...item,
              current_stock: item.current_stock + qtyToAdd,
              is_low_stock: (item.current_stock + qtyToAdd) <= item.low_stock_threshold
            }
          }
          return item
        })

        if (isPaged) {
          return { ...old, items: newItems }
        }
        return newItems
      })

      return { previousStock }
    },
    onSuccess: (results) => {
      toast.success(
        `Stock recibido exitosamente para ${results.length} producto${results.length > 1 ? 's' : ''}`
      )
      onClose()
      onSuccess?.()
    },
    onError: async (error: any, variables, context) => {
      // ✅ OFFLINE-FIRST: Si falla por conexión
      if (error.isOffline || error.code === 'ERR_INTERNET_DISCONNECTED' || !navigator.onLine) {
        try {
          const { syncService } = await import('@/services/sync.service')

          // Encolar un evento por cada request (o un evento batch si soportamos batch)
          // DB soporta batch pero SyncService.enqueueEvent es uno a uno por ahora.
          // Haremos un loop.

          for (const req of variables) {
            await syncService.enqueueEvent({
              event_id: crypto.randomUUID(),
              type: 'inventory.stock_received',
              payload: req,
              created_at: Date.now(),
              seq: 0,
              store_id: user?.store_id || '',
              device_id: localStorage.getItem('device_id') || 'unknown',
              version: 1,
              actor: {
                user_id: user?.user_id || 'unknown',
                role: (user?.role as any) || 'cashier',
              },
            })
          }

          toast.success(`Guardado localmente (${variables.length} productos)`)
          onClose()
          onSuccess?.()
          return
        } catch (queueError) {
          console.error('Error al encolar offline:', queueError)
        }
      }

      // Rollback si no es offline
      if (context?.previousStock) {
        queryClient.setQueriesData(
          { queryKey: ['inventory', 'stock-status'] },
          context.previousStock
        )
      }
      toast.error(error.response?.data?.message || 'Error al recibir stock')
    },
    onSettled: (_data, _error, variables) => {
      if (navigator.onLine) {
        // Refrescar estado general del inventario
        queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-status'] })

        // Refrescar lista de productos (para que se refleje en el catálogo/tabla)
        queryClient.invalidateQueries({ queryKey: ['products'] })

        // Refrescar detalles específicos de los productos afectados
        variables?.forEach(req => {
          queryClient.invalidateQueries({ queryKey: ['inventory', 'stock', req.product_id] })
          queryClient.invalidateQueries({ queryKey: ['products', req.product_id] })
        })
      }
    }
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

    // Crear las peticiones; si USD=0 y Bs>0, derivar USD desde la tasa para no guardar 0
    const requests: StockReceivedRequest[] = productItems.map((item) => {
      let unitCostUsd = item.unit_cost_usd
      if (Number(unitCostUsd) === 0 && Number(item.unit_cost_bs) > 0 && exchangeRate > 0) {
        unitCostUsd = Math.round((item.unit_cost_bs / exchangeRate) * 1000000) / 1000000
      }
      return {
        product_id: item.product_id,
        qty: item.qty,
        unit_cost_bs: item.unit_cost_bs,
        unit_cost_usd: unitCostUsd,
        note: note || undefined,
        warehouse_id: warehouseId || undefined,
        ref:
          supplier || invoice
            ? {
              supplier: supplier || undefined,
              invoice: invoice || undefined,
            }
            : undefined,
      }
    })

    stockReceivedMutation.mutate(requests)
  }

  const isLoading = stockReceivedMutation.isPending
  const totalProducts = productItems.length

  // Separar productos normales de productos por peso
  const normalProducts = productItems.filter((item) => !item.is_weight_product)
  const weightProducts = productItems.filter((item) => item.is_weight_product)

  const totalNormalItems = normalProducts.reduce((sum, item) => sum + item.qty, 0)
  const totalCostUsd = productItems.reduce(
    (sum, item) => sum + item.unit_cost_usd * item.qty,
    0
  )
  const totalCostBs = productItems.reduce(
    (sum, item) => sum + item.unit_cost_bs * item.qty,
    0
  )

  // Generar etiqueta de unidades
  const getUnitsLabel = () => {
    const parts: string[] = []
    if (totalNormalItems > 0) {
      parts.push(`${totalNormalItems} unid.`)
    }
    weightProducts.forEach((item) => {
      if (item.qty > 0) {
        parts.push(`${item.qty} ${item.weight_unit || 'kg'}`)
      }
    })
    return parts.length > 0 ? parts.join(' + ') : '0'
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
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
            {/* Buscador de productos - Siempre visible */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar producto por nombre, SKU o código de barras..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-barcode-passthrough="true"
                />
              </div>

              {/* Lista de productos filtrados */}
              {searchQuery && (
                <Card>
                  <ScrollArea className="h-[200px]">
                    {filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No se encontraron productos
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filteredProducts.slice(0, 10).map((p: any) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addProduct(p)}
                            className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center justify-between"
                          >
                            <div>
                              <p className="font-medium text-sm">{p.name}</p>
                              {p.sku && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  SKU: {p.sku}
                                </p>
                              )}
                            </div>
                            <Plus className="w-4 h-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </Card>
              )}
            </div>

            {/* Lista de productos agregados */}
            {productItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Productos agregados</h3>
                  <span className="text-xs text-muted-foreground">
                    {totalProducts} producto{totalProducts > 1 ? 's' : ''}
                  </span>
                </div>

                {productItems.map((item) => (
                  <Card key={item.id} className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {item.is_weight_product && (
                            <Scale className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                          <h4 className="font-semibold text-sm sm:text-base">
                            {item.product_name}
                          </h4>
                          {item.is_weight_product && item.weight_unit && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              Por {item.weight_unit === 'g' ? 'gramos' : item.weight_unit === 'kg' ? 'kilos' : item.weight_unit === 'lb' ? 'libras' : 'onzas'}
                            </span>
                          )}
                        </div>
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

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        {/* Cantidad */}
                        <div>
                          <Label className="text-xs mb-1.5 block">
                            {item.is_weight_product && item.weight_unit
                              ? `Cant. (${item.weight_unit})`
                              : 'Cantidad'}{' '}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="number"
                            step={
                              item.is_weight_product
                                ? item.weight_unit === 'g' || item.weight_unit === 'oz'
                                  ? '1'
                                  : '0.001'
                                : '1'
                            }
                            min="0"
                            placeholder="0"
                            value={item.qty || ''}
                            onChange={(e) =>
                              (() => {
                                const parsed = parseFloat(e.target.value)
                                if (Number.isNaN(parsed)) {
                                  updateProductItem(item.id, 'qty', 0)
                                  return
                                }
                                const normalized = item.is_weight_product
                                  ? item.weight_unit === 'g' || item.weight_unit === 'oz'
                                    ? Math.round(parsed)
                                    : Math.round(parsed * 1000) / 1000
                                  : Math.trunc(parsed)
                                updateProductItem(item.id, 'qty', normalized)
                              })()
                            }
                          />
                        </div>

                        {/* Costo Total (Selectable) */}
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs font-medium text-primary flex items-center justify-between">
                            <span>Costo Total</span>
                            <span className="text-[10px] font-normal text-muted-foreground">(Factura)</span>
                          </Label>
                          <div className="flex rounded-md shadow-sm">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="flex h-9 w-full rounded-l-md border border-r-0 border-primary/20 bg-primary/5 px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                              placeholder="0.00"
                              value={
                                item.cost_calculation_currency === 'BS'
                                  ? item.total_cost_bs || ''
                                  : item.total_cost_usd || ''
                              }
                              onChange={(e) =>
                                updateProductItem(
                                  item.id,
                                  item.cost_calculation_currency === 'BS' ? 'total_cost_bs' : 'total_cost_usd',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                            />
                            <button
                              type="button"
                              onClick={() => {
                                updateProductItem(
                                  item.id,
                                  'cost_calculation_currency',
                                  item.cost_calculation_currency === 'BS' ? 'USD' : 'BS'
                                )
                              }}
                              className="inline-flex items-center justify-center rounded-r-md border border-l-0 border-primary/20 bg-primary/10 px-2.5 text-xs font-medium text-primary hover:bg-primary/20 focus:outline-none focus:ring-1 focus:ring-primary/20"
                            >
                              {item.cost_calculation_currency === 'BS' ? 'Bs' : '$'}
                            </button>
                          </div>
                        </div>

                        {/* Costo Unitario USD */}
                        <div>
                          <Label className="text-xs mb-1.5 block">
                            Costo Unit. $
                            <span className="text-xs font-normal text-muted-foreground ml-1">
                              (Calc)
                            </span>
                          </Label>
                          <Input
                            type="number"
                            step="0.0001"
                            min="0"
                            placeholder="0.00"
                            value={item.unit_cost_usd || ''}
                            onChange={(e) =>
                              updateProductItem(
                                item.id,
                                'unit_cost_usd',
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                        </div>

                        {/* Costo Bs (Informátivo) */}
                        <div>
                          <Label className="text-xs mb-1.5 block">
                            Costo Unit. Bs
                            <span className="text-xs font-normal text-muted-foreground ml-1">
                              (@{exchangeRate})
                            </span>
                          </Label>
                          <Input
                            type="number"
                            value={item.unit_cost_bs.toFixed(2)}
                            className="bg-muted text-muted-foreground"
                            readOnly
                          />
                        </div>
                      </div>

                      {/* Subtotal */}
                      <div className="mt-2 text-right text-sm">
                        <span className="text-muted-foreground">
                          Subtotal{item.is_weight_product && item.weight_unit ? ` (${item.qty} ${item.weight_unit})` : ''}:
                        </span>
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
                      <span className="text-muted-foreground">Cantidades:</span>
                      <span className="ml-2 font-semibold">{getUnitsLabel()}</span>
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
