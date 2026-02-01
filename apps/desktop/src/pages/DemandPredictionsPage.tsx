import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productsService } from '@/services/products.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, TrendingUp } from 'lucide-react'
import DemandPredictionCard from '@/components/ml/DemandPredictionCard'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function DemandPredictionsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  // Obtener lista de productos para búsqueda
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', 'search', { limit: 100 }],
    queryFn: () => productsService.search({ limit: 100 }),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  const products = productsData?.products || []
  const filteredProducts = products.filter((product: { name: string }) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
          Predicciones de Demanda
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Predicciones de demanda usando modelos de Machine Learning
        </p>
      </div>

      {/* Selector de producto */}
      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Producto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {productsLoading ? (
            <Skeleton className="h-10" />
          ) : (
            <Select
              value={selectedProductId || ''}
              onValueChange={(value) => setSelectedProductId(value || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un producto" />
              </SelectTrigger>
              <SelectContent>
                {filteredProducts.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No se encontraron productos
                  </div>
                ) : (
                  filteredProducts.map((product: { id: string; name: string }) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Predicción */}
      {selectedProductId && (
        <DemandPredictionCard
          productId={selectedProductId}
          productName={
            products.find((p: { id: string; name: string }) => p.id === selectedProductId)?.name || 'Producto'
          }
        />
      )}

      {/* Mensaje cuando no hay producto seleccionado */}
      {!selectedProductId && (
        <Card>
          <CardContent className="p-8 text-center">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Selecciona un producto para ver su predicción de demanda
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

