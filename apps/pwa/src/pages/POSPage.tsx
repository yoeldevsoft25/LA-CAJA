import { useRef, useCallback, useMemo, lazy, Suspense, useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CatalogHeader } from '@/components/pos/catalog/CatalogHeader'
import { ProductCatalog } from '@/components/pos/catalog/ProductCatalog'
import { QuickActions } from '@/components/pos/catalog/QuickActions'
import { productsService, ProductSearchResponse } from '@/services/products.service'
import { realtimeWebSocketService } from '@/services/realtime-websocket.service'
import { useOnline } from '@/hooks/use-online'
import { fastCheckoutService, QuickProduct } from '@/services/fast-checkout.service'
import { printService } from '@/services/print.service'
import { productSerialsService } from '@/services/product-serials.service'
import { productsCacheService } from '@/services/products-cache.service'
import { salesService } from '@/services/sales.service'
import { exchangeService } from '@/services/exchange.service'
import { cashService } from '@/services/cash.service'
import { useCart, CartItem, CART_IDS } from '@/stores/cart.store'
import { useAuth } from '@/stores/auth.store'
import { inventoryService } from '@/services/inventory.service'
import { warehousesService } from '@/services/warehouses.service'
import toast from '@/lib/toast'

// Hooks POS Modularizados
import { usePOSCartActions } from '@/hooks/pos/usePOSCartActions'
import { usePOSScanner } from '@/hooks/pos/usePOSScanner'
import { usePOSHotkeys } from '@/hooks/pos/usePOSHotkeys'

// ⚡ OPTIMIZACIÓN: Lazy load del modal grande
const CheckoutModal = lazy(() => import('@/components/pos/CheckoutModal'))
import VariantSelector from '@/components/variants/VariantSelector'
import WeightInputModal from '@/components/pos/WeightInputModal'
import POSCart from '@/components/pos/cart/POSCart'
import { SuccessOverlay } from '@/components/pos/SuccessOverlay'
import { cn } from '@/lib/utils'
import { useMobileDetection } from '@/hooks/use-mobile-detection'
import { useOrientation } from '@/hooks/use-orientation'

