import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search } from 'lucide-react'
import { productsService, Product } from '@/services/products.service'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const itemSchema = z.object({
  qty: z.number().min(1, 'La cantidad debe ser mayor a 0'),
  discount_bs: z.number().min(0).optional(),
  discount_usd: z.number().min(0).optional(),
  note: z.string().max(500).nullable().optional(),
})

type ItemFormData = z.infer<typeof itemSchema>

interface OrderItemModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: AddOrderItemRequest) => void
  isLoading: boolean
}

export default function OrderItemModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: OrderItemModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [showVariantSelector, setShowVariantSelector] = useState(false)
  const { user } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      qty: 1,
      discount_bs: 0,
      discount_usd: 0,
      note: null,
    },
  })

  const { data: productsResponse, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products', 'search', searchQuery],
    queryFn: () =>
      productsService.search({ q: searchQuery || '' }, user?.store_id),
    enabled: isOpen && searchQuery.trim().length >= 2 && !!user?.store_id,
    staleTime: 1000 * 60 * 5,
  })

  const products = productsResponse?.products || []

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setSelectedProduct(null)
      setSelectedVariantId(null)
      setShowVariantSelector(false)
      reset({
        qty: 1,
        discount_bs: 0,
        discount_usd: 0,
        note: null,
      })
    }
  }, [isOpen, reset])

  const { data: hasVariants } = useQuery({
    queryKey: ['product-variants', 'check', selectedProduct?.id],
    queryFn: () =>
      selectedProduct
        ? productVariantsService.getVariantsByProduct(selectedProduct.id)
        : Promise.resolve([]),
    enabled: !!selectedProduct,
    staleTime: 1000 * 60 * 5,
  })

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product)
    // Verificar si tiene variantes consultando el servicio
    productVariantsService
      .getVariantsByProduct(product.id)
      .then((variants) => {
        if (variants && variants.length > 0) {
          setShowVariantSelector(true)
        }
      })
      .catch(() => {
        // Si no hay variantes o hay error, continuar sin variantes
      })
  }

  const handleVariantSelect = (variant: ProductVariant | null) => {
    setSelectedVariantId(variant?.id || null)
    setShowVariantSelector(false)
  }

  const onSubmit = (data: ItemFormData) => {
    if (!selectedProduct) return

    const requestData: AddOrderItemRequest = {
      product_id: selectedProduct.id,
      variant_id: selectedVariantId || null,
      qty: data.qty,
      discount_bs: data.discount_bs || 0,
      discount_usd: data.discount_usd || 0,
      note: data.note || null,
    }
    onConfirm(requestData)
  }

  if (!isOpen) return null

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl flex items-center">
              <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
              Agregar Item a Orden
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
              <div className="space-y-4">
                {/* Búsqueda de producto */}
                <div>
                  <Label htmlFor="product_search">Buscar Producto</Label>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="product_search"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Escribe para buscar productos..."
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Lista de productos */}
                {searchQuery.trim().length >= 2 && (
                  <div>
                    <Label>Productos</Label>
                    <ScrollArea className="h-64 mt-2 border border-border rounded-lg">
                      {isLoadingProducts ? (
                        <div className="p-4 space-y-2">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                          ))}
                        </div>
                      ) : products && products.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          No se encontraron productos
                        </div>
                      ) : (
                        <div className="p-2">
                          {products?.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => handleProductSelect(product)}
                              className={cn(
                                'w-full p-3 rounded-lg border transition-all text-left mb-2',
                                selectedProduct?.id === product.id
                                  ? 'border-primary bg-primary/10'
                                  : 'border-border hover:border-primary/50'
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-foreground truncate">
                                    {product.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    ${Number(product.price_usd).toFixed(2)} / Bs.{' '}
                                    {Number(product.price_bs).toFixed(2)}
                                  </p>
                                </div>
                                {selectedProduct?.id === product.id && (
                                  <div className="ml-2 text-primary">✓</div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                )}

                {/* Producto seleccionado */}
                {selectedProduct && (
                  <div className="p-4 border border-primary/50 rounded-lg bg-primary/5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-foreground">{selectedProduct.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ${Number(selectedProduct.price_usd).toFixed(2)} / Bs.{' '}
                          {Number(selectedProduct.price_bs).toFixed(2)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedProduct(null)
                          setSelectedVariantId(null)
                        }}
                      >
                        Cambiar
                      </Button>
                    </div>

                    {hasVariants && hasVariants.length > 0 && !selectedVariantId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowVariantSelector(true)}
                        className="w-full"
                      >
                        Seleccionar Variante
                      </Button>
                    )}

                    {selectedVariantId && (
                      <div className="mt-2 p-2 bg-background rounded border border-border">
                        <p className="text-xs text-muted-foreground">Variante seleccionada</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Cantidad y descuentos */}
                {selectedProduct && (
                  <>
                    <div>
                      <Label htmlFor="qty">
                        Cantidad <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="qty"
                        type="number"
                        step="1"
                        min="1"
                        {...register('qty', { valueAsNumber: true })}
                        className="mt-2"
                        placeholder="1"
                        disabled={isLoading}
                      />
                      {errors.qty && (
                        <p className="mt-1 text-sm text-destructive">{errors.qty.message}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="discount_bs">Descuento Bs (Opcional)</Label>
                        <Input
                          id="discount_bs"
                          type="number"
                          step="0.01"
                          min="0"
                          {...register('discount_bs', { valueAsNumber: true })}
                          className="mt-2"
                          placeholder="0.00"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <Label htmlFor="discount_usd">Descuento USD (Opcional)</Label>
                        <Input
                          id="discount_usd"
                          type="number"
                          step="0.01"
                          min="0"
                          {...register('discount_usd', { valueAsNumber: true })}
                          className="mt-2"
                          placeholder="0.00"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="note">Nota Especial (Opcional)</Label>
                      <Textarea
                        id="note"
                        {...register('note')}
                        rows={2}
                        className="mt-2 resize-none"
                        placeholder="Ej: sin cebolla, bien cocido..."
                        maxLength={500}
                        disabled={isLoading}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
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
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={isLoading || !selectedProduct}
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                      Agregando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 mr-2" />
                      Agregar Item
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Selector de variantes */}
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

