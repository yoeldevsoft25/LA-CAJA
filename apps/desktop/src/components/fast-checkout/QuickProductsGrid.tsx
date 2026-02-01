import { useQuery } from '@tanstack/react-query'
import { Zap, Scale } from 'lucide-react'
import { fastCheckoutService, QuickProduct } from '@/services/fast-checkout.service'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface QuickProductsGridProps {
  onProductClick: (product: QuickProduct) => void
  className?: string
}

export default function QuickProductsGrid({
  onProductClick,
  className,
}: QuickProductsGridProps) {
  const getWeightPriceDecimals = (unit?: string | null) =>
    unit === 'g' || unit === 'oz' ? 4 : 2

  const { data: quickProducts, isLoading } = useQuery({
    queryKey: ['fast-checkout', 'quick-products'],
    queryFn: () => fastCheckoutService.getQuickProducts(),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  // Filtrar solo productos activos y ordenar por posición
  const activeProducts = quickProducts
    ?.filter((qp) => qp.is_active)
    .sort((a, b) => a.position - b.position) || []

  if (isLoading) {
    return (
      <Card className={cn('border border-border', className)}>
        <CardContent className="p-4">
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {[...Array(16)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activeProducts.length === 0) {
    return null
  }

  return (
    <Card className={cn('border border-border', className)}>
      <CardContent className="p-3 sm:p-4">
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
          {activeProducts.map((quickProduct) => {
            const product = quickProduct.product
            if (!product) return null

            return (
              <button
                key={quickProduct.id}
                onClick={() => onProductClick(quickProduct)}
                className={cn(
                  'flex flex-col items-center justify-center p-2 sm:p-3',
                  'border border-border rounded-lg',
                  'hover:border-primary hover:bg-primary/5',
                  'active:bg-primary/10',
                  'transition-all cursor-pointer',
                  'touch-manipulation'
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="w-full flex items-center justify-center mb-1 gap-1">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  {product.is_weight_product && (
                    <Scale className="w-3.5 h-3.5 text-primary" />
                  )}
                </div>
                <div className="text-xs sm:text-sm font-mono font-bold text-primary mb-1">
                  {quickProduct.quick_key}
                </div>
                <div className="text-[10px] sm:text-xs text-foreground text-center line-clamp-2 leading-tight">
                  {product.name}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {product.is_weight_product && product.price_per_weight_usd ? (
                    <>
                      ${Number(product.price_per_weight_usd).toFixed(
                        getWeightPriceDecimals(product.weight_unit)
                      )}/
                      {product.weight_unit}
                    </>
                  ) : (
                    <>${Number(product.price_usd).toFixed(2)}</>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
