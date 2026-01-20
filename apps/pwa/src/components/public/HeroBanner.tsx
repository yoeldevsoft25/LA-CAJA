import { type PublicProduct } from '@/services/public-menu.service'
import ProductCard from './ProductCard'
import { Sparkles } from 'lucide-react'

interface HeroBannerProps {
  products: PublicProduct[]
  onAddToCart: (product: PublicProduct) => void
}

export default function HeroBanner({
  products,
  onAddToCart,
}: HeroBannerProps) {
  // Mostrar máximo 4 productos en el banner
  const featuredProducts = products.slice(0, 4)

  // Si hay menos de 2 productos, no mostrar el banner
  if (featuredProducts.length < 2) {
    return null
  }

  return (
    <div className="mb-6 sm:mb-8 w-full">
      {/* Header con glassmorphism optimizado para móvil */}
      <div className="relative mb-4 sm:mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-xl sm:rounded-2xl blur-xl" />
        <div className="relative bg-background/60 backdrop-blur-md border border-primary/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="bg-primary/20 rounded-full p-1.5 sm:p-2 backdrop-blur-sm shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-foreground leading-tight truncate">
                Productos Destacados
              </h2>
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-0.5 sm:mt-1">
                Nuestras recomendaciones especiales
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid responsive: 2 columnas en móvil, 4 en desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 w-full">
        {featuredProducts.map((product, index) => (
          <div
            key={product.id}
            className="w-full min-w-0 animate-in fade-in slide-in-from-bottom-4"
            style={{
              animationDelay: `${index * 100}ms`,
              animationFillMode: 'both',
            }}
          >
            <ProductCard
              product={product}
              onAddToCart={() => onAddToCart(product)}
              variant="hero"
              index={index}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
