import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Layers } from 'lucide-react'
import { productVariantsService, ProductVariant } from '@/services/product-variants.service'
import { Dialog, DialogContent, DialogHeader, DialogDescription } from '@/components/ui/dialog'
import { AccessibleDialogTitle } from '@la-caja/ui-core'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface VariantSelectorProps {
  isOpen: boolean
  onClose: () => void
  productId: string
  productName: string
  onSelect: (variant: ProductVariant | null) => void
}

export default function VariantSelector({
  isOpen,
  onClose,
  productId,
  productName,
  onSelect,
}: VariantSelectorProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)

  const { data: groupedVariants, isLoading } = useQuery({
    queryKey: ['product-variants', 'grouped', productId],
    queryFn: () => productVariantsService.getVariantsGroupedByType(productId!),
    enabled: !!productId && isOpen,
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  useEffect(() => {
    if (!isOpen) {
      setSelectedVariant(null)
    }
  }, [isOpen])

  const handleSelect = (variant: ProductVariant) => {
    setSelectedVariant(variant)
  }

  const handleConfirm = () => {
    onSelect(selectedVariant)
    onClose()
  }

  const handleSkip = () => {
    onSelect(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <AccessibleDialogTitle className="text-lg sm:text-xl flex items-center">
            <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            Seleccionar Variante
          </AccessibleDialogTitle>
          <div className="text-sm text-muted-foreground mt-1">
            <DialogDescription>{productName || 'Cargando...'}</DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
            {!productId ? null : isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : groupedVariants && Object.keys(groupedVariants).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(groupedVariants).map(([variantType, variants]) => (
                  <div key={variantType}>
                    <h3 className="text-sm font-semibold text-foreground mb-2 capitalize">
                      {variantType}
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {variants
                        .filter((v) => v.is_active)
                        .map((variant) => {
                          const isSelected = selectedVariant?.id === variant.id
                          return (
                            <button
                              key={variant.id}
                              onClick={() => handleSelect(variant)}
                              className={cn(
                                'p-3 border rounded-lg transition-all',
                                'hover:border-primary hover:bg-primary/5',
                                isSelected
                                  ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2'
                                  : 'border-border'
                              )}
                            >
                              <p className="font-medium text-sm text-foreground">
                                {variant.variant_value}
                              </p>
                              {variant.stock !== undefined && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Stock: {variant.stock}
                                </p>
                              )}
                            </button>
                          )
                        })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay variantes disponibles</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleSkip}
                className="flex-1"
                disabled={isLoading}
              >
                Sin Variante
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isLoading || !selectedVariant}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

