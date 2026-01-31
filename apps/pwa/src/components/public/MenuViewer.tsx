import { useState, useMemo, useEffect } from 'react'
import { Search, ShoppingCart, Sparkles, Filter, ChevronRight } from 'lucide-react'
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
import { Card } from '@/components/ui/card'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { motion, AnimatePresence } from 'framer-motion'
import toast from '@/lib/toast'

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
    refetchInterval: 3000,
    staleTime: 1000,
  })

  // Escuchar actualizaciones en tiempo real
  useEffect(() => {
    if (!qrCode) return

    const handleOrderUpdate = (...args: unknown[]) => {
      const data = args[0] as { order: any; timestamp: number }
      const { order } = data
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
      if (order?.table_id === tableId) {
        refetchOrder()
      }
    }

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

  // Categorías
  const categories = useMemo(() => {
    return menu.categories.map((cat) => cat.name)
  }, [menu])

  // Productos destacados
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

  // Filtrado
  const filteredCategories = useMemo(() => {
    return menu.categories
      .map((category) => ({
        ...category,
        products: category.products.filter((product) => {
          const matchesSearch =
            searchQuery === '' ||
            product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.description?.toLowerCase().includes(searchQuery.toLowerCase())
          const matchesCategory =
            selectedCategory === null || category.name === selectedCategory
          const matchesAvailability =
            filter === 'all' || (filter === 'available' && product.is_available)
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
    if (!showCart) toast.success('Producto agregado al carrito')
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
    <div className="min-h-screen bg-background selection:bg-primary/20">
      {/* Header Premium */}
      <header className="sticky top-0 z-50 bg-background/60 backdrop-blur-xl border-b border-border/40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="size-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-heading font-black tracking-tight leading-none">
                  Mesa {tableInfo.table_number}
                </h1>
                <p className="text-xs text-muted-foreground font-medium">
                  {tableInfo.name || 'Velox POS Menu'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
                <div className="size-2 rounded-full bg-emerald-500 animate-pulse mr-2" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Online</span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden relative"
                onClick={() => setShowCart(true)}
              >
                <ShoppingCart className="size-5" />
                {totalCartItems > 0 && (
                  <Badge className="absolute -top-1 -right-1 size-5 flex items-center justify-center p-0 text-[10px] font-bold">
                    {totalCartItems}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-24 sm:pb-32 pt-6">
        <div className="flex gap-8">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Search & Filters */}
            <div className="flex flex-col gap-4 mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="¿Qué te apetece hoy?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-14 pl-12 pr-4 text-base rounded-2xl border-none bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/20 transition-all font-medium"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <Button
                  variant={filter === 'all' ? 'default' : 'secondary'}
                  size="sm"
                  className="rounded-full font-bold px-6"
                  onClick={() => setFilter('all')}
                >
                  <Filter className="size-3.5 mr-2" />
                  Todos
                </Button>
                <Button
                  variant={filter === 'available' ? 'default' : 'secondary'}
                  size="sm"
                  className="rounded-full font-bold px-6"
                  onClick={() => setFilter('available')}
                >
                  Disponibles
                </Button>
              </div>
            </div>

            {/* Progress Card */}
            {orderProgress && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-8"
              >
                <Card className="overflow-hidden border-primary/20 bg-primary/5 shadow-xl shadow-primary/5 rounded-3xl">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-primary/20 flex items-center justify-center">
                          <ShoppingCart className="size-4 text-primary" />
                        </div>
                        <h3 className="font-heading font-bold">Tu Pedido Actual</h3>
                      </div>
                      <Badge className="rounded-full bg-primary/20 text-primary hover:bg-primary/20 border-none font-bold">
                        {currentOrderData?.order?.status === 'open' ? 'Preparando' : currentOrderData?.order?.status}
                      </Badge>
                    </div>
                    <OrderProgressBar progress={orderProgress} compact={true} />
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Hero Items */}
            {featuredProducts.length > 0 && !searchQuery && !selectedCategory && (
              <div className="mb-10">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-heading font-black tracking-tight">Recomendados</h2>
                  <Sparkles className="size-5 text-primary" />
                </div>
                <HeroBanner products={featuredProducts} onAddToCart={handleAddToCart} />
              </div>
            )}

            {/* Category Navigation (Sticky) */}
            <div className="sticky top-[72px] z-40 -mx-4 px-4 py-3 bg-background/80 backdrop-blur-md border-b border-border/40 mb-8 overflow-x-auto scrollbar-none">
              <CategoryTabs
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </div>

            {/* Products Grid */}
            <div className="space-y-12">
              <AnimatePresence mode="popLayout">
                {filteredCategories.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-20 text-center"
                  >
                    <div className="size-20 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Search className="size-10 text-muted-foreground/40" />
                    </div>
                    <h3 className="text-lg font-bold">No encontramos nada</h3>
                    <p className="text-muted-foreground">Prueba con otros términos de búsqueda</p>
                  </motion.div>
                ) : (
                  filteredCategories.map((category) => (
                    <section key={category.name} className="scroll-mt-40">
                      <div className="flex items-center gap-4 mb-6">
                        <h2 className="text-xl font-heading font-black tracking-tight">{category.name}</h2>
                        <div className="flex-1 h-px bg-border/40" />
                        <Badge variant="outline" className="rounded-full border-border/40 font-bold">
                          {category.products.length}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {category.products.map((product, idx) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            onAddToCart={() => handleAddToCart(product)}
                            index={idx}
                          />
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Sidebar Cart (Desktop) */}
          <aside className="hidden lg:block w-96 sticky top-24 h-[calc(100vh-120px)]">
            <Card className="h-full rounded-3xl shadow-xl border-border/40 overflow-hidden">
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
            </Card>
          </aside>
        </div>
      </main>

      {/* Floating Action Button (FAB) Mobile */}
      <AnimatePresence>
        {totalCartItems > 0 && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: 20 }}
            className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md"
          >
            <Button
              onClick={() => setShowCart(true)}
              className="w-full h-16 rounded-2xl shadow-2xl shadow-primary/40 bg-primary hover:bg-primary text-white flex items-center justify-between px-6 font-bold text-lg group"
            >
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <ShoppingCart className="size-5" />
                </div>
                <span>Ver mi pedido</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-white text-primary rounded-full size-7 flex items-center justify-center p-0 font-black">
                  {totalCartItems}
                </Badge>
                <ChevronRight className="size-5 transition-transform group-active:translate-x-1" />
              </div>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Cart Drawer */}
      <Drawer open={showCart} onOpenChange={setShowCart}>
        <DrawerContent className="max-h-[92vh]">
          <div className="flex-1 overflow-y-auto px-4 pb-8">
            <OrderCart
              items={cartItems}
              onRemove={handleRemoveFromCart}
              onUpdateQuantity={handleUpdateQuantity}
              onClose={() => setShowCart(false)}
              tableId={tableId}
              qrCode={qrCode}
              onOrderCreated={() => {
                setOrderCreated(true)
                setShowCart(false)
                refetchOrder()
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
