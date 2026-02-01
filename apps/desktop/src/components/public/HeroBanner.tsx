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
  if (featuredProducts.length < 1) {
    return null
  }

  return (
    <div className="relative w-full overflow-hidden rounded-[2.5rem] bg-muted/30 border border-border/40 p-6 sm:p-8">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 size-96 bg-primary/10 blur-[100px] rounded-full" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 size-96 bg-primary/5 blur-[80px] rounded-full" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-primary/20 flex items-center justify-center">
              <Sparkles className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-heading font-black tracking-tight">Destacados</h2>
              <p className="text-sm text-muted-foreground font-medium">Recomendaciones del chef</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {featuredProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={() => onAddToCart(product)}
              variant="hero"
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
