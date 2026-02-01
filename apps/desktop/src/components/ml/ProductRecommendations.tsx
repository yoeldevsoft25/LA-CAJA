import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useRecommendations } from '@/hooks/useRecommendations'
import { ProductRecommendation } from '@/types/ml.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ShoppingCart, Package, ArrowRight } from 'lucide-react'
import { getRecommendationScoreColor } from '@/utils/ml-formatters'

interface ProductRecommendationsProps {
  sourceProductId?: string
  limit?: number
  onProductClick?: (productId: string) => void
}

export default function ProductRecommendations({
  sourceProductId,
  limit = 10,
  onProductClick,
}: ProductRecommendationsProps) {
  const [recommendationType, setRecommendationType] = useState<string>('all')

  const { data, isLoading, error } = useRecommendations({
    source_product_id: sourceProductId,
    recommendation_type: recommendationType === 'all' ? undefined : recommendationType,
    limit,
  })

  const recommendations = data?.recommendations || []

  const filteredRecommendations =
    recommendationType === 'all'
      ? recommendations
      : recommendations.filter((r) => r.recommendation_type === recommendationType)

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Error al cargar recomendaciones</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <CardTitle className="flex items-center gap-2 flex-shrink-0">
            <Package className="w-5 h-5" />
            Recomendaciones
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Select value={recommendationType} onValueChange={setRecommendationType}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="collaborative">Colaborativo</SelectItem>
                <SelectItem value="content_based">Basado en Contenido</SelectItem>
                <SelectItem value="hybrid">Híbrido</SelectItem>
              </SelectContent>
            </Select>
            {limit && filteredRecommendations.length >= limit && (
              <Link to="/app/ml" className="flex-shrink-0">
                <Button variant="ghost" size="sm" className="whitespace-nowrap">
                  Ver todas <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : filteredRecommendations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No hay recomendaciones disponibles</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecommendations.map((recommendation) => (
                <ProductRecommendationCard
                  key={recommendation.product_id}
                  recommendation={recommendation}
                  onProductClick={onProductClick}
                />
              ))}
            </div>
            {limit && filteredRecommendations.length >= limit && (
              <div className="mt-4 pt-4 border-t">
                <Link to="/app/ml">
                  <Button variant="outline" className="w-full">
                    Ver todas las recomendaciones <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ProductRecommendationCard({
  recommendation,
  onProductClick,
}: {
  recommendation: ProductRecommendation
  onProductClick?: (productId: string) => void
}) {
  const scoreColor = getRecommendationScoreColor(recommendation.score)

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-semibold text-sm line-clamp-2 flex-1">
            {recommendation.product_name}
          </h4>
          <Badge className={scoreColor} variant="secondary">
            {Math.round(recommendation.score)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {recommendation.reason}
        </p>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            {recommendation.recommendation_type === 'collaborative'
              ? 'Colaborativo'
              : recommendation.recommendation_type === 'content_based'
              ? 'Contenido'
              : 'Híbrido'}
          </Badge>
          {onProductClick && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onProductClick(recommendation.product_id)}
            >
              <ShoppingCart className="w-4 h-4 mr-1" />
              Ver
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

