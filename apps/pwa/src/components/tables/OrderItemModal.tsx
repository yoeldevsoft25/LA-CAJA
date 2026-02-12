import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus,
  Search,
  Check,
  Filter,
  ShoppingBag,
  ChevronLeft,
  X,
  Minus,
  Trash2,
  ArrowRight
} from 'lucide-react'
import { productsService, Product } from '@la-caja/app-core'
import { productVariantsService, ProductVariant } from '@/services/product-variants.service'
import { AddOrderItemRequest } from '@/services/orders.service'
import { useAuth } from '@/stores/auth.store'
import VariantSelector from '@/components/variants/VariantSelector'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import toast from '@/lib/toast'

const itemSchema = z.object({
  qty: z.number().min(1, 'La cantidad debe ser mayor a 0'),
  discount_bs: z.number().min(0).optional(),
  discount_usd: z.number().min(0).optional(),
  note: z.string().max(500).nullable().optional(),
})

type ItemFormData = z.infer<typeof itemSchema>

interface CartItem extends AddOrderItemRequest {
  id: string; // Temp ID for local tracking
  product_name: string;
  variant_name?: string | null;
  unit_price_usd: number;
}

interface OrderItemModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (items: AddOrderItemRequest[]) => void
  isLoading: boolean
}

export default function OrderItemModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: OrderItemModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [showVariantSelector, setShowVariantSelector] = useState(false)
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const { user } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { },
    reset,
    watch,
    setValue,
  } = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      qty: 1,
      discount_bs: 0,
      discount_usd: 0,
      note: null,
    },
  })

  // Obtener todos los productos activos para el grid y categorías
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products', 'grid', user?.store_id],
    queryFn: () =>
      productsService.search({ is_active: true, limit: 1000 }, user?.store_id),
    enabled: isOpen && !!user?.store_id,
    staleTime: 1000 * 60 * 5,
  })

  const allProducts = productsData?.products || []

  const categories = useMemo(() => {
    const cats = new Set<string>()
    allProducts.forEach(p => {
      if (p.category) cats.add(p.category)
    })
    return Array.from(cats).sort()
  }, [allProducts])

  const filteredProducts = useMemo(() => {
    return allProducts.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.includes(searchQuery)
      const matchesCategory = !selectedCategory || p.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [allProducts, searchQuery, selectedCategory])

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setSelectedCategory(null)
      setSelectedProduct(null)
      setSelectedVariant(null)
      setShowVariantSelector(false)
      setIsConfiguring(false)
      setCart([])
      setShowCart(false)
      reset({
        qty: 1,
        discount_bs: 0,
        discount_usd: 0,
        note: null,
      })
    }
  }, [isOpen, reset])

  const { data: variants } = useQuery({
    queryKey: ['product-variants', 'check', selectedProduct?.id],
    queryFn: () =>
      selectedProduct
        ? productVariantsService.getVariantsByProduct(selectedProduct.id)
        : Promise.resolve([]),
    enabled: !!selectedProduct && isConfiguring,
    staleTime: 1000 * 60 * 5,
  })

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product)
    setIsConfiguring(true)
    setSelectedVariant(null)

    // Verificar si tiene variantes
    productVariantsService
      .getVariantsByProduct(product.id)
      .then((variants) => {
        if (variants && variants.length > 0) {
          setShowVariantSelector(true)
        }
      })
      .catch(() => { })
  }

  const handleVariantSelect = (variant: ProductVariant | null) => {
    setSelectedVariant(variant)
    setShowVariantSelector(false)
  }

  const onAddToCart = (data: ItemFormData) => {
    if (!selectedProduct) return

    const newCartItem: CartItem = {
      id: Math.random().toString(36).substr(2, 9),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      variant_id: selectedVariant?.id || null,
      variant_name: selectedVariant ? `${selectedVariant.variant_type}: ${selectedVariant.variant_value}` : null,
      unit_price_usd: Number(selectedProduct.price_usd),
      qty: data.qty,
      discount_bs: data.discount_bs || 0,
      discount_usd: data.discount_usd || 0,
      note: data.note || null,
    }

    setCart(prev => [...prev, newCartItem])
    setIsConfiguring(false)
    setSelectedProduct(null)
    setSelectedVariant(null)
    reset({
      qty: 1,
      discount_bs: 0,
      discount_usd: 0,
      note: null,
    })
    toast.success('Agregado al carrito')
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const handleBatchConfirm = () => {
    if (cart.length === 0) return

    const itemsToSubmit = cart.map(({ id, product_name, variant_name, unit_price_usd, ...rest }) => rest)
    onConfirm(itemsToSubmit)
  }

  const cartTotalUsd = useMemo(() => {
    return cart.reduce((acc, item) => {
      return acc + (item.qty * item.unit_price_usd - (item.discount_usd || 0))
    }, 0)
  }, [cart])

  const currentQty = watch('qty')

  if (!isOpen) return null

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl h-[95vh] sm:h-[85vh] flex flex-col p-0 gap-0 overflow-hidden border-none bg-card shadow-2xl">
          <DialogHeader className="px-4 py-4 border-b border-border/40 flex-shrink-0 pr-12 bg-card">
            <div className="flex items-center gap-3">
              {isConfiguring || showCart ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsConfiguring(false)
                    setShowCart(false)
                  }}
                  className="h-8 w-8 rounded-full hover:bg-background"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              ) : null}
              <DialogTitle className="text-xl font-black text-foreground tracking-tight flex items-center">
                <ShoppingBag className="w-6 h-6 text-primary mr-3" />
                {isConfiguring ? 'Configurar Item' : showCart ? 'Revisar Pedido' : 'Explorar Menú'}
              </DialogTitle>
            </div>
          </DialogHeader>

          {!isConfiguring && !showCart ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Barra de búsqueda y categorías */}
              <div className="p-4 space-y-4 bg-card">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
                  <Input
                    placeholder="Busca por nombre, SKU o código..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-12 pl-12 bg-background border-border/60 rounded-2xl shadow-sm focus:ring-primary/20 transition-all text-lg"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="relative">
                  <ScrollArea className="w-full whitespace-nowrap -mx-4 px-4">
                    <div className="flex space-x-2 pb-2">
                      <Button
                        variant={selectedCategory === null ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedCategory(null)}
                        className={cn(
                          "rounded-full px-5 h-10 font-bold transition-all transition-transform active:scale-95",
                          selectedCategory === null ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "hover:bg-primary/5 border-border/30"
                        )}
                      >
                        Todos
                      </Button>
                      {categories.map((cat) => (
                        <Button
                          key={cat}
                          variant={selectedCategory === cat ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedCategory(cat)}
                          className={cn(
                            "rounded-full px-5 h-10 font-bold transition-all transition-transform active:scale-95",
                            selectedCategory === cat ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "hover:bg-primary/5 border-border/30"
                          )}
                        >
                          {cat}
                        </Button>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" className="hidden" />
                  </ScrollArea>
                </div>
              </div>

              {/* Grid de productos */}
              <ScrollArea className="flex-1 px-4 py-6">
                {isLoadingProducts ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <Skeleton key={i} className="h-40 rounded-3xl" />
                    ))}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                    <div className="bg-card w-20 h-20 rounded-full flex items-center justify-center mb-4">
                      <Filter className="w-10 h-10 opacity-20" />
                    </div>
                    <p className="font-bold text-lg">No se encontraron productos</p>
                    <p className="text-sm">Prueba con otro término o categoría</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-24 pb-10">
                    {filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => handleProductSelect(product)}
                        className="group flex flex-col h-full bg-card hover:bg-card border border-transparent hover:border-primary/20 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden text-left active:scale-[0.98]"
                      >
                        {/* Imagen o placeholder */}
                        <div className="h-28 bg-card relative overflow-hidden flex items-center justify-center">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <ShoppingBag className="w-10 h-10 text-muted-foreground/30" />
                          )}
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-black/60 backdrop-blur-md border-white/20 text-white font-black text-[10px] px-2 py-0.5">
                              ${Number(product.price_usd).toFixed(2)}
                            </Badge>
                          </div>
                        </div>

                        {/* Contenido */}
                        <div className="p-3 flex flex-col flex-1">
                          <h4 className="font-black text-foreground text-sm leading-tight line-clamp-2 mb-1">
                            {product.name}
                          </h4>
                          <div className="mt-auto flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate">
                              {product.category || 'Sin Cat.'}
                            </span>
                            <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                              <Plus className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Botón flotante del carrito */}
              {cart.length > 0 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-4">
                  <Button
                    onClick={() => setShowCart(true)}
                    className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black shadow-2xl flex items-center justify-between px-6 group hover:bg-primary/90 transition-all active:scale-[0.98] border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs">
                        {cart.length}
                      </div>
                      <span>Ver Selección</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">${cartTotalUsd.toFixed(2)}</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Button>
                </div>
              )}
            </div>
          ) : showCart ? (
            /* Vista del Carrito Local */
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-4 pb-24">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-4 rounded-3xl bg-card border border-border/40 isolate relative group">
                      <div className="h-12 w-12 rounded-2xl bg-card flex items-center justify-center text-xl font-black text-primary border border-border/40 shadow-sm">
                        {item.qty}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-foreground leading-tight truncate">{item.product_name}</h4>
                        {item.variant_name && (
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">{item.variant_name}</p>
                        )}
                        <p className="text-xs font-bold text-muted-foreground mt-1">
                          ${(item.qty * item.unit_price_usd).toFixed(2)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCart(item.id)}
                        className="h-10 w-10 text-destructive hover:bg-destructive/10 rounded-xl"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="p-6 bg-card border-t border-border/40">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm font-black text-muted-foreground uppercase tracking-widest">Total Estimado</span>
                  <span className="text-3xl font-black text-foreground">${cartTotalUsd.toFixed(2)}</span>
                </div>
                <Button
                  onClick={handleBatchConfirm}
                  disabled={isLoading || cart.length === 0}
                  className="w-full h-16 rounded-[2rem] bg-primary text-primary-foreground font-black text-xl shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-6 h-6" />
                      Confirmar {cart.length} {cart.length === 1 ? 'Item' : 'Items'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Configuración del item seleccionado */
            <form onSubmit={handleSubmit(onAddToCart)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-8">
                  {/* Hero del producto */}
                  <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center p-6 rounded-[2.5rem] bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-32 w-32 bg-primary/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10" />

                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-white shadow-xl flex items-center justify-center overflow-hidden shrink-0 ring-4 ring-white">
                      {selectedProduct?.image_url ? (
                        <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-12 h-12 text-primary/30" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="bg-card border-primary/30 text-primary font-black text-[10px] uppercase tracking-widest px-2.5">
                          {selectedProduct?.category || 'Sin Categoría'}
                        </Badge>
                        {selectedProduct?.sku && (
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                            SKU: {selectedProduct.sku}
                          </span>
                        )}
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight leading-none mb-3">
                        {selectedProduct?.name}
                      </h3>
                      <div className="flex items-center gap-4">
                        <p className="text-2xl font-black text-primary flex items-center gap-1">
                          <span className="text-sm opacity-60">$</span>
                          {Number(selectedProduct?.price_usd).toFixed(2)}
                        </p>
                        <div className="h-6 w-px bg-primary/20" />
                        <p className="text-lg font-bold text-muted-foreground tabular-nums flex items-center gap-1">
                          {Number(selectedProduct?.price_bs).toFixed(2)}
                          <span className="text-[10px] opacity-60">Bs</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Configuración de Cantidad */}
                  <div className="space-y-4">
                    <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">
                      Cantidad del Pedido
                    </Label>
                    <div className="flex items-center gap-6 p-4 rounded-3xl bg-card border border-border/60">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setValue('qty', Math.max(1, currentQty - 1))}
                        className="h-14 w-14 rounded-2xl bg-card shadow-sm hover:bg-card active:scale-95 transition-all text-primary border border-border/30"
                      >
                        <Minus className="w-6 h-6" />
                      </Button>
                      <div className="flex-1 text-center">
                        <Input
                          {...register('qty', { valueAsNumber: true })}
                          className="border-none bg-transparent h-auto text-4xl sm:text-5xl font-black text-center focus-visible:ring-0 p-0 tabular-nums"
                          type="number"
                          readOnly
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setValue('qty', currentQty + 1)}
                        className="h-14 w-14 rounded-2xl bg-card shadow-sm hover:bg-card active:scale-95 transition-all text-primary border border-border/30"
                      >
                        <Plus className="w-6 h-6" />
                      </Button>
                    </div>
                  </div>

                  {/* Variantes */}
                  {variants && variants.length > 0 && (
                    <div className="space-y-4">
                      <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">
                        Variante / Opción
                      </Label>
                      <ScrollArea className="w-full whitespace-nowrap overflow-hidden">
                        <div className="flex space-x-3 pb-2">
                          {variants.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => setSelectedVariant(v)}
                              className={cn(
                                "relative px-6 py-3 rounded-2xl border-2 transition-all group overflow-hidden shrink-0",
                                selectedVariant?.id === v.id
                                  ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                                  : "border-border/30 bg-background hover:border-primary/50"
                              )}
                            >
                              {selectedVariant?.id === v.id && (
                                <div className="absolute top-0 right-0 p-1">
                                  <div className="bg-primary rounded-full p-0.5">
                                    <Check className="w-2.5 h-2.5 text-white" />
                                  </div>
                                </div>
                              )}
                              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 group-hover:text-primary transition-colors">
                                {v.variant_type}
                              </p>
                              <p className="font-bold text-foreground">
                                {v.variant_value}
                              </p>
                            </button>
                          ))}
                        </div>
                        <ScrollBar orientation="horizontal" className="hidden" />
                      </ScrollArea>
                    </div>
                  )}

                  {/* Nota */}
                  <div className="space-y-4">
                    <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">
                      Instrucciones Especiales
                    </Label>
                    <Textarea
                      {...register('note')}
                      placeholder="Ej: Sin cebolla, extra salsa, términos de cocción..."
                      className="h-24 sm:h-32 rounded-[2rem] border-border/60 bg-card focus:bg-card transition-all text-lg resize-none p-6 shadow-inner"
                    />
                  </div>
                </div>
              </ScrollArea>

              {/* Botón de Añadir Local */}
              <div className="p-4 sm:p-6 bg-card border-t border-border/40 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex flex-col justify-center px-4 hidden sm:flex">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Subtotal Item</p>
                  <p className="text-2xl font-black text-foreground">
                    ${(Number(selectedProduct?.price_usd || 0) * currentQty).toFixed(2)}
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full sm:w-auto h-16 sm:px-12 rounded-[2rem] bg-primary text-primary-foreground font-black text-xl shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <Plus className="w-6 h-6" />
                  Agregar al Pedido
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Selector de variantes fallback */}
      {selectedProduct && showVariantSelector && (
        <VariantSelector
          isOpen={showVariantSelector}
          onClose={() => setShowVariantSelector(false)}
          productId={selectedProduct.id}
          productName={selectedProduct.name}
          onSelect={handleVariantSelect}
        />
      )}
    </>
  )
}