export default function POSPage() {
  const { user } = useAuth()
  const isMobile = useMobileDetection()
  const { isLandscape } = useOrientation()

  // Detectar si es tablet (no móvil pero pantalla < 1024px)
  const isTablet = !isMobile && window.innerWidth >= 640 && window.innerWidth < 1024
  // Modo landscape optimizado para tablets en horizontal
  const isTabletLandscape = isTablet && isLandscape
  const MAX_QTY_PER_PRODUCT = 999

  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [showCheckout, setShowCheckout] = useState(false)
  const [shouldPrint, setShouldPrint] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const [pendingSerials, setPendingSerials] = useState<Record<string, string[]>>({})
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null)
  const [invalidCartProductIds, setInvalidCartProductIds] = useState<string[]>([])
  const [successSaleId, setSuccessSaleId] = useState<string | null>(null)
  const { isOnline } = useOnline()
  const {
    items,
    updateItem,
    removeItem,
    clear,
    getTotal,
    activeCartId,
    setActiveCart,
    carts,
  } = useCart()

  const cartSummaries = useMemo(() => {
    return CART_IDS.map((id) => {
      const cartItems = carts[id]?.items ?? []
      const totalUsd = cartItems.reduce(
        (sum, item) =>
          sum + item.qty * item.unit_price_usd - (item.discount_usd || 0),
        0
      )
      return {
        id,
        count: cartItems.reduce((s, i) => s + i.qty, 0),
        totalUsd,
      }
    })
  }, [carts])

  const handleSwitchCart = useCallback(
    (id: string) => {
      if (id === activeCartId) return
      setActiveCart(id)
      setShowCheckout(false)
      // setDiscountInputs({})
      setPendingSerials({})
    },
    [activeCartId, setActiveCart]
  )
  const lastCartSnapshot = useRef<CartItem[]>([])


  useEffect(() => {
    if (items.length === 0) {
      setInvalidCartProductIds([])
      return
    }
    setInvalidCartProductIds((prev) =>
      prev.filter((productId) => items.some((item) => item.product_id === productId))
    )
  }, [items])


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

  // Obtener tasa BCV para convertir descuentos
  const { data: bcvRateData } = useQuery({
    queryKey: ['exchange', 'bcv'],
    queryFn: () => exchangeService.getBCVRate(),
    staleTime: 1000 * 60 * 5, // 5 minutos (antes 2 horas)
    gcTime: Infinity,
    refetchInterval: 1000 * 60 * 5, // Refrescar cada 5 minutos
  })

  // Obtener bodega por defecto
  const { data: defaultWarehouse } = useQuery({
    queryKey: ['warehouses', 'default'],
    queryFn: () => warehousesService.getDefault(),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })


  // Prellenar bodega por defecto
  useEffect(() => {
    if (defaultWarehouse && !selectedWarehouseId) {
      setSelectedWarehouseId(defaultWarehouse.id)
    }
  }, [defaultWarehouse, selectedWarehouseId])

  // --- REALTIME EXCHANGE RATE SYNC (SOCKET.IO) ---
  useEffect(() => {
    // Asegurar conexión al socket
    if (!realtimeWebSocketService.connected) {
      realtimeWebSocketService.connect()
    }

    // Suscribirse a actualizaciones de tasa
    const unsubscribe = realtimeWebSocketService.onExchangeRateUpdate((data) => {
      console.log('[POS] Nueva tasa recibida:', data)
      toast.info(`Tasa actualizada: ${data.rate} Bs/USD (Realtime)`, { id: 'rate-update' })

      // Actualizar cache inmediatamente sin refetch (Optimistic Update)
      queryClient.setQueryData(['exchange', 'bcv'], (old: any) => {
        if (!old) return old
        return {
          ...old,
          rate: data.rate,
          timestamp: new Date(data.timestamp).toISOString(),
          source: 'socket',
        }
      })

      // Invalidar para asegurar consistencia (opcional, pero seguro)
      queryClient.invalidateQueries({ queryKey: ['exchange', 'bcv'] })
    })

    return () => {
      unsubscribe()
    }
  }, [queryClient])

  // --- HOOKS POS MODULARES ---

  // 1. Acciones de carrito (validaciones, peso, stock)
  const {
    handleProductClick,
    // Variant Modal State
    showVariantSelector, setShowVariantSelector,
    selectedProductForVariant, setSelectedProductForVariant,
    handleVariantSelect,
    // Weight Modal State
    showWeightModal, setShowWeightModal,
    selectedWeightProduct, setSelectedWeightProduct,
    handleWeightConfirm
  } = usePOSCartActions({
    storeId: user?.store_id,
    isOnline
  })

  // 2. Scanner (Audio, Búsqueda, Estado)
  const {
    scannerStatus,
    scannerSoundEnabled,
    setScannerSoundEnabled,
  } = usePOSScanner({
    storeId: user?.store_id,
    onProductFound: async (product) => {
      // Al encontrar por scanner, limpiamos búsqueda visual
      setSearchQuery('')
      searchInputRef.current?.blur()
      // Y mandamos click de producto
      await handleProductClick(product)
    }
  })

  // 3. Hotkeys (Teclado)
  usePOSHotkeys({
    searchInputRef,
    hasOpenCash: !!currentCashSession?.id,
    onCheckout: () => setShowCheckout(true),
    onClear: clear,
    fastCheckoutEnabled: !!fastCheckoutConfig?.enabled,
    onQuickProduct: (qp) => {
      if (qp.product) handleProductClick(qp.product)
    }
  })

  const [initialData, setInitialData] = useState<ProductSearchResponse | undefined>(undefined)
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
  const { data: productsData, isLoading, isError: isProductsError } = useQuery({
    queryKey: ['products', 'search', searchQuery, user?.store_id],
    queryFn: () =>
      Promise.race([
        productsService.search(
          {
            q: searchQuery || undefined,
            is_active: true,
            limit: 50,
          },
          user?.store_id
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 8000)
        ),
      ]),
    enabled: (searchQuery.length >= 2 || searchQuery.length === 0) && !!user?.store_id && isOnline,
    staleTime: 1000 * 60 * 5, // 5 minutos
    gcTime: Infinity, // Nunca eliminar del cache
    retry: (failureCount, error: any) => {
      if (error?.message === 'timeout') {
        return failureCount < 1
      }
      return false
    },
    retryDelay: 1200,
    initialData: !isOnline ? initialData : undefined,
    placeholderData: !isOnline ? initialData : undefined,
  })

  const products = productsData?.products || []
  const suggestedProducts = useMemo(() => {
    const trimmedQuery = searchQuery.trim()
    if (trimmedQuery.length < 2) return []
    const normalized = trimmedQuery.toLowerCase()
    return products
      .filter((product: any) => {
        const nameMatch = product.name?.toLowerCase().includes(normalized)
        const barcodeMatch = product.barcode?.includes(trimmedQuery)
        return nameMatch || barcodeMatch
      })
      .slice(0, 6)
  }, [products, searchQuery])
  const { data: lowStockStatuses } = useQuery({
    queryKey: ['inventory', 'low-stock', 'pos', searchQuery, selectedWarehouseId],
    queryFn: () =>
      inventoryService.getStockStatus({
        search: searchQuery || undefined,
        low_stock_only: true,
        warehouse_id: selectedWarehouseId || undefined,
        limit: 50,
      }),
    enabled: isOnline && products.length > 0,
    staleTime: 1000 * 60, // 1 minuto
    gcTime: 1000 * 60 * 5,
    retry: 1,
  })
  const lowStockIds = useMemo(() => {
    return new Set((lowStockStatuses || []).map((item) => item.product_id))
  }, [lowStockStatuses])
  const { data: recentSales } = useQuery({
    queryKey: ['sales', 'recent-products', user?.store_id],
    queryFn: () =>
      salesService.list({
        store_id: user?.store_id,
        limit: 12,
        offset: 0,
      }),
    enabled: isOnline && !!user?.store_id,
    staleTime: 1000 * 60, // 1 minuto
    gcTime: 1000 * 60 * 5,
  })
  const recentProducts = useMemo(() => {
    const sales = recentSales?.sales || []
    const latestByProduct = new Map<
      string,
      { product_id: string; name: string; sold_at: string; is_weight_product?: boolean; weight_unit?: string | null }
    >()

    sales.forEach((sale) => {
      sale.items?.forEach((item) => {
        if (!item.product_id) return
        const existing = latestByProduct.get(item.product_id)
        const name = item.product?.name || 'Producto'
        if (!existing || new Date(sale.sold_at) > new Date(existing.sold_at)) {
          latestByProduct.set(item.product_id, {
            product_id: item.product_id,
            name,
            sold_at: sale.sold_at,
            is_weight_product: item.is_weight_product,
            weight_unit: item.weight_unit || null,
          })
        }
      })
    })

    return Array.from(latestByProduct.values())
      .sort((a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime())
      .slice(0, 8)
  }, [recentSales])

  useEffect(() => {
    if (!isOnline || !user?.store_id) return

    const prefetchFrequentProducts = async () => {
      try {
        let quickProducts = queryClient.getQueryData<QuickProduct[]>([
          'fast-checkout',
          'quick-products',
        ])

        if (!quickProducts && fastCheckoutConfig?.enabled) {
          quickProducts = await queryClient.fetchQuery({
            queryKey: ['fast-checkout', 'quick-products'],
            queryFn: () => fastCheckoutService.getQuickProducts(),
            staleTime: 1000 * 60 * 5,
          })
        }

        const quickIds = (quickProducts || [])
          .map((product) => product.product_id)
          .filter(Boolean)

        const recentIds = (recentSales?.sales || [])
          .flatMap((sale) => sale.items?.map((item) => item.product_id) || [])
          .filter(Boolean)

        const frequentIds = Array.from(new Set([...quickIds, ...recentIds])).slice(0, 20)

        await Promise.all(
          frequentIds.map((productId) =>
            queryClient.prefetchQuery({
              queryKey: ['products', productId],
              queryFn: () => productsService.getById(productId, user?.store_id),
              staleTime: 1000 * 60 * 10, // 10 minutos de frescura para evitar 429
            })
          )
        )
      } catch (error) {
        // Silenciar errores de precarga (opcional)
      }
    }

    void prefetchFrequentProducts()
  }, [fastCheckoutConfig?.enabled, isOnline, queryClient, recentSales, user?.store_id])


  const handleUpdateQty = async (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeItem(itemId)
      return
    }

    const item = items.find((i) => i.id === itemId)
    if (!item) return

    if (!item.is_weight_product && newQty > MAX_QTY_PER_PRODUCT) {
      toast.error(`Cantidad máxima por producto: ${MAX_QTY_PER_PRODUCT}`)
      return
    }

    // Solo validar si se está aumentando la cantidad y no es producto por peso
    if (newQty > item.qty && !item.is_weight_product && isOnline) {
      try {
        const stockInfo = await inventoryService.getProductStock(item.product_id)
        const availableStock = stockInfo.current_stock

        if (newQty > availableStock) {
          toast.error(
            `Stock insuficiente. Disponible: ${availableStock}`,
            { icon: '⚠️', duration: 3000 }
          )
          return
        }
      } catch (error) {
        // Si falla la verificación, permitir el cambio
        console.warn('[POS] No se pudo verificar stock:', error)
      }
    }

    updateItem(itemId, { qty: newQty })
  }

  const hasOpenCash = !!currentCashSession?.id
  const exchangeRate = bcvRateData?.rate && bcvRateData.rate > 0 ? bcvRateData.rate : 36

  /*
  const resolveItemRate = (item: CartItem) => {
    // Si el item tiene tasa guardada, usarla. Si no, usar la global.
    // TODO: Implementar item.exchange_rate si decidimos guardarla por item
    return exchangeRate
  }
  */

  // Calcular totales recalculando precios en BS con la tasa actual
  const calculateTotalWithCurrentRate = useMemo(() => {
    const baseTotal = getTotal()
    // Recalcular total en BS usando la tasa actual (exchangeRate) para asegurar consistencia
    // Siempre usar la tasa actual, no la tasa del producto guardada
    let recalculatedBs = 0
    items.forEach((item) => {
      const lineSubtotalUsd = item.qty * Number(item.unit_price_usd || 0)
      const lineDiscountUsd = Number(item.discount_usd || 0)
      const lineTotalUsd = lineSubtotalUsd - lineDiscountUsd
      // Recalcular BS usando la tasa actual (exchangeRate), no la tasa del producto
      const recalculatedLineBs = lineTotalUsd * exchangeRate
      recalculatedBs += recalculatedLineBs
    })
    // Siempre usar el recalculado con la tasa actual
    return { bs: recalculatedBs, usd: baseTotal.usd }
  }, [items, exchangeRate, bcvRateData, getTotal])

  const total = calculateTotalWithCurrentRate

  const totalDiscountUsd = items.reduce((sum, item) => sum + Number(item.discount_usd || 0), 0)

  // Porcentaje máximo de descuento permitido (configurable por rol en el futuro)
  // const MAX_DISCOUNT_PERCENT = user?.role === 'owner' ? 100 : 30 // Cajeros: 30%, Dueños: 100%

  // const [discountInputs, setDiscountInputs] = useState<Record<string, string>>({})

  /*
  const handleDiscountChange = (item: CartItem, value: string) => {
    setDiscountInputs((prev) => ({ ...prev, [item.id]: value }))
  
    if (value.trim() === '') {
      updateItem(item.id, { discount_usd: 0, discount_bs: 0 })
      return
    }
  
    const parsed = Number(value)
    if (Number.isNaN(parsed) || parsed < 0) {
      return
    }
  
    // Calcular el precio unitario total de la línea
    const lineTotal = Number(item.unit_price_usd || 0) * Number(item.qty || 1)
  
    // Validar que el descuento no exceda el % máximo permitido
    const discountPercent = lineTotal > 0 ? (parsed / lineTotal) * 100 : 0
    const maxDiscountAmount = (lineTotal * MAX_DISCOUNT_PERCENT) / 100
  
    if (discountPercent > MAX_DISCOUNT_PERCENT) {
      toast.error(`El descuento no puede exceder el ${MAX_DISCOUNT_PERCENT}% del precio (máx: $${maxDiscountAmount.toFixed(2)})`)
      // Aplicar el máximo permitido
      const rate = resolveItemRate(item)
      const maxBs = Math.round(maxDiscountAmount * rate * 100) / 100
      updateItem(item.id, { discount_usd: maxDiscountAmount, discount_bs: maxBs })
      setDiscountInputs((prev) => ({ ...prev, [item.id]: maxDiscountAmount.toFixed(2) }))
      return
    }
  
    const roundedUsd = Math.round(parsed * 100) / 100
    const rate = resolveItemRate(item)
    const roundedBs = Math.round(roundedUsd * rate * 100) / 100
    updateItem(item.id, { discount_usd: roundedUsd, discount_bs: roundedBs })
  }
  */

  /*
  const handleDiscountBlur = (item: CartItem) => {
    const value = Number(item.discount_usd || 0)
    setDiscountInputs((prev) => ({
      ...prev,
      [item.id]: value > 0 ? value.toFixed(2) : '',
    }))
  }
  */


  // Crear venta
  const createSaleMutation = useMutation({
    mutationFn: salesService.create,
    // Necesitamos ejecutar la mutación incluso en modo offline para encolar la venta
    // y usar el fallback local. Si queda en 'online', react-query la pausa
    // hasta que vuelva la conexión y el botón se queda en "Procesando...".
    networkMode: 'always',
    onSuccess: async (sale) => {
      const isOnline = navigator.onLine

      // Activar animación de éxito premium central y evitar toast duplicado en online
      setSuccessSaleId(sale.id.slice(0, 8))

      if (!isOnline) {
        toast.success(
          `Venta #${sale.id.slice(0, 8)} guardada localmente. Se sincronizará cuando vuelva la conexión.`,
          { duration: 5000 }
        )
      }

      // Optimistic update: Inject into sales list cache
      queryClient.setQueriesData({ queryKey: ['sales', 'list'] }, (old: any) => {
        if (!old || !old.sales) return old
        // Prepend the new sale and maintain limit
        return {
          ...old,
          sales: [sale, ...old.sales].slice(0, 50),
          total: (old.total || 0) + 1,
        }
      })

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
    // onSuccess se encargara de limpiar y mostrar exito
  })

  const handleCheckout = async (checkoutData: {
    payment_method: 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER' | 'FIAO' | 'SPLIT'
    currency: 'BS' | 'USD' | 'MIXED'
    exchange_rate: number
    cash_payment?: {
      received_usd: number
      change_bs?: number
      change_rounding?: {
        mode: 'EXACT' | 'CUSTOMER' | 'MERCHANT'
        exact_change_bs: number
        rounded_change_bs: number
        adjustment_bs: number
        consented?: boolean
      }
    }
    cash_payment_bs?: {
      received_bs: number
      change_bs?: number
      change_rounding?: {
        mode: 'EXACT' | 'CUSTOMER' | 'MERCHANT'
        exact_change_bs: number
        rounded_change_bs: number
        adjustment_bs: number
        consented?: boolean
      }
    }
    split_payments?: Array<{
      method: string
      amount_usd?: number
      amount_bs?: number
      reference?: string
      bank_code?: string
      phone?: string
      card_last_4?: string
      note?: string
    }>
    customer_id?: string
    customer_name?: string
    customer_document_id?: string
    customer_phone?: string
    customer_note?: string
    note?: string // Nota/comentario de la venta
    serials?: Record<string, string[]> // product_id -> serial_numbers[]
    invoice_series_id?: string | null // ID de la serie de factura
    price_list_id?: string | null // ID de la lista de precio
    promotion_id?: string | null // ID de la promoción
    warehouse_id?: string | null // ID de la bodega de donde se vende
    generate_fiscal_invoice?: boolean // Si se debe generar factura fiscal
  }) => {
    if (items.length === 0) return
    setInvalidCartProductIds([])
    try {
      const uniqueProductIds = Array.from(new Set(items.map((item) => item.product_id)))
      const results = await Promise.allSettled(
        uniqueProductIds.map((productId) => productsService.getById(productId, user?.store_id))
      )
      const invalidIds = results
        .map((result, index) => {
          if (result.status === 'rejected') {
            return uniqueProductIds[index]
          }
          return result.value.is_active ? null : uniqueProductIds[index]
        })
        .filter((value): value is string => Boolean(value))

      if (invalidIds.length > 0) {
        setInvalidCartProductIds(invalidIds)
        toast.error('Hay productos inactivos o eliminados en el carrito')
        return
      }
    } catch (error) {
      toast.error('No se pudo validar el carrito. Intenta de nuevo.')
      return
    }
    const saleItems = items.map((item) => {
      const isWeightProduct = Boolean(item.is_weight_product)

      return {
        product_id: item.product_id,
        qty: item.qty,
        discount_bs: item.discount_bs || 0,
        discount_usd: item.discount_usd || 0,
        variant_id: item.variant_id || null,
        is_weight_product: isWeightProduct,
        ...(isWeightProduct
          ? {
            weight_unit: item.weight_unit ?? null,
            weight_value: item.weight_value != null ? item.weight_value : null,
            price_per_weight_bs: item.price_per_weight_bs != null ? item.price_per_weight_bs : null,
            price_per_weight_usd: item.price_per_weight_usd != null ? item.price_per_weight_usd : null,
          }
          : {}),
      }
    })

    // Bloquear checkout si no hay caja abierta
    if (!hasOpenCash) {
      toast.error('No hay caja abierta. Debes abrir caja antes de procesar ventas.')
      return
    }

    // ⚠️ VALIDACIÓN CRÍTICA: Verificar que user_id esté disponible
    if (!user?.user_id) {
      toast.error('Error: No se pudo identificar al usuario. Por favor, recarga la página e inicia sesión nuevamente.')
      return
    }

    // Guardar snapshot para impresión
    lastCartSnapshot.current = [...items]

    // Guardar seriales para asignar después de crear la venta
    if (checkoutData.serials) {
      setPendingSerials(checkoutData.serials)
    }

    // Validar tasa de cambio
    if (!checkoutData.exchange_rate || checkoutData.exchange_rate <= 0) {
      toast.error('Error: Tasa de cambio inválida. Actualizando...');
      queryClient.invalidateQueries({ queryKey: ['exchange', 'bcv'] });
      return;
    }

    createSaleMutation.mutate({
      items: saleItems,
      exchange_rate: checkoutData.exchange_rate,
      currency: checkoutData.currency,
      payment_method: checkoutData.payment_method,
      cash_payment: checkoutData.cash_payment,
      split_payments: checkoutData.split_payments, // Pagos divididos (multi-tasa)
      cash_session_id: currentCashSession?.id || undefined, // Asociar con sesión de caja actual
      customer_id: checkoutData.customer_id,
      customer_name: checkoutData.customer_name,
      customer_document_id: checkoutData.customer_document_id,
      customer_phone: checkoutData.customer_phone,
      customer_note: checkoutData.customer_note,
      note: checkoutData.note || null,
      invoice_series_id: checkoutData.invoice_series_id || undefined,
      price_list_id: checkoutData.price_list_id || undefined,
      promotion_id: checkoutData.promotion_id || undefined,
      warehouse_id: checkoutData.warehouse_id || undefined,
      generate_fiscal_invoice: checkoutData.generate_fiscal_invoice,
      // Datos para modo offline
      store_id: user?.store_id,
      user_id: user?.user_id,
      user_role: user?.role || 'cashier',
    })
  }


  return (
    <div className="h-[calc(100vh-4rem)] max-w-7xl mx-auto overflow-hidden flex flex-col p-2 lg:p-4">
      {/* Layout: Mobile (stacked) / Tablet Landscape (optimizado) / Desktop (side by side) */}
      <div className={cn(
        "grid gap-3 sm:gap-4 flex-1 min-h-0",
        isTabletLandscape ? "grid-cols-[1.3fr_1fr]" : "grid-cols-1 lg:grid-cols-[1fr_400px]"
      )}>
        {/* Búsqueda y Lista de Productos */}
        {/* Columna Izquierda: Catálogo */}
        <div className={cn(
          "flex flex-col h-full overflow-hidden bg-card/30 rounded-2xl border-2 border-border shadow-md p-3"
        )}>
          <CatalogHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            scannerStatus={scannerStatus}
            scannerSoundEnabled={scannerSoundEnabled}
            onToggleScannerSound={() => setScannerSoundEnabled(!scannerSoundEnabled)}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ['products'] })
              toast.success('Actualizando productos...')
            }}
            isRefetching={isLoading}
          />

          <QuickActions
            recentProducts={recentProducts}
            suggestedProducts={suggestedProducts}
            isSearching={searchQuery.length > 0}
            onProductClick={handleProductClick}
            onRecentClick={(item: any) => {
              const inList = products.find((p: any) => p.id === item.product_id)
              if (inList) handleProductClick(inList)
              else setSearchQuery(item.name)
            }}
          />

          <div className="flex-1 min-h-0 relative">
            <ProductCatalog
              products={products as any[]}
              isLoading={isLoading}
              isError={isProductsError}
              searchQuery={searchQuery}
              lowStockIds={lowStockIds}
              onProductClick={handleProductClick}
              exchangeRate={exchangeRate}
            />
          </div>
        </div>

        {/* Carrito - Flex para ocupar altura completa */}
        <div className={cn(
          "flex flex-col h-full overflow-hidden min-h-0",
          !isTabletLandscape && "lg:col-span-1"
        )}>
          <POSCart
            items={items}
            cartSummaries={cartSummaries}
            activeCartId={activeCartId}
            total={total}
            totalDiscountUsd={totalDiscountUsd}
            hasOpenCash={hasOpenCash}
            isMobile={isMobile}
            isTabletLandscape={isTabletLandscape}
            invalidCartProductIds={invalidCartProductIds}
            shouldPrint={shouldPrint}
            setShouldPrint={setShouldPrint}
            onSwitchCart={handleSwitchCart}
            onCheckout={() => setShowCheckout(true)}
            onUpdateQty={handleUpdateQty}
            onRemoveItem={removeItem}
            onClearCart={clear}
            exchangeRate={exchangeRate}
          />
        </div>
      </div>

      {/* Modal de checkout - Lazy loaded para reducir bundle inicial */}
      {
        showCheckout && (
          <Suspense fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Cargando checkout...</p>
              </div>
            </div>
          }>
            <CheckoutModal
              isOpen={showCheckout}
              onClose={() => setShowCheckout(false)}
              items={items}
              total={total}
              onConfirm={handleCheckout}
              isLoading={createSaleMutation.isPending}
            />
          </Suspense>
        )
      }

      {/* Selector de variantes */}
      {
        selectedProductForVariant && (
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
        )
      }

      {/* Modal de entrada de peso */}
      <WeightInputModal
        isOpen={showWeightModal}
        onClose={() => {
          setShowWeightModal(false)
          setSelectedWeightProduct(null)
        }}
        product={selectedWeightProduct}
        onConfirm={handleWeightConfirm}
      />

      {/* Animación de éxito premium centralizada */}
      <SuccessOverlay
        isOpen={!!successSaleId}
        onAnimationComplete={() => setSuccessSaleId(null)}
        message={isOnline ? `Venta #${successSaleId} procesada exitosamente` : `Venta #${successSaleId} almacenada en OFFLINE`}
      />
    </div>
  )
}
