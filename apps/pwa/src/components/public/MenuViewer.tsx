import { useState, useMemo, useEffect } from 'react'
import { Search, ShoppingCart, Sparkles } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { type PublicTableInfo, type PublicMenuResponse, type PublicProduct, publicMenuService } from '@/services/public-menu.service'
import { notificationsWebSocketService } from '@/services/notifications-websocket.service'
import ProductCard from './ProductCard'
import OrderCart from './OrderCart'
import HeroBanner from './HeroBanner'
import CategoryTabs from './CategoryTabs'
import OrderProgressBar, { type OrderProgressData } from './OrderProgressBar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface MenuViewerProps {
  tableId: string
  tableInfo: PublicTableInfo
  menu: PublicMenuResponse
  qrCode: string
}

type FilterType = 'all' | 'available'

export default function MenuViewer({
  tableId,
  tableInfo,
  menu,
  qrCode,
}: MenuViewerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [showCart, setShowCart] = useState(false)
  const [cartItems, setCartItems] = useState<Array<{
    product: PublicProduct
    quantity: number
  }>>([])
  const [orderCreated, setOrderCreated] = useState(false)

  // Obtener estado actual de la orden
  const { data: currentOrderData, refetch: refetchOrder } = useQuery({
    queryKey: ['current-order', qrCode],
    queryFn: () => publicMenuService.getCurrentOrder(qrCode),
    enabled: !!qrCode && (orderCreated || cartItems.length === 0),
    refetchInterval: 3000, // Actualizar cada 3 segundos
    staleTime: 1000,
  })

  // Escuchar actualizaciones en tiempo real de la orden
  useEffect(() => {
    if (!qrCode) return

    const handleOrderUpdate = (...args: unknown[]) => {
      const data = args[0] as { order: any; timestamp: number }
      const { order } = data

      // Si la orden pertenece a esta mesa, refrescar
      if (order?.table_id === tableId) {
        refetchOrder()
        if (order.status === 'closed') {
          toast.success('¡Tu pedido ha sido completado!')
        }
      }
    }

    const handleKitchenUpdate = (...args: unknown[]) => {
      const data = args[0] as { order: any; timestamp: number }
      const { order } = data

      // Si la orden pertenece a esta mesa, refrescar
      if (order?.table_id === tableId) {
        refetchOrder()
      }
    }

    // Conectar WebSocket si no está conectado (necesitamos store_id, pero en público no lo tenemos)
    // Por ahora solo escuchamos si ya está conectado
    if (notificationsWebSocketService.isConnected()) {
      notificationsWebSocketService.on('order:update', handleOrderUpdate)
      notificationsWebSocketService.on('kitchen:order_update', handleKitchenUpdate)
    }

    return () => {
      notificationsWebSocketService.off('order:update', handleOrderUpdate)
      notificationsWebSocketService.off('kitchen:order_update', handleKitchenUpdate)
    }
  }, [qrCode, tableId, refetchOrder])

  // Preparar datos de progreso
  const orderProgress: OrderProgressData | null = useMemo(() => {
    if (!currentOrderData?.has_order || !currentOrderData?.progress) {
      return null
    }
    const progress = currentOrderData.progress
    return {
      totalItems: progress.totalItems,
      pendingItems: progress.pendingItems,
      preparingItems: progress.preparingItems,
      readyItems: progress.readyItems,
      orderStatus: progress.orderStatus as 'open' | 'paused' | 'closed' | 'cancelled',
    }
  }, [currentOrderData])

  // Extraer todas las categorías
  const categories = useMemo(() => {
    return menu.categories.map((cat) => cat.name)
  }, [menu])

  // Obtener productos destacados para el banner (primeros productos de las categorías principales)
  const featuredProducts = useMemo(() => {
    const products: PublicProduct[] = []
    menu.categories.forEach((category) => {
      const availableProducts = category.products.filter((p) => p.is_available)
      if (availableProducts.length > 0) {
        products.push(availableProducts[0])
      }
    })
    return products.slice(0, 4)
  }, [menu])

  // Filtrar productos según búsqueda, categoría y filtros
  const filteredCategories = useMemo(() => {
    return menu.categories
      .map((category) => ({
        ...category,
        products: category.products.filter((product) => {
          // Filtro de búsqueda
          const matchesSearch =
            searchQuery === '' ||
            product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.description?.toLowerCase().includes(searchQuery.toLowerCase())

          // Filtro de categoría
          const matchesCategory =
            selectedCategory === null || category.name === selectedCategory

          // Filtro de disponibilidad
          const matchesAvailability =
            filter === 'all' ||
            (filter === 'available' && product.is_available)

          return matchesSearch && matchesCategory && matchesAvailability
        }),
      }))
      .filter((category) => category.products.length > 0)
  }, [menu, searchQuery, selectedCategory, filter])

  const totalCartItems = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0)
  }, [cartItems])

  const handleAddToCart = (product: PublicProduct) => {
    if (!product.is_available) return

    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
    setShowCart(true)
  }

  const handleRemoveFromCart = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId))
  }

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveFromCart(productId)
      return
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background">
      {/* Header optimizado para móvil */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 border-b border-border/50 shadow-lg">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="bg-primary/10 rounded-full p-1.5 sm:p-2 shrink-0">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground truncate">
                  Mesa {tableInfo.table_number}
                </h1>
                {tableInfo.name && (
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    {tableInfo.name}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="default"
              className="relative bg-background hover:bg-primary/10 active:bg-primary/20 border-2 transition-all shrink-0 touch-manipulation min-h-[44px] min-w-[44px] sm:min-w-auto"
              onClick={() => setShowCart(!showCart)}
            >
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
              <span className="hidden sm:inline">Mi Pedido</span>
              {totalCartItems > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center p-0 text-xs font-bold shadow-lg"
                >
                  {totalCartItems}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Barra de progreso de la orden (si existe) */}
      {orderProgress && currentOrderData?.has_order && (
        <div className="bg-background/95 backdrop-blur-sm border-b border-border/50 shadow-sm">
          <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 max-w-7xl">
            <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20 shadow-lg">
              <div className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-foreground">
                      Estado de tu Pedido
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Orden {currentOrderData.order?.order_number}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 border-primary/30">
                    {currentOrderData.order?.status === 'open' ? 'En Preparación' : currentOrderData.order?.status}
                  </Badge>
                </div>
                <OrderProgressBar progress={orderProgress} compact={false} />
              </div>
            </Card>
          </div>
        </div>
      )}

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-7xl w-full overflow-x-hidden">
        <div className="flex gap-4 sm:gap-6 w-full">
          {/* Contenido principal */}
          <div className={cn('flex-1 transition-all duration-300 min-w-0', showCart && 'lg:mr-80')}>
            {/* Barra de búsqueda optimizada para móvil */}
            <div className="mb-4 sm:mb-6">
              <div className="relative max-w-xl mx-auto">
                <div className="absolute inset-0 bg-primary/5 rounded-lg sm:rounded-xl blur-sm" />
                <div className="relative">
                  <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground z-10" />
                  <Input
                    placeholder="Buscar productos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 sm:pl-12 pr-4 py-3 sm:py-4 text-sm sm:text-base border-2 border-border/50 focus:border-primary shadow-lg bg-background/80 backdrop-blur-sm transition-all duration-300 active:shadow-xl touch-manipulation"
                  />
                </div>
              </div>
            </div>

            {/* Banner Hero con productos destacados */}
            {featuredProducts.length > 0 && searchQuery === '' && selectedCategory === null && (
              <HeroBanner
                products={featuredProducts}
                onAddToCart={handleAddToCart}
              />
            )}

            {/* Categorías horizontales scrollables */}
            <div className="mb-4 sm:mb-6 -mx-3 sm:mx-0">
              <CategoryTabs
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </div>

            {/* Filtro de disponibilidad optimizado para móvil */}
            {filteredCategories.length > 0 && (
              <div className="mb-4 sm:mb-6 flex justify-center">
                <div className="inline-flex gap-1.5 sm:gap-2 bg-muted/50 rounded-full p-1">
                  <Button
                    variant={filter === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('all')}
                    className="rounded-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 touch-manipulation min-h-[36px]"
                  >
                    Todos
                  </Button>
                  <Button
                    variant={filter === 'available' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('available')}
                    className="rounded-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 touch-manipulation min-h-[36px]"
                  >
                    Disponibles
                  </Button>
                </div>
              </div>
            )}

            {/* Grid de productos optimizado para móvil */}
            <ScrollArea className="h-[calc(100vh-320px)] sm:h-[calc(100vh-400px)] md:h-[calc(100vh-450px)] w-full">
              {filteredCategories.length === 0 ? (
                <div className="text-center py-12 sm:py-16">
                  <div className="bg-muted/50 rounded-full p-4 sm:p-6 w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 flex items-center justify-center">
                    <Search className="w-8 h-8 sm:w-12 sm:h-12 text-muted-foreground" />
                  </div>
                  <p className="text-base sm:text-lg font-semibold text-foreground mb-2">
                    No se encontraron productos
                  </p>
                  <p className="text-sm sm:text-base text-muted-foreground px-4">
                    Intenta con otros filtros o términos de búsqueda
                  </p>
                </div>
              ) : (
                <div className="space-y-10 sm:space-y-12 md:space-y-16 pb-6 sm:pb-8 w-full">
                  {filteredCategories.map((category, categoryIndex) => (
                    <div
                      key={category.name}
                      id={`category-${category.name}`}
                      className="w-full animate-in fade-in slide-in-from-bottom-8"
                      style={{
                        animationDelay: `${categoryIndex * 100}ms`,
                        animationFillMode: 'both',
                      }}
                    >
                      {/* Header de categoría optimizado para móvil */}
                      <div className="relative mb-5 sm:mb-8">
                        <div className="flex items-center gap-3 sm:gap-4 w-full">
                          <div className="h-1 sm:h-1.5 w-10 sm:w-16 bg-gradient-to-r from-primary to-primary/50 rounded-full shrink-0 shadow-lg shadow-primary/30" />
                          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground truncate bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                            {category.name}
                          </h2>
                          <div className="flex-1 h-1 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent rounded-full min-w-0" />
                          <Badge
                            variant="secondary"
                            className="text-xs sm:text-sm shrink-0 px-2 sm:px-3 py-0.5 sm:py-1 bg-primary/10 border border-primary/20 text-primary font-bold backdrop-blur-sm"
                          >
                            {category.products.length}
                          </Badge>
                        </div>
                      </div>
                      {/* Grid responsive: 1 col en móvil pequeño, 2 en móvil, 3 en tablet, 4 en desktop */}
                      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6 w-full">
                        {category.products.map((product, productIndex) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            onAddToCart={() => handleAddToCart(product)}
                            index={productIndex}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Carrito lateral (desktop) */}
          {showCart && (
            <div className="hidden lg:block fixed right-0 top-0 h-screen w-80 bg-background border-l shadow-2xl z-40">
              <OrderCart
                items={cartItems}
                onRemove={handleRemoveFromCart}
                onUpdateQuantity={handleUpdateQuantity}
                onClose={() => setShowCart(false)}
                tableId={tableId}
                qrCode={qrCode}
                onOrderCreated={() => {
                  setOrderCreated(true)
                  setTimeout(() => refetchOrder(), 1000)
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Carrito móvil (bottom sheet) - Altura limitada para mostrar solo 1 producto */}
      {showCart && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 bg-background border-t shadow-2xl z-50 rounded-t-2xl flex flex-col" style={{ height: '280px', maxHeight: '50vh' }}>
          <OrderCart
            items={cartItems}
            onRemove={handleRemoveFromCart}
            onUpdateQuantity={handleUpdateQuantity}
            onClose={() => setShowCart(false)}
            tableId={tableId}
            qrCode={qrCode}
          />
        </div>
      )}
    </div>
  )
}
