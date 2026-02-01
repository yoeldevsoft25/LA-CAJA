import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { Zap, Search, Check } from 'lucide-react'
import { QuickProduct, CreateQuickProductRequest } from '@/services/fast-checkout.service'
import { productsService } from '@/services/products.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

const quickProductSchema = z.object({
  product_id: z.string().uuid('Selecciona un producto'),
  quick_key: z.string().min(1, 'La tecla rápida es requerida').max(10, 'La tecla no puede exceder 10 caracteres'),
  position: z.number().min(0).optional(),
  is_active: z.boolean().optional(),
})

type QuickProductFormData = z.infer<typeof quickProductSchema>

interface QuickProductModalProps {
  isOpen: boolean
  onClose: () => void
  quickProduct: QuickProduct | null
  existingKeys: string[]
  onConfirm: (data: CreateQuickProductRequest) => void
  isLoading: boolean
}

export default function QuickProductModal({
  isOpen,
  onClose,
  quickProduct,
  existingKeys,
  onConfirm,
  isLoading,
}: QuickProductModalProps) {
  const [productSearch, setProductSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<QuickProductFormData>({
    resolver: zodResolver(quickProductSchema),
    defaultValues: {
      product_id: '',
      quick_key: '',
      position: 0,
      is_active: true,
    },
  })

  const quickKey = watch('quick_key')

  // Buscar productos
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products', 'search', productSearch],
    queryFn: () => productsService.search({ q: productSearch, limit: 20 }),
    enabled: isOpen && productSearch.trim().length >= 2,
    staleTime: 1000 * 30,
  })

  useEffect(() => {
    if (quickProduct) {
      reset({
        product_id: quickProduct.product_id,
        quick_key: quickProduct.quick_key,
        position: quickProduct.position,
        is_active: quickProduct.is_active,
      })
      setSelectedProductId(quickProduct.product_id)
    } else {
      reset({
        product_id: '',
        quick_key: '',
        position: 0,
        is_active: true,
      })
      setSelectedProductId(null)
      setProductSearch('')
    }
  }, [quickProduct, reset])

  const onSubmit = (data: QuickProductFormData) => {
    // Validar que la tecla no esté en uso (excepto si es el mismo producto)
    if (existingKeys.includes(data.quick_key) && quickProduct?.quick_key !== data.quick_key) {
      return
    }

    const requestData: CreateQuickProductRequest = {
      product_id: data.product_id,
      quick_key: data.quick_key,
      position: data.position ?? 0,
      is_active: data.is_active ?? true,
    }
    onConfirm(requestData)
  }

  const handleSelectProduct = (product: { id: string; name: string }) => {
    setSelectedProductId(product.id)
    setValue('product_id', product.id)
    setProductSearch(product.name)
  }

  const selectedProduct = productsData?.products.find((p) => p.id === selectedProductId)
  const isKeyInUse = quickKey && existingKeys.includes(quickKey) && quickProduct?.quick_key !== quickKey

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            {quickProduct ? 'Editar Producto Rápido' : 'Agregar Producto Rápido'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configura un producto con tecla rápida para modo caja rápida
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
            <div className="space-y-4">
              <Alert className="bg-info/5 border-info/50">
                <AlertDescription className="text-sm text-foreground">
                  Asigna un producto y una tecla rápida para acceso rápido en modo caja rápida.
                  Puedes usar números, letras o teclas de función (ej: '1', 'F1', 'A').
                </AlertDescription>
              </Alert>

              {/* Búsqueda de producto */}
              <div>
                <Label htmlFor="product_search">Buscar Producto</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="product_search"
                    type="text"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value)
                      if (!e.target.value.trim()) {
                        setSelectedProductId(null)
                        setValue('product_id', '')
                      }
                    }}
                    className="pl-10"
                    placeholder="Escribe para buscar productos..."
                    disabled={isLoading}
                  />
                </div>
                {selectedProduct && (
                  <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{selectedProduct.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ${Number(selectedProduct.price_usd).toFixed(2)} /{' '}
                          {Number(selectedProduct.price_bs).toFixed(2)} Bs
                        </p>
                      </div>
                      <Check className="w-5 h-5 text-success" />
                    </div>
                  </div>
                )}
                {productSearch.trim().length >= 2 && !selectedProduct && (
                  <Card className="mt-2 border border-border">
                    <CardContent className="p-0">
                      <ScrollArea className="h-48">
                        {isLoadingProducts ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            Buscando...
                          </div>
                        ) : productsData?.products.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            No se encontraron productos
                          </div>
                        ) : (
                          <div>
                            {productsData?.products.map((product, index) => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => handleSelectProduct(product)}
                                className={cn(
                                  'w-full text-left px-4 py-3 hover:bg-accent transition-colors',
                                  index > 0 && 'border-t border-border',
                                  selectedProductId === product.id && 'bg-accent'
                                )}
                              >
                                <p className="font-medium text-foreground">{product.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  ${Number(product.price_usd).toFixed(2)} /{' '}
                                  {Number(product.price_bs).toFixed(2)} Bs
                                </p>
                              </button>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
                {errors.product_id && (
                  <p className="mt-1 text-sm text-destructive">{errors.product_id.message}</p>
                )}
              </div>

              {/* Tecla rápida */}
              <div>
                <Label htmlFor="quick_key">
                  Tecla Rápida <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quick_key"
                  type="text"
                  {...register('quick_key')}
                  className="mt-2 font-mono"
                  placeholder="Ej: 1, F1, A"
                  maxLength={10}
                  disabled={isLoading}
                />
                {errors.quick_key && (
                  <p className="mt-1 text-sm text-destructive">{errors.quick_key.message}</p>
                )}
                {isKeyInUse && (
                  <p className="mt-1 text-sm text-destructive">
                    Esta tecla ya está en uso por otro producto
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Máximo 10 caracteres. Ejemplos: '1', 'F1', 'A', 'CTRL+1'
                </p>
              </div>

              {/* Posición */}
              <div>
                <Label htmlFor="position">Posición en Grilla</Label>
                <Input
                  id="position"
                  type="number"
                  step="1"
                  min="0"
                  {...register('position', { valueAsNumber: true })}
                  className="mt-2"
                  placeholder="0"
                  disabled={isLoading}
                />
                {errors.position && (
                  <p className="mt-1 text-sm text-destructive">{errors.position.message}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Orden de aparición en la grilla de productos rápidos (0 = primero)
                </p>
              </div>
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
                disabled={isLoading || isKeyInUse || !selectedProductId}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    {quickProduct ? 'Actualizar' : 'Agregar'} Producto
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

