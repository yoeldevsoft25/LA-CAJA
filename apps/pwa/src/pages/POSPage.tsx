import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Search, Plus, Minus, ShoppingCart, Trash2 } from 'lucide-react'
import { productsService, ProductSearchResponse } from '@/services/products.service'
import { productsCacheService } from '@/services/products-cache.service'
import { salesService } from '@/services/sales.service'
import { cashService } from '@/services/cash.service'
import { useCart, CartItem } from '@/stores/cart.store'
import { useAuth } from '@/stores/auth.store'
import { useOnline } from '@/hooks/use-online'
import { printService } from '@/services/print.service'
import { fastCheckoutService, QuickProduct } from '@/services/fast-checkout.service'
import { productVariantsService, ProductVariant } from '@/services/product-variants.service'
import { productSerialsService } from '@/services/product-serials.service'
import toast from 'react-hot-toast'
import CheckoutModal from '@/components/pos/CheckoutModal'
import QuickProductsGrid from '@/components/fast-checkout/QuickProductsGrid'
import VariantSelector from '@/components/variants/VariantSelector'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export default function POSPage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [showCheckout, setShowCheckout] = useState(false)
  const [shouldPrint, setShouldPrint] = useState(false)
  const [showVariantSelector, setShowVariantSelector] = useState(false)
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<{
    id: string
    name: string
  } | null>(null)
  const [pendingSerials, setPendingSerials] = useState<Record<string, string[]>>({})
  const { items, addItem, updateItem, removeItem, clear, getTotal } = useCart()
  const lastCartSnapshot = useRef<CartItem[]>([])

  // Obtener sesión actual de caja
  const { data: currentCashSession } = useQuery({
    queryKey: ['cash', 'current-session'],
    queryFn: () => cashService.getCurrentSession(),
    refetchInterval: 60000, // Refrescar cada minuto
  })

  // Obtener configuración de modo rápido
  const { data: fastCheckoutConfig } = useQuery({
    queryKey: ['fast-checkout', 'config'],
    queryFn: () => fastCheckoutService.getFastCheckoutConfig(),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  // Handler para productos rápidos
  const handleQuickProductClick = async (quickProduct: QuickProduct) => {
    if (!quickProduct.product) {
      toast.error('Producto no encontrado')
      return
    }

    // Verificar si el producto tiene variantes activas
    try {
      const variants = await productVariantsService.getVariantsByProduct(quickProduct.product_id)
      const activeVariants = variants.filter((v) => v.is_active)

      if (activeVariants.length > 0) {
        // Mostrar selector de variantes
        setSelectedProductForVariant({
          id: quickProduct.product_id,
          name: quickProduct.product.name,
        })
        setShowVariantSelector(true)
      } else {
        // Agregar directamente sin variante
        const existingItem = items.find((item) => item.product_id === quickProduct.product_id)

        if (existingItem) {
          // Si existe, aumentar cantidad
          updateItem(existingItem.id, { qty: existingItem.qty + 1 })
          toast.success(`${quickProduct.product.name} agregado al carrito`)
        } else {
          // Si no existe, agregar nuevo item
          addItem({
            product_id: quickProduct.product_id,
            product_name: quickProduct.product.name,
            qty: 1,
            unit_price_bs: Number(quickProduct.product.price_bs),
            unit_price_usd: Number(quickProduct.product.price_usd),
          })
          toast.success(`${quickProduct.product.name} agregado al carrito`)
        }
      }
    } catch (error) {
      // Si hay error, agregar sin variante
      const existingItem = items.find((item) => item.product_id === quickProduct.product_id)

      if (existingItem) {
        updateItem(existingItem.id, { qty: existingItem.qty + 1 })
        toast.success(`${quickProduct.product.name} agregado al carrito`)
      } else {
        addItem({
          product_id: quickProduct.product_id,
          product_name: quickProduct.product.name,
          qty: 1,
          unit_price_bs: Number(quickProduct.product.price_bs),
          unit_price_usd: Number(quickProduct.product.price_usd),
        })
        toast.success(`${quickProduct.product.name} agregado al carrito`)
      }
    }
  }

  // Soporte para teclas de acceso rápido
  useEffect(() => {
    if (!fastCheckoutConfig?.enabled) return

    const handleKeyPress = async (e: KeyboardEvent) => {
      // Ignorar si está escribiendo en un input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      const key = e.key.toUpperCase()

      try {
        const quickProduct = await fastCheckoutService.getQuickProductByKey(key)
        if (quickProduct && quickProduct.is_active) {
          handleQuickProductClick(quickProduct)
        }
      } catch (error) {
        // Silenciar errores, simplemente no hacer nada si no hay producto para esa tecla
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [fastCheckoutConfig, items])

  const { isOnline } = useOnline(); // Usar hook más confiable
  const [initialData, setInitialData] = useState<ProductSearchResponse | undefined>(undefined);

  // Cargar desde IndexedDB al montar o cuando cambia la búsqueda
  useEffect(() => {
    if (user?.store_id && (searchQuery.length >= 2 || searchQuery.length === 0)) {
      productsCacheService.getProductsFromCache(user.store_id, {
        search: searchQuery || undefined,
        is_active: true,
        limit: 50,
      }).then(cached => {
        if (cached.length > 0) {
          setInitialData({
            products: cached,
            total: cached.length,
          });
        }
      }).catch(() => {
        // Silenciar errores
      });
    }
  }, [user?.store_id, searchQuery]);

  // Búsqueda de productos (con cache offline persistente)
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', 'search', searchQuery, user?.store_id],
    queryFn: () =>
      productsService.search({
        q: searchQuery || undefined,
        is_active: true,
        limit: 50,
      }, user?.store_id),
    enabled: (searchQuery.length >= 2 || searchQuery.length === 0) && !!user?.store_id && isOnline,
    staleTime: 1000 * 60 * 5, // 5 minutos
    gcTime: Infinity, // Nunca eliminar del cache
    retry: false, // No reintentar si falla
    initialData: !isOnline ? initialData : undefined,
    placeholderData: !isOnline ? initialData : undefined,
  })

  const products = productsData?.products || []


  const handleAddToCart = async (product: any, variant: ProductVariant | null = null) => {
    // Determinar precios (usar precio de variante si existe, sino precio del producto)
    const priceBs = variant?.price_bs
      ? Number(variant.price_bs)
      : Number(product.price_bs)
    const priceUsd = variant?.price_usd
      ? Number(variant.price_usd)
      : Number(product.price_usd)

    // Construir nombre con variante si existe
    const productName = variant
      ? `${product.name} (${variant.variant_type}: ${variant.variant_value})`
      : product.name

    addItem({
      product_id: product.id,
      product_name: productName,
      qty: 1,
      unit_price_bs: priceBs,
      unit_price_usd: priceUsd,
      variant_id: variant?.id || null,
      variant_name: variant ? `${variant.variant_type}: ${variant.variant_value}` : null,
    })
    toast.success(`${productName} agregado al carrito`)
  }

  const handleProductClick = async (product: any) => {
    // Verificar si el producto tiene variantes activas
    try {
      const variants = await productVariantsService.getVariantsByProduct(product.id)
      const activeVariants = variants.filter((v) => v.is_active)

      if (activeVariants.length > 0) {
        // Mostrar selector de variantes
        setSelectedProductForVariant({ id: product.id, name: product.name })
        setShowVariantSelector(true)
      } else {
        // Agregar directamente sin variante
        handleAddToCart(product, null)
      }
    } catch (error) {
      // Si hay error, agregar sin variante
      handleAddToCart(product, null)
    }
  }

  const handleVariantSelect = (variant: ProductVariant | null) => {
    if (selectedProductForVariant) {
      const product = products.find((p) => p.id === selectedProductForVariant.id)
      if (product) {
        handleAddToCart(product, variant)
      }
    }
    setShowVariantSelector(false)
    setSelectedProductForVariant(null)
  }

  const handleUpdateQty = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeItem(itemId)
    } else {
      updateItem(itemId, { qty: newQty })
    }
  }

  const total = getTotal()
  const hasOpenCash = !!currentCashSession?.id

  // Crear venta
  const createSaleMutation = useMutation({
    mutationFn: salesService.create,
    // Necesitamos ejecutar la mutación incluso en modo offline para encolar la venta
    // y usar el fallback local. Si queda en 'online', react-query la pausa
    // hasta que vuelva la conexión y el botón se queda en "Procesando...".
    networkMode: 'always',
    onSuccess: async (sale) => {
      const isOnline = navigator.onLine
      if (isOnline) {
        toast.success(`Venta #${sale.id.slice(0, 8)} procesada exitosamente`)
      } else {
        toast.success(
          `Venta #${sale.id.slice(0, 8)} guardada localmente. Se sincronizará cuando vuelva la conexión.`,
          { duration: 5000 }
        )
      }

      // Asignar seriales si hay
      if (pendingSerials && Object.keys(pendingSerials).length > 0 && isOnline) {
        try {
          // Obtener los items de la venta para mapear seriales
          const saleItems = sale.items || []
          for (const [productId, serialNumbers] of Object.entries(pendingSerials)) {
            const saleItem = saleItems.find((item) => item.product_id === productId)
            if (saleItem && serialNumbers.length > 0) {
              await productSerialsService.assignSerialsToSale({
                sale_id: sale.id,
                sale_item_id: saleItem.id,
                serial_numbers: serialNumbers,
              })
            }
          }
          setPendingSerials({}) // Limpiar seriales pendientes
        } catch (err) {
          console.error('[POS] Error al asignar seriales:', err)
          toast.error('Venta creada pero hubo un error al asignar seriales')
        }
      }

      // Intentar imprimir ticket
      if (shouldPrint) {
        try {
          printService.printSale(sale, {
          storeName: 'SISTEMA POS',
            cartItems: lastCartSnapshot.current.map((ci) => ({
              product_id: ci.product_id,
              product_name: ci.product_name,
              qty: ci.qty,
              unit_price_bs: ci.unit_price_bs,
              unit_price_usd: ci.unit_price_usd,
              discount_bs: ci.discount_bs,
              discount_usd: ci.discount_usd,
            })),
            cashierName: user?.full_name || undefined,
          })
        } catch (err) {
          console.warn('[POS] No se pudo imprimir el ticket:', err)
        }
      }

      clear()
      setShowCheckout(false)
    },
    onError: (error: any) => {
      console.error('[POS] ❌ Error en createSaleMutation:', {
        error,
        message: error.message,
        code: error.code,
        response: error.response,
        stack: error.stack,
      })
      
      // Si es un error de "requiere store_id y user_id", es porque está offline sin datos
      if (error.message?.includes('store_id y user_id')) {
        toast.error('Error: No se pueden guardar ventas offline sin datos de usuario. Por favor, recarga la página.')
        return
      }
      
      const message = error.response?.data?.message || error.message || 'Error al procesar la venta'
      toast.error(message)
    },
  })

  const handleCheckout = (checkoutData: {
    payment_method: 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER' | 'FIAO'
    currency: 'BS' | 'USD' | 'MIXED'
    exchange_rate: number
    cash_payment?: {
      received_usd: number
      change_bs?: number
    }
    customer_id?: string
    customer_name?: string
    customer_document_id?: string
    customer_phone?: string
    customer_note?: string
    serials?: Record<string, string[]> // product_id -> serial_numbers[]
    invoice_series_id?: string | null // ID de la serie de factura
  }) => {
    const saleItems = items.map((item) => ({
      product_id: item.product_id,
      qty: item.qty,
      discount_bs: item.discount_bs || 0,
      discount_usd: item.discount_usd || 0,
      variant_id: item.variant_id || null,
    }))

    // Bloquear checkout si no hay caja abierta
    if (!hasOpenCash) {
      toast.error('No hay caja abierta. Debes abrir caja antes de procesar ventas.')
      return
    }

    // Guardar snapshot para impresión
    lastCartSnapshot.current = [...items]

    // Guardar seriales para asignar después de crear la venta
    if (checkoutData.serials) {
      setPendingSerials(checkoutData.serials)
    }

    createSaleMutation.mutate({
      items: saleItems,
      exchange_rate: checkoutData.exchange_rate,
      currency: checkoutData.currency,
      payment_method: checkoutData.payment_method,
      cash_payment: checkoutData.cash_payment,
      cash_session_id: currentCashSession?.id || undefined, // Asociar con sesión de caja actual
      customer_id: checkoutData.customer_id,
      customer_name: checkoutData.customer_name,
      customer_document_id: checkoutData.customer_document_id,
      customer_phone: checkoutData.customer_phone,
      customer_note: checkoutData.customer_note,
      note: null,
      invoice_series_id: checkoutData.invoice_series_id || undefined,
      // Datos para modo offline
      store_id: user?.store_id,
      user_id: user?.user_id,
      user_role: user?.role || 'cashier',
    })
  }

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Header - Mobile/Desktop */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Punto de Venta</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">Busca y agrega productos al carrito</p>
      </div>

      {/* Layout: Mobile (stacked) / Tablet-Desktop (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Búsqueda y Lista de Productos */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {/* Barra de búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 sm:w-5 sm:h-5 z-10" />
            <Input
              type="text"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 sm:pl-10 h-11 sm:h-12 text-base sm:text-lg"
              autoFocus
            />
          </div>

          {/* Productos rápidos (solo si está habilitado) */}
          {fastCheckoutConfig?.enabled && (
            <QuickProductsGrid onProductClick={handleQuickProductClick} />
          )}

          {/* Lista de productos */}
          <Card className="border border-border flex flex-col">
            <CardContent className="p-0 flex-1 min-h-0">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 border-b border-border last:border-b-0">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                      <div className="text-right space-y-2">
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="p-6 sm:p-8 text-center">
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Search className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm sm:text-base font-medium text-foreground mb-1">
                      {searchQuery ? 'No se encontraron productos' : 'Busca un producto'}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {searchQuery ? 'Intenta con otro término de búsqueda' : 'Escribe para buscar en el inventario'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-[calc(100vh-250px)] sm:h-[calc(100vh-300px)] lg:h-[calc(100vh-350px)]">
                  <ScrollArea className="h-full">
                    <div>
                    {products.map((product, index) => (
                  <div
                    key={product.id}
                    className={cn(
                      "p-3 sm:p-4 hover:bg-accent/50 active:bg-accent/80 transition-colors cursor-pointer touch-manipulation group relative",
                      index > 0 && "border-t border-border"
                    )}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    onClick={() => handleProductClick(product)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleProductClick(product)
                      }
                    }}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-0 bg-primary opacity-0 group-hover:opacity-100 group-hover:w-0.5 transition-all duration-200" />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base text-foreground truncate group-hover:text-primary transition-colors">
                          {product.name}
                        </h3>
                        {product.category && (
                          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                            {product.category}
                          </p>
                        )}
                        {product.barcode && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 truncate font-mono">
                            {product.barcode}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-base sm:text-lg text-foreground">
                          ${Number(product.price_usd).toFixed(2)}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Bs. {Number(product.price_bs).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Carrito - Sticky en desktop, normal en mobile */}
        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-20 border border-border">
            <div className="p-3 sm:p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                Carrito
                {items.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {items.length}
                  </Badge>
                )}
              </h2>
              {items.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clear}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
                >
                  Limpiar
                </Button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="p-6 sm:p-8 text-center">
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <ShoppingCart className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm sm:text-base font-medium text-foreground mb-1">
                    Carrito vacío
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Agrega productos para comenzar
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="h-[300px] sm:h-[400px] lg:h-[calc(100vh-450px)]">
                  <ScrollArea className="h-full">
                    <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="bg-muted/50 rounded-lg p-2.5 sm:p-3 border border-border hover:border-primary/50 transition-all shadow-sm">
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-sm text-foreground truncate">
                            {item.product_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ${item.unit_price_usd.toFixed(2)} c/u
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeItem(item.id)
                          }}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 flex-shrink-0"
                          aria-label="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUpdateQty(item.id, item.qty - 1)
                            }}
                            className="h-8 w-8"
                            aria-label="Disminuir cantidad"
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center font-semibold text-sm sm:text-base tabular-nums">
                            {item.qty}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUpdateQty(item.id, item.qty + 1)
                            }}
                            className="h-8 w-8"
                            aria-label="Aumentar cantidad"
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="font-semibold text-sm sm:text-base text-foreground tabular-nums">
                          ${(item.qty * item.unit_price_usd).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="p-3 sm:p-4 border-t border-border space-y-3 sm:space-y-4 bg-muted/30">
                  {!hasOpenCash && (
                    <div className="rounded-md border border-amber-500/70 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Debes abrir caja para procesar ventas.
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Imprimir ticket</Label>
                        <p className="text-xs text-muted-foreground">
                          Preguntar antes de gastar tinta/papel
                        </p>
                      </div>
                      <Switch checked={shouldPrint} onCheckedChange={setShouldPrint} />
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-medium text-muted-foreground">Total USD:</span>
                      <span className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                        ${total.usd.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-muted-foreground">Total Bs:</span>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        Bs. {total.bs.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowCheckout(true)}
                    disabled={items.length === 0 || !hasOpenCash}
                    className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold shadow-sm"
                    size="lg"
                  >
                    Procesar Venta
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* Modal de checkout */}
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        items={items}
        total={total}
        onConfirm={handleCheckout}
        isLoading={createSaleMutation.isPending}
      />

      {/* Selector de variantes */}
      {selectedProductForVariant && (
        <VariantSelector
          isOpen={showVariantSelector}
          onClose={() => {
            setShowVariantSelector(false)
            setSelectedProductForVariant(null)
          }}
          productId={selectedProductForVariant.id}
          productName={selectedProductForVariant.name}
          onSelect={handleVariantSelect}
        />
      )}
    </div>
  )
}
