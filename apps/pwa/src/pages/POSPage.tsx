import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Plus,
  Minus,
  ShoppingCart,
  Trash2,
  Tag,
  Scale,
  Apple,
  Beef,
  Coffee,
  Package,
  Shirt,
  Home,
  Cpu,
  Pill,
  ShoppingBag,
} from 'lucide-react'
import { productsService, ProductSearchResponse } from '@/services/products.service'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { productsCacheService } from '@/services/products-cache.service'
import { salesService } from '@/services/sales.service'
import { exchangeService } from '@/services/exchange.service'
import { cashService } from '@/services/cash.service'
import { useCart, CartItem, CART_IDS } from '@/stores/cart.store'
import { useAuth } from '@/stores/auth.store'
import { useOnline } from '@/hooks/use-online'
import { printService } from '@/services/print.service'
import { fastCheckoutService, QuickProduct } from '@/services/fast-checkout.service'
import { productVariantsService, ProductVariant } from '@/services/product-variants.service'
import { productSerialsService } from '@/services/product-serials.service'
import { warehousesService } from '@/services/warehouses.service'
import { inventoryService } from '@/services/inventory.service'
import { promotionsService } from '@/services/promotions.service'
import toast from '@/lib/toast'
// ⚡ OPTIMIZACIÓN: Lazy load del modal grande (1916 líneas) - solo cargar cuando se abre
const CheckoutModal = lazy(() => import('@/components/pos/CheckoutModal'))
import QuickProductsGrid from '@/components/fast-checkout/QuickProductsGrid'
import VariantSelector from '@/components/variants/VariantSelector'
import WeightInputModal, { WeightProduct } from '@/components/pos/WeightInputModal'
import ScannerStatusBadge from '@/components/pos/ScannerStatusBadge'
import ScannerBarcodeStrip from '@/components/pos/ScannerBarcodeStrip'
import LastSoldProductsCard from '@/components/pos/LastSoldProductsCard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { SwipeableItem } from '@/components/ui/swipeable-item'
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
  const [showVariantSelector, setShowVariantSelector] = useState(false)
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false)
  const [cartPulse, setCartPulse] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<{
    id: string
    name: string
  } | null>(null)
  const [pendingSerials, setPendingSerials] = useState<Record<string, string[]>>({})
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null)
  // Estado para productos por peso
  const [showWeightModal, setShowWeightModal] = useState(false)
  const [selectedWeightProduct, setSelectedWeightProduct] = useState<WeightProduct | null>(null)
  // Estado para indicador visual del scanner
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null)
  const [scannerStatus, setScannerStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle')
  const [discountInputs, setDiscountInputs] = useState<Record<string, string>>({})
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const [scannerSoundEnabled, setScannerSoundEnabled] = useState(true)
  const audioContextRef = useRef<AudioContext | null>(null)
  const [invalidCartProductIds, setInvalidCartProductIds] = useState<string[]>([])
  const listViewportRef = useRef<HTMLDivElement | null>(null)
  const [listScrollTop, setListScrollTop] = useState(0)
  const [listViewportHeight, setListViewportHeight] = useState(0)
  const {
    items,
    addItem,
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
      setDiscountInputs({})
      setPendingSerials({})
    },
    [activeCartId, setActiveCart]
  )
  const lastCartSnapshot = useRef<CartItem[]>([])
  const cartPulseTimeout = useRef<NodeJS.Timeout | null>(null)
  const lastTotalQty = useRef(0)
  const totalQty = useMemo(() => items.reduce((sum, item) => sum + item.qty, 0), [items])
  const handleClearCart = useCallback(() => {
    clear()
    setIsClearDialogOpen(false)
  }, [clear])

  const triggerCartPulse = useCallback(() => {
    if (cartPulseTimeout.current) {
      clearTimeout(cartPulseTimeout.current)
    }
    setCartPulse(true)
    cartPulseTimeout.current = setTimeout(() => {
      setCartPulse(false)
    }, 350)
  }, [])

  useEffect(() => {
    return () => {
      if (cartPulseTimeout.current) {
        clearTimeout(cartPulseTimeout.current)
      }
    }
  }, [])

  useEffect(() => {
    if (totalQty !== lastTotalQty.current) {
      if (totalQty > 0) {
        triggerCartPulse()
      }
      lastTotalQty.current = totalQty
    }
  }, [totalQty, triggerCartPulse])

  useEffect(() => {
    if (items.length === 0) {
      setInvalidCartProductIds([])
      return
    }
    setInvalidCartProductIds((prev) =>
      prev.filter((productId) => items.some((item) => item.product_id === productId))
    )
  }, [items])

  useEffect(() => {
    if (!listViewportRef.current) return
    const updateHeight = () => {
      setListViewportHeight(listViewportRef.current?.clientHeight || 0)
    }
    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(listViewportRef.current)
    return () => observer.disconnect()
  }, [])

  const playScanTone = useCallback((variant: 'success' | 'error') => {
    try {
      const AudioContextClass =
        window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass()
      }
      const context = audioContextRef.current
      if (context.state === 'suspended') {
        void context.resume()
      }

      const oscillator = context.createOscillator()
      const gainNode = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = variant === 'success' ? 880 : 220
      gainNode.gain.value = 0.05

      oscillator.connect(gainNode)
      gainNode.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + (variant === 'success' ? 0.12 : 0.2))
    } catch (error) {
      // Silenciar errores de audio (opcional)
    }
  }, [])

  const getCategoryIcon = useCallback((category?: string | null) => {
    if (!category) return Package
    const normalized = category.toLowerCase()

    if (normalized.includes('bebida') || normalized.includes('drink') || normalized.includes('refresco')) {
      return Coffee
    }
    if (normalized.includes('fruta') || normalized.includes('verdura') || normalized.includes('vegetal')) {
      return Apple
    }
    if (normalized.includes('carne') || normalized.includes('pollo') || normalized.includes('proteina')) {
      return Beef
    }
    if (normalized.includes('ropa') || normalized.includes('vestir') || normalized.includes('moda')) {
      return Shirt
    }
    if (normalized.includes('hogar') || normalized.includes('casa')) {
      return Home
    }
    if (normalized.includes('electron') || normalized.includes('tecno') || normalized.includes('gadget')) {
      return Cpu
    }
    if (normalized.includes('farmacia') || normalized.includes('salud') || normalized.includes('medic')) {
      return Pill
    }
    if (normalized.includes('accesorio') || normalized.includes('general')) {
      return ShoppingBag
    }

    return Package
  }, [])

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
    staleTime: 1000 * 60 * 60 * 2,
    gcTime: Infinity,
  })

  // Obtener bodega por defecto
  const { data: defaultWarehouse } = useQuery({
    queryKey: ['warehouses', 'default'],
    queryFn: () => warehousesService.getDefault(),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  // Obtener promociones activas
  const { data: activePromotions = [] } = useQuery({
    queryKey: ['promotions', 'active'],
    queryFn: () => promotionsService.getActive(),
    staleTime: 1000 * 60 * 2, // 2 minutos
    enabled: !!user?.store_id,
  })

  // Prellenar bodega por defecto
  useEffect(() => {
    if (defaultWarehouse && !selectedWarehouseId) {
      setSelectedWarehouseId(defaultWarehouse.id)
    }
  }, [defaultWarehouse, selectedWarehouseId])

  const getWeightPriceDecimals = useCallback((unit?: string | null) => {
    return unit === 'g' || unit === 'oz' ? 4 : 2
  }, [])

  const resolveWeightProduct = useCallback(async (source: any): Promise<WeightProduct | null> => {
    const normalize = (item: any): WeightProduct | null => {
      const pricePerWeightBs = Number(item.price_per_weight_bs) || 0
      const pricePerWeightUsd = Number(item.price_per_weight_usd) || 0
      const hasPrice = pricePerWeightBs > 0 || pricePerWeightUsd > 0
      if (!hasPrice) return null

      return {
        id: item.id,
        name: item.name,
        weight_unit: item.weight_unit || 'kg',
        price_per_weight_bs: pricePerWeightBs,
        price_per_weight_usd: pricePerWeightUsd,
        min_weight: item.min_weight != null ? Number(item.min_weight) : null,
        max_weight: item.max_weight != null ? Number(item.max_weight) : null,
      }
    }

    let weightProduct = normalize(source)
    if (weightProduct && source.weight_unit) {
      return weightProduct
    }

    try {
      const fresh = await productsService.getById(source.id, user?.store_id)
      weightProduct = normalize(fresh)
    } catch (error) {
      // Silenciar errores y usar lo que ya tenemos
    }

    return weightProduct
  }, [user?.store_id])

  // Handler para productos rápidos
  const handleQuickProductClick = useCallback(async (quickProduct: QuickProduct) => {
    if (!quickProduct.product) {
      toast.error('Producto no encontrado')
      return
    }

    if (quickProduct.product.is_weight_product) {
      const weightProduct = await resolveWeightProduct(quickProduct.product)
      if (!weightProduct) {
        toast.error('Este producto por peso no tiene precio configurado')
        return
      }
      setSelectedWeightProduct(weightProduct)
      setShowWeightModal(true)
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
  }, [addItem, items, resolveWeightProduct, updateItem])

  const fastCheckoutEnabled = Boolean(fastCheckoutConfig?.enabled)

  // Soporte para teclas de acceso rápido
  useEffect(() => {
    if (!fastCheckoutEnabled) return

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
  }, [fastCheckoutEnabled, handleQuickProductClick])

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
  const PRODUCT_ROW_HEIGHT = 104
  const PRODUCT_OVERSCAN = 6
  const listTotalHeight = products.length * PRODUCT_ROW_HEIGHT
  const startIndex = Math.max(
    0,
    Math.floor(listScrollTop / PRODUCT_ROW_HEIGHT) - PRODUCT_OVERSCAN
  )
  const endIndex = Math.min(
    products.length,
    Math.ceil((listScrollTop + listViewportHeight) / PRODUCT_ROW_HEIGHT) + PRODUCT_OVERSCAN
  )
  const visibleProducts = useMemo(
    () => products.slice(startIndex, endIndex),
    [products, startIndex, endIndex]
  )
  const suggestedProducts = useMemo(() => {
    const trimmedQuery = searchQuery.trim()
    if (trimmedQuery.length < 2) return []
    const normalized = trimmedQuery.toLowerCase()
    return products
      .filter((product) => {
        const nameMatch = product.name?.toLowerCase().includes(normalized)
        const barcodeMatch = product.barcode?.includes(trimmedQuery)
        return nameMatch || barcodeMatch
      })
      .slice(0, 6)
  }, [products, searchQuery])
  const complementaryProducts = useMemo(() => {
    if (items.length === 0 || products.length === 0) return []
    const lastItem = items[items.length - 1]
    const lastProduct = products.find((product) => product.id === lastItem.product_id)
    const cartIds = new Set(items.map((item) => item.product_id))
    const category = lastProduct?.category?.toLowerCase()

    const candidates = products.filter((product) => !cartIds.has(product.id))
    if (!category) {
      return candidates.slice(0, 6)
    }

    const sameCategory = candidates.filter(
      (product) => product.category?.toLowerCase() === category
    )
    return (sameCategory.length > 0 ? sameCategory : candidates).slice(0, 6)
  }, [items, products])
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
  const { data: recentSales, isLoading: isRecentSalesLoading } = useQuery({
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

        await Promise.allSettled(
          frequentIds.map((productId) => productsService.getById(productId, user?.store_id))
        )
      } catch (error) {
        // Silenciar errores de precarga (opcional)
      }
    }

    void prefetchFrequentProducts()
  }, [fastCheckoutConfig?.enabled, isOnline, queryClient, recentSales, user?.store_id])

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

    const existingItem = items.find(
      (item) =>
        item.product_id === product.id &&
        (item.variant_id ?? null) === (variant?.id ?? null)
    )

    // Calcular cantidad actual en carrito para este producto
    const currentQtyInCart = existingItem ? existingItem.qty : 0
    const newQty = currentQtyInCart + 1

    if (!product.is_weight_product && newQty > MAX_QTY_PER_PRODUCT) {
      toast.error(`Cantidad máxima por producto: ${MAX_QTY_PER_PRODUCT}`)
      return
    }

    // Validar stock disponible (solo si está online, offline permitir agregar)
    if (isOnline && !product.is_weight_product) {
      try {
        const stockInfo = await inventoryService.getProductStock(product.id)
        const availableStock = stockInfo.current_stock

        if (newQty > availableStock) {
          if (availableStock <= 0) {
            toast.error(`${product.name} no tiene stock disponible`, {
              icon: '📦',
              duration: 3000,
            })
          } else {
            toast.error(
              `Stock insuficiente. Disponible: ${availableStock}, En carrito: ${currentQtyInCart}`,
              { icon: '⚠️', duration: 4000 }
            )
          }
          return
        }

        // Advertir si el stock quedará bajo después de esta venta
        if (availableStock - newQty <= (product.low_stock_threshold || 5) && availableStock - newQty > 0) {
          toast(`Stock bajo: quedarán ${availableStock - newQty} unidades`, {
            icon: '📉',
            duration: 2000,
          })
        }
      } catch (error) {
        // Si falla la verificación de stock, permitir agregar (mejor UX)
        console.warn('[POS] No se pudo verificar stock:', error)
      }
    }

    if (existingItem) {
      updateItem(existingItem.id, { qty: existingItem.qty + 1 })
    } else {
      addItem({
        product_id: product.id,
        product_name: productName,
        qty: 1,
        unit_price_bs: priceBs,
        unit_price_usd: priceUsd,
        variant_id: variant?.id || null,
        variant_name: variant ? `${variant.variant_type}: ${variant.variant_value}` : null,
      })
    }
    triggerCartPulse()
    toast.success(`${productName} agregado al carrito`)
  }

  const handleProductClick = async (product: any) => {
    // Verificar si es un producto por peso
    if (product.is_weight_product) {
      const weightProduct = await resolveWeightProduct(product)
      if (!weightProduct) {
        toast.error('Este producto por peso no tiene precio configurado')
        return
      }
      setSelectedWeightProduct(weightProduct)
      setShowWeightModal(true)
      return
    }

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

  // Handler para escaneo de código de barras
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    // Limpiar búsqueda y quitar foco al instante para feedback visual y que no quede el código en el input
    setSearchQuery('')
    setShowSuggestions(false)
    searchInputRef.current?.blur()

    setLastScannedBarcode(barcode)
    setScannerStatus('scanning')

    try {
      const result = await productsService.search({
        q: barcode,
        is_active: true,
        limit: 5,
      }, user?.store_id)

      // Buscar coincidencia exacta por barcode
      const product = result.products.find(
        (p) => p.barcode?.toLowerCase() === barcode.toLowerCase()
      )

      if (!product) {
        setScannerStatus('error')
        toast.error(`Producto no encontrado: ${barcode}`, {
          icon: '🔍',
          duration: 3000,
        })
        if (scannerSoundEnabled) {
          playScanTone('error')
        }
        setTimeout(() => {
          setScannerStatus('idle')
          setLastScannedBarcode(null)
        }, 2000)
        return
      }

      // Producto encontrado - agregar al carrito
      setScannerStatus('success')
      if (scannerSoundEnabled) {
        playScanTone('success')
      }

      await handleProductClick(product)

      // Limpiar estado después de agregar
      setTimeout(() => {
        setScannerStatus('idle')
        setLastScannedBarcode(null)
      }, 1500)
    } catch (error) {
      console.error('[POS] Error al buscar producto por código de barras:', error)
      setScannerStatus('error')
      toast.error('Error al buscar producto')
      setTimeout(() => {
        setScannerStatus('idle')
        setLastScannedBarcode(null)
      }, 2000)
    }
  }, [user?.store_id, handleProductClick, scannerSoundEnabled, playScanTone])

  // Integrar scanner de código de barras (siempre activo: busca, carrito, etc.)
  useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: true,
    minLength: 4,
    maxLength: 50,
    maxIntervalMs: 100, // Tolerar escáneres más lentos; siempre interceptar en inputs
  })

  // Handler para confirmar peso de producto
  const handleWeightConfirm = (weightValue: number) => {
    if (!selectedWeightProduct) {
      toast.error('Producto no seleccionado')
      return
    }

    const nBs = Number(selectedWeightProduct.price_per_weight_bs)
    const nUsd = Number(selectedWeightProduct.price_per_weight_usd)
    const pricePerWeightBs = Number.isFinite(nBs) ? nBs : 0
    const pricePerWeightUsd = Number.isFinite(nUsd) ? nUsd : 0

    if (pricePerWeightBs <= 0 && pricePerWeightUsd <= 0) {
      toast.error('Este producto por peso no tiene precio configurado')
      return
    }

    const w = Number.isFinite(weightValue) && weightValue > 0 ? weightValue : 0
    if (w <= 0) {
      toast.error('El peso debe ser mayor a 0')
      return
    }

    const unit = selectedWeightProduct.weight_unit || 'kg'
    const unitLabel = unit === 'g' ? 'g' : unit === 'kg' ? 'kg' : unit === 'lb' ? 'lb' : 'oz'

    try {
      addItem({
        product_id: selectedWeightProduct.id,
        product_name: `${selectedWeightProduct.name} (${w} ${unitLabel})`,
        qty: w,
        unit_price_bs: pricePerWeightBs,
        unit_price_usd: pricePerWeightUsd,
        is_weight_product: true,
        weight_unit: selectedWeightProduct.weight_unit,
        weight_value: w,
        price_per_weight_bs: pricePerWeightBs,
        price_per_weight_usd: pricePerWeightUsd,
      })
      triggerCartPulse()
      toast.success(`${selectedWeightProduct.name} (${w} ${unitLabel}) agregado al carrito`)
      setSelectedWeightProduct(null)
    } catch (e) {
      console.error('[POS] Error al agregar producto por peso:', e)
      toast.error('No se pudo agregar al carrito. Intenta de nuevo.')
      throw e
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
  const allowDiscounts = !fastCheckoutConfig?.enabled || fastCheckoutConfig?.allow_discounts
  const exchangeRate = bcvRateData?.rate && bcvRateData.rate > 0 ? bcvRateData.rate : 36
  
  const resolveItemRate = (item: CartItem) => {
    const unitUsd = Number(item.unit_price_usd || 0)
    const unitBs = Number(item.unit_price_bs || 0)
    if (unitUsd > 0 && unitBs > 0) {
      return unitBs / unitUsd
    }
    return exchangeRate > 0 ? exchangeRate : 1
  }
  
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
  
  // #region agent log
  // Log para debug: verificar tasa de cambio y totales
  // ⚡ FIX: Solo ejecutar en desarrollo local (no en producción)
  useEffect(() => {
    // Solo ejecutar si estamos en localhost (desarrollo)
    if (import.meta.env.DEV && window.location.hostname === 'localhost' && items.length > 0) {
      fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'POSPage.tsx:872',
          message: 'Preview total calculation',
          data: {
            exchangeRate,
            totalUsd: total.usd,
            totalBs: total.bs,
            itemsCount: items.length,
            firstItem: items[0] ? {
              product_name: items[0].product_name,
              unit_price_usd: items[0].unit_price_usd,
              unit_price_bs: items[0].unit_price_bs,
              qty: items[0].qty,
            } : null,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'preview-check',
          hypothesisId: 'A',
        }),
      }).catch(() => {});
    }
  }, [items, total, exchangeRate]);
  // #endregion
  const hasDiscounts = items.some(
    (item) => (item.discount_usd || 0) > 0 || (item.discount_bs || 0) > 0
  )
  const totalDiscountUsd = items.reduce((sum, item) => sum + Number(item.discount_usd || 0), 0)

  // Porcentaje máximo de descuento permitido (configurable por rol en el futuro)
  const MAX_DISCOUNT_PERCENT = user?.role === 'owner' ? 100 : 30 // Cajeros: 30%, Dueños: 100%

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

  const handleDiscountBlur = (item: CartItem) => {
    const value = Number(item.discount_usd || 0)
    setDiscountInputs((prev) => ({
      ...prev,
      [item.id]: value > 0 ? value.toFixed(2) : '',
    }))
  }

  const handleClearDiscounts = () => {
    setDiscountInputs({})
    items.forEach((item) => {
      if ((item.discount_usd || 0) > 0 || (item.discount_bs || 0) > 0) {
        updateItem(item.id, { discount_usd: 0, discount_bs: 0 })
      }
    })
  }

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

  const handleCheckout = async (checkoutData: {
    payment_method: 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER' | 'FIAO' | 'SPLIT'
    currency: 'BS' | 'USD' | 'MIXED'
    exchange_rate: number
    cash_payment?: {
      received_usd: number
      change_bs?: number
    }
    cash_payment_bs?: {
      received_bs: number
      change_bs?: number
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
      // Datos para modo offline
      store_id: user?.store_id,
      user_id: user?.user_id,
      user_role: user?.role || 'cashier',
    })
  }

  const handleRecentProductClick = async (productId: string) => {
    const localProduct = products.find((product) => product.id === productId)
    if (localProduct) {
      await handleProductClick(localProduct)
      return
    }

    try {
      const fetched = await productsService.getById(productId, user?.store_id)
      await handleProductClick(fetched)
    } catch (error) {
      toast.error('No se pudo cargar el producto seleccionado')
    }
  }

  const handleSuggestionSelect = async (
    product: ProductSearchResponse['products'][number]
  ) => {
    await handleProductClick(product)
    setSearchQuery('')
    setShowSuggestions(false)
    setActiveSuggestionIndex(-1)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestedProducts.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestionIndex((prev) => (prev + 1) % suggestedProducts.length)
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestionIndex((prev) =>
        prev <= 0 ? suggestedProducts.length - 1 : prev - 1
      )
    }
    if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
      e.preventDefault()
      handleSuggestionSelect(suggestedProducts[activeSuggestionIndex])
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false)
      setActiveSuggestionIndex(-1)
    }
  }

  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      if (e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (e.key === 'F2') {
        e.preventDefault()
        if (items.length > 0 && hasOpenCash) {
          setShowCheckout(true)
        } else if (items.length === 0) {
          toast('Agrega productos al carrito para cobrar', { icon: '🧾' })
        } else if (!hasOpenCash) {
          toast.error('No hay caja abierta')
        }
        return
      }

      if (e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        if (items.length > 0) {
          setIsClearDialogOpen(true)
        }
      }
    }

    window.addEventListener('keydown', handleShortcuts)
    return () => window.removeEventListener('keydown', handleShortcuts)
  }, [hasOpenCash, items.length])

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Header - Mobile/Desktop */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Punto de Venta</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">Busca y agrega productos al carrito</p>
          </div>
          <ScannerStatusBadge
            scannerStatus={scannerStatus}
            scannerSoundEnabled={scannerSoundEnabled}
            onSoundToggle={() => setScannerSoundEnabled(!scannerSoundEnabled)}
          />
        </div>
        <ScannerBarcodeStrip lastScannedBarcode={lastScannedBarcode} scannerStatus={scannerStatus} />
      </div>

      {/* Layout: Mobile (stacked) / Tablet Landscape (optimizado) / Desktop (side by side) */}
      <div className={cn(
        "grid gap-4 sm:gap-6",
        isTabletLandscape ? "grid-cols-[1.8fr_1fr]" : "grid-cols-1 lg:grid-cols-3"
      )}>
        {/* Búsqueda y Lista de Productos */}
        <div className={cn(
          "space-y-3 sm:space-y-4",
          !isTabletLandscape && "lg:col-span-2"
        )}>
          {/* Barra de búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 sm:w-5 sm:h-5 z-10" />
            <Input
              type="text"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowSuggestions(true)
                setActiveSuggestionIndex(-1)
              }}
              className="pl-9 sm:pl-10 h-11 sm:h-12 text-base sm:text-lg"
              autoFocus
              ref={searchInputRef}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
              onKeyDown={handleSearchKeyDown}
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls="pos-search-suggestions"
              data-barcode-passthrough="true"
            />
            {showSuggestions && suggestedProducts.length > 0 && (
              <div
                id="pos-search-suggestions"
                role="listbox"
                className="absolute z-20 mt-2 w-full rounded-lg border border-border bg-background shadow-lg"
              >
                {suggestedProducts.map((product, index) => {
                  const isActive = index === activeSuggestionIndex
                  return (
                    <button
                      key={product.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSuggestionSelect(product)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm',
                        'hover:bg-accent/50',
                        isActive && 'bg-accent/60'
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {product.is_weight_product && (
                            <Scale className="h-3.5 w-3.5 text-primary" />
                          )}
                          <span className="font-medium truncate">{product.name}</span>
                          {product.category && (
                            <span className="text-xs text-muted-foreground truncate">
                              {product.category}
                            </span>
                          )}
                        </div>
                        {product.barcode && (
                          <div className="text-[11px] text-muted-foreground/70 font-mono truncate">
                            {product.barcode}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-xs text-muted-foreground tabular-nums">
                        {product.is_weight_product && product.price_per_weight_usd ? (
                          <>
                            ${Number(product.price_per_weight_usd).toFixed(
                              getWeightPriceDecimals(product.weight_unit)
                            )}/{product.weight_unit}
                          </>
                        ) : (
                          <>${Number(product.price_usd).toFixed(2)}</>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Atajos:</span>
            <Badge variant="outline" className="text-[10px] sm:text-xs">
              / Buscar
            </Badge>
            <Badge variant="outline" className="text-[10px] sm:text-xs">
              F2 Cobrar
            </Badge>
            <Badge variant="outline" className="text-[10px] sm:text-xs">
              Alt + L Limpiar
            </Badge>
            {fastCheckoutEnabled && (
              <Badge variant="secondary" className="text-[10px] sm:text-xs">
                Teclas rapidas en productos
              </Badge>
            )}
          </div>

          {/* Productos rápidos (solo si está habilitado) */}
          {fastCheckoutConfig?.enabled && (
            <QuickProductsGrid onProductClick={handleQuickProductClick} />
          )}

          <LastSoldProductsCard
            recentProducts={recentProducts}
            isLoading={isRecentSalesLoading}
            onProductClick={handleRecentProductClick}
          />

          {/* Sugerencias complementarias */}
          {complementaryProducts.length > 0 && (
            <Card className="border border-border">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Sugerencias para complementar
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Basado en el último agregado
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {complementaryProducts.map((product) => (
                    <Button
                      key={product.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleProductClick(product)}
                      className="h-8 gap-1.5"
                    >
                      {product.is_weight_product && (
                        <Scale className="w-3.5 h-3.5 text-primary" />
                      )}
                      <span className="max-w-[160px] truncate">{product.name}</span>
                      {product.category && (
                        <span className="text-[10px] text-muted-foreground">
                          {product.category}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
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
              ) : isProductsError ? (
                <div className="p-6 sm:p-8 text-center">
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                      <Search className="w-8 h-8 text-destructive" />
                    </div>
                    <p className="text-sm sm:text-base font-medium text-foreground mb-1">
                      Error al buscar productos
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Intenta nuevamente o ajusta el filtro de busqueda
                    </p>
                  </div>
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
                  <ScrollArea
                    className="h-full"
                    viewportRef={listViewportRef}
                    viewportProps={{
                      onScroll: (event) => setListScrollTop(event.currentTarget.scrollTop),
                    }}
                  >
                    <div style={{ height: listTotalHeight, position: 'relative' }}>
                      {visibleProducts.map((product, visibleIndex) => {
                        const absoluteIndex = startIndex + visibleIndex
                        const isLowStock = lowStockIds.has(product.id)

                        const CategoryIcon = getCategoryIcon(product.category)

                        return (
                          <div
                            key={product.id}
                            className={cn(
                              "p-3 sm:p-4 hover:bg-accent/50 active:bg-accent/80 transition-colors cursor-pointer touch-manipulation group absolute left-0 right-0",
                              absoluteIndex > 0 && "border-t border-border",
                              isLowStock && "border-l-2 border-warning/60 bg-warning/5"
                            )}
                            style={{
                              WebkitTapHighlightColor: 'transparent',
                              top: absoluteIndex * PRODUCT_ROW_HEIGHT,
                              height: PRODUCT_ROW_HEIGHT,
                            }}
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
                            <div className="flex items-start justify-between gap-3 min-w-0">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm sm:text-base text-foreground break-words leading-snug group-hover:text-primary transition-colors flex items-center gap-1.5">
                                  {product.is_weight_product && (
                                    <Scale className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                  )}
                                  {product.category && (
                                    <CategoryIcon className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0" />
                                  )}
                                  {product.name}
                                  {isLowStock && (
                                    <Badge className="ml-2 bg-warning/15 text-warning border border-warning/30">
                                      Stock bajo
                                    </Badge>
                                  )}
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
                                {product.is_weight_product && product.price_per_weight_usd ? (
                                  <>
                                    <Badge variant="secondary" className="mb-1 text-[10px] sm:text-xs">
                                      Precio por {product.weight_unit || 'kg'}
                                    </Badge>
                                    <p className="font-bold text-base sm:text-lg text-foreground">
                                      ${Number(product.price_per_weight_usd).toFixed(
                                        getWeightPriceDecimals(product.weight_unit)
                                      )}/{product.weight_unit}
                                    </p>
                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                      Bs. {Number(product.price_per_weight_bs).toFixed(
                                        getWeightPriceDecimals(product.weight_unit)
                                      )}/{product.weight_unit}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="font-bold text-base sm:text-lg text-foreground">
                                      ${Number(product.price_usd).toFixed(2)}
                                    </p>
                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                      Bs. {Number(product.price_bs).toFixed(2)}
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Carrito - Sticky en desktop/tablet landscape, normal en mobile */}
        <div className={cn(
          !isTabletLandscape && "lg:col-span-1"
        )}>
          <Card className={cn(
            "border border-border flex flex-col overflow-hidden min-h-0",
            isTabletLandscape 
              ? "sticky top-20 h-[calc(100vh-140px)]" 
              : "lg:sticky lg:top-20 h-[calc(100vh-140px)] lg:h-[calc(100vh-12rem)]"
          )}>
            {/* Pestañas de ventas simultáneas */}
            <div className="px-2 pt-2 pb-1 border-b border-border/60 flex-shrink-0">
              <div className="flex gap-1">
                {cartSummaries.map((s, i) => {
                  const isActive = s.id === activeCartId
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSwitchCart(s.id)}
                      className={cn(
                        'flex-1 min-w-0 py-1.5 px-2 rounded-md text-xs font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                      )}
                      title={`Venta ${i + 1}${s.count > 0 ? ` · ${s.count} ítems · $${s.totalUsd.toFixed(2)}` : ''}`}
                    >
                      <span className="truncate block">{i + 1}</span>
                      {s.count > 0 && (
                        <span className="tabular-nums">({s.count})</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="p-3 sm:p-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                  <ShoppingCart
                    className={cn(
                      'w-4 h-4 sm:w-5 sm:h-5 transition-transform',
                      cartPulse && 'animate-scale-in text-primary'
                    )}
                  />
                  Carrito
                  {totalQty > 0 && (
                    <Badge
                      variant="secondary"
                      className={cn('ml-1 transition-transform', cartPulse && 'animate-scale-in')}
                    >
                      {totalQty}
                    </Badge>
                  )}
                </h2>
                {/* Badge de promoción activa */}
                {activePromotions.length > 0 && (
                  <Badge 
                    variant="default" 
                    className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 flex items-center gap-1 text-[10px] sm:text-xs"
                  >
                    <Tag className="w-3 h-3" />
                    {activePromotions.length} Promoción{activePromotions.length !== 1 ? 'es' : ''}
                  </Badge>
                )}
              </div>
              {items.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsClearDialogOpen(true)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
                >
                  Limpiar
                </Button>
              )}
            </div>
            <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpiar carrito</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta accion eliminara todos los productos del carrito. Esta seguro?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearCart}>
                    Si, limpiar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {items.length === 0 ? (
              <div className="flex-1 p-6 sm:p-8 text-center">
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
                <div className="flex-1 min-h-0">
                  <ScrollArea className="h-full">
                    <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                      {!allowDiscounts && (
                        <div className="rounded-md border border-amber-500/70 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          Descuentos deshabilitados en modo caja rápida.
                          {hasDiscounts && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="ml-2 h-7 px-2 text-xs"
                              onClick={handleClearDiscounts}
                            >
                              Eliminar descuentos
                            </Button>
                          )}
                        </div>
                      )}
                  {items.map((item) => {
                    const lineSubtotalUsd = item.qty * Number(item.unit_price_usd || 0)
                    // Recalcular precio en BS usando la tasa actual si es necesario
                    // Si el precio en BS no coincide con la conversión actual, usar la tasa
                    const calculatedBsFromUsd = lineSubtotalUsd * exchangeRate
                    const lineSubtotalBs = item.qty * Number(item.unit_price_bs || 0)
                    // Si hay diferencia significativa, usar el precio recalculado
                    const finalLineSubtotalBs = Math.abs(lineSubtotalBs - calculatedBsFromUsd) > 0.01 
                      ? calculatedBsFromUsd 
                      : lineSubtotalBs
                    const lineDiscountUsd = Number(item.discount_usd || 0)
                    const lineDiscountBs = Number(item.discount_bs || 0)
                    // Recalcular descuento en BS si es necesario
                    const calculatedDiscountBs = lineDiscountUsd * exchangeRate
                    const finalLineDiscountBs = Math.abs(lineDiscountBs - calculatedDiscountBs) > 0.01
                      ? calculatedDiscountBs
                      : lineDiscountBs
                    const lineTotalUsd = lineSubtotalUsd - lineDiscountUsd
                    const lineTotalBs = finalLineSubtotalBs - finalLineDiscountBs
                    
                    // #region agent log
                    // Log para debug: verificar cálculo de línea
                    // ⚡ FIX: Solo ejecutar en desarrollo local (no en producción)
                    if (import.meta.env.DEV && window.location.hostname === 'localhost' && items.indexOf(item) === 0) {
                      fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          location: 'POSPage.tsx:1830',
                          message: 'Line item calculation',
                          data: {
                            product_name: item.product_name,
                            unit_price_usd: item.unit_price_usd,
                            unit_price_bs: item.unit_price_bs,
                            qty: item.qty,
                            exchangeRate,
                            lineSubtotalUsd,
                            lineSubtotalBs,
                            calculatedBsFromUsd,
                            finalLineSubtotalBs,
                            lineDiscountUsd,
                            lineDiscountBs,
                            calculatedDiscountBs,
                            finalLineDiscountBs,
                            lineTotalUsd,
                            lineTotalBs,
                          },
                          timestamp: Date.now(),
                          sessionId: 'debug-session',
                          runId: 'line-calculation',
                          hypothesisId: 'B',
                        }),
                      }).catch(() => {});
                    }
                    // #endregion
                    const discountInputValue =
                      discountInputs[item.id] ??
                      (lineDiscountUsd > 0 ? lineDiscountUsd.toFixed(2) : '')
                    const isInvalid = invalidCartProductIds.includes(item.product_id)

                    return (
                    <SwipeableItem
                      key={item.id}
                      onSwipeLeft={isMobile ? () => removeItem(item.id) : undefined}
                      leftAction={isMobile ? (
                        <div className="flex items-center gap-2">
                          <Trash2 className="w-4 h-4" />
                          <span className="text-sm font-medium">Eliminar</span>
                        </div>
                      ) : undefined}
                      enabled={isMobile}
                      threshold={80}
                      className="mb-2 sm:mb-3"
                    >
                      <div
                        className={cn(
                          "bg-muted/50 rounded-lg p-2.5 sm:p-3 border hover:border-primary/50 transition-all shadow-sm",
                          isInvalid ? "border-destructive/60 bg-destructive/5" : "border-border"
                        )}
                      >
                        <div className="flex items-start justify-between mb-2 gap-2 min-w-0">
                          <div className="flex-1 min-w-0">
                            <p
                              className="font-medium text-xs sm:text-sm text-foreground break-words leading-snug flex items-center gap-1"
                              title={item.product_name}
                            >
                              {item.is_weight_product && (
                                <Scale className="w-3 h-3 text-primary flex-shrink-0" />
                              )}
                              {item.product_name}
                              {isInvalid && (
                                <Badge className="ml-1 bg-destructive/10 text-destructive border border-destructive/30">
                                  Inactivo
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.is_weight_product ? (
                                <>
                                  {item.qty} {item.weight_unit || 'kg'} × $
                                  {Number(item.price_per_weight_usd ?? item.unit_price_usd).toFixed(
                                    getWeightPriceDecimals(item.weight_unit)
                                  )}/
                                  {item.weight_unit || 'kg'}
                                </>
                              ) : (
                                <>${item.unit_price_usd.toFixed(2)} c/u</>
                              )}
                            </p>
                          </div>
                          {!isMobile && (
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
                          )}
                        </div>
                      <div className="flex items-center justify-between gap-2">
                        {/* Solo mostrar controles de cantidad para productos normales */}
                        {item.is_weight_product ? (
                          <Badge variant="outline" className="text-[10px] sm:text-xs">
                            Por {item.weight_unit || 'kg'}
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUpdateQty(item.id, item.qty - 1)
                              }}
                              className="h-8 w-8 min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px]"
                              aria-label="Disminuir cantidad"
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={MAX_QTY_PER_PRODUCT}
                              value={item.qty}
                              onChange={(e) => {
                                const newQty = parseInt(e.target.value) || 1
                                if (newQty >= 1 && newQty <= MAX_QTY_PER_PRODUCT) {
                                  handleUpdateQty(item.id, newQty)
                                }
                              }}
                              className="w-16 h-10 sm:h-8 text-center font-semibold text-sm sm:text-base tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              aria-label="Cantidad"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUpdateQty(item.id, item.qty + 1)
                              }}
                              className="h-8 w-8 min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px]"
                              aria-label="Aumentar cantidad"
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                        <div className="text-right tabular-nums">
                          <p className="font-semibold text-sm sm:text-base text-foreground">
                            ${lineTotalUsd.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Bs. {lineTotalBs.toFixed(2)}
                          </p>
                          {lineDiscountUsd > 0 && (
                            <p className="text-[11px] text-muted-foreground line-through">
                              ${lineSubtotalUsd.toFixed(2)} / Bs. {lineSubtotalBs.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                      {allowDiscounts && (
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">Descuento</span>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min={0}
                              value={discountInputValue}
                              onChange={(event) => handleDiscountChange(item, event.target.value)}
                              onBlur={() => handleDiscountBlur(item)}
                              placeholder="0.00"
                              className="h-7 w-20 text-xs text-right"
                            />
                            <span className="text-muted-foreground">USD</span>
                            <span className="text-muted-foreground">
                              Bs. {lineDiscountBs.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                      </div>
                    </SwipeableItem>
                  )
                  })}
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex-shrink-0 p-3 sm:p-4 border-t border-border space-y-3 sm:space-y-4 bg-muted/30">
                  {!hasOpenCash && (
                    <div className="rounded-md border border-amber-500/70 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Debes abrir caja para procesar ventas.
                    </div>
                  )}
                  {invalidCartProductIds.length > 0 && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      El carrito tiene productos inactivos o eliminados.
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
                    {/* Preview de descuento aplicado */}
                    {totalDiscountUsd > 0 ? (
                      <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Subtotal:</span>
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            ${(total.usd + totalDiscountUsd).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-border/50 pt-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-primary">Descuento:</span>
                            <span className="text-[10px] text-muted-foreground">
                              ({((totalDiscountUsd / (total.usd + totalDiscountUsd)) * 100).toFixed(1)}%)
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-primary tabular-nums">
                            -${totalDiscountUsd.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-border/50 pt-2">
                          <span className="text-sm font-medium text-foreground">Total USD:</span>
                          <span className="text-lg font-bold text-foreground tabular-nums">
                            ${total.usd.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-xs text-muted-foreground">Total Bs:</span>
                          <span className="text-sm text-muted-foreground tabular-nums">
                            Bs. {total.bs.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                  <Button
                    onClick={() => setShowCheckout(true)}
                    disabled={items.length === 0 || !hasOpenCash || invalidCartProductIds.length > 0}
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

      {/* Modal de checkout - Lazy loaded para reducir bundle inicial */}
      {showCheckout && (
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
      )}

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
    </div>
  )
}
