import { Scale } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export interface RecentProductItem {
  product_id: string
  name: string
  sold_at: string
  is_weight_product?: boolean
  weight_unit?: string | null
}

export interface LastSoldProductsCardProps {
  recentProducts: RecentProductItem[]
  isLoading: boolean
  onProductClick: (productId: string) => void
}

export default function LastSoldProductsCard({
  recentProducts,
  isLoading,
  onProductClick,
}: LastSoldProductsCardProps) {
  if (isLoading && recentProducts.length === 0) {
    return (
      <Card className="border border-border">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse" />
            Cargando últimos vendidos...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (recentProducts.length === 0) return null

  return (
    <Card className="border border-border">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Últimos vendidos</h3>
          <span className="text-xs text-muted-foreground">Toca para agregar</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {recentProducts.map((item) => (
            <Button
              key={item.product_id}
              variant="outline"
              size="sm"
              onClick={() => onProductClick(item.product_id)}
              className="h-8 gap-1.5"
            >
              {item.is_weight_product && <Scale className="w-3.5 h-3.5 text-primary" />}
              <span className="max-w-[160px] truncate">{item.name}</span>
              {item.is_weight_product && item.weight_unit && (
                <span className="text-[10px] text-muted-foreground">/{item.weight_unit}</span>
              )}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
