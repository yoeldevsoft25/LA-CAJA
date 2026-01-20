import { Plus, AlertCircle, UtensilsCrossed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { PublicProduct } from '@/services/public-menu.service'
import { cn } from '@/lib/utils'

interface ProductCardProps {
  product: PublicProduct
  onAddToCart: () => void
  variant?: 'default' | 'hero'
  index?: number
}

export default function ProductCard({
  product,
  onAddToCart,
  variant = 'default',
  index = 0,
}: ProductCardProps) {
  const isHero = variant === 'hero'
  // Alturas optimizadas para móvil
  const imageHeight = isHero ? 'h-44 sm:h-56 md:h-64' : 'h-40 sm:h-48 md:h-56'

  // Generar gradiente según categoría para placeholder
  const getCategoryGradient = (category: string | null) => {
    if (!category) return 'from-primary/20 to-primary/10'
    const hash = category.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const gradients = [
      'from-orange-400/30 to-red-400/20',
      'from-yellow-400/30 to-orange-400/20',
      'from-green-400/30 to-emerald-400/20',
      'from-blue-400/30 to-cyan-400/20',
      'from-purple-400/30 to-pink-400/20',
      'from-amber-400/30 to-yellow-400/20',
    ]
    return gradients[hash % gradients.length]
  }

  return (
    <Card
      className={cn(
        'group relative transition-all duration-500 overflow-hidden w-full h-full',
        'bg-background/80 backdrop-blur-sm',
        'border border-border/50',
        'hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1',
        'active:scale-[0.98] active:shadow-lg',
        'hover:border-primary/30',
        !product.is_available && 'opacity-60 grayscale',
        isHero && 'border-2 border-primary/30 shadow-lg',
        'animate-in fade-in slide-in-from-bottom-4',
        'touch-manipulation',
      )}
      style={{
        animationDelay: `${index * 50}ms`,
        animationFillMode: 'both',
      }}
    >
      <CardContent className={cn('p-0 w-full h-full flex flex-col', isHero ? 'p-2 sm:p-3' : 'p-3 sm:p-4')}>
        {/* Imagen del producto con efecto de profundidad */}
        <div
          className={cn(
            'w-full relative overflow-hidden rounded-lg sm:rounded-xl mb-2 sm:mb-3',
            imageHeight,
            'bg-gradient-to-br',
            getCategoryGradient(product.category),
            'shadow-inner'
          )}
        >
          {product.image_url ? (
            <>
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                loading="lazy"
              />
              {/* Overlay sutil - solo en hover (desktop) */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
              <UtensilsCrossed className="w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 mb-1 sm:mb-2 opacity-40 group-hover:opacity-60 transition-opacity" />
              <span className="text-xs font-medium">Sin imagen</span>
            </div>
          )}

          {/* Badge de agotado con glassmorphism */}
          {!product.is_available && (
            <div className="absolute top-2 sm:top-3 right-2 sm:right-3">
              <Badge
                variant="destructive"
                className="bg-destructive/90 backdrop-blur-md shadow-lg border border-destructive/50 text-xs px-1.5 py-0.5"
              >
                <AlertCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                <span className="hidden xs:inline">Agotado</span>
              </Badge>
            </div>
          )}

          {/* Indicador de hover - solo desktop */}
          <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-all duration-300 hidden sm:block" />
        </div>

        {/* Información del producto */}
        <div className={cn('space-y-1.5 sm:space-y-2 flex-1 flex flex-col', isHero && 'px-0.5 sm:px-1')}>
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                'font-extrabold line-clamp-2 leading-tight',
                'text-foreground group-hover:text-primary transition-colors duration-300',
                isHero 
                  ? 'text-base sm:text-lg md:text-xl' 
                  : 'text-sm sm:text-base md:text-lg'
              )}
            >
              {product.name}
            </h3>
          </div>

          {product.description && (
            <p
              className={cn(
                'text-muted-foreground line-clamp-2 leading-snug',
                isHero 
                  ? 'text-xs sm:text-sm hidden xs:block' 
                  : 'text-xs hidden sm:block'
              )}
            >
              {product.description}
            </p>
          )}

          {/* Precio y botón optimizado para móvil */}
          <div className="flex items-end justify-between pt-2 sm:pt-3 mt-auto gap-2 sm:gap-3">
            <div className="flex flex-col gap-0 sm:gap-0.5 min-w-0 flex-1">
              <p
                className={cn(
                  'font-black text-primary truncate',
                  'bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent',
                  isHero 
                    ? 'text-lg sm:text-xl md:text-2xl' 
                    : 'text-base sm:text-lg md:text-xl'
                )}
              >
                ${product.price_usd.toFixed(2)}
              </p>
              <p
                className={cn(
                  'text-muted-foreground font-medium',
                  isHero 
                    ? 'text-xs sm:text-sm' 
                    : 'text-xs'
                )}
              >
                Bs. {product.price_bs.toFixed(2)}
              </p>
            </div>

            <Button
              size={isHero ? 'lg' : 'default'}
              onClick={onAddToCart}
              disabled={!product.is_available}
              className={cn(
                'shrink-0 font-bold transition-all duration-300',
                'hover:scale-110 active:scale-95',
                'shadow-lg hover:shadow-xl',
                'bg-primary hover:bg-primary/90 active:bg-primary/80',
                'border-2 border-primary/20 hover:border-primary/40',
                'touch-manipulation min-h-[44px] min-w-[44px]',
                isHero
                  ? 'px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base'
                  : 'px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm'
              )}
            >
              <Plus className={cn('mr-1 sm:mr-1.5', isHero ? 'w-3.5 h-3.5 sm:w-4 sm:h-4' : 'w-3 h-3 sm:w-3.5 sm:h-3.5')} />
              <span className="hidden xs:inline">Agregar</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
