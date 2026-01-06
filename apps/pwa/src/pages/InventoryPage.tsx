import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/auth.store'
import { Search, Package, AlertTriangle, Plus, TrendingUp, TrendingDown, History } from 'lucide-react'
import { inventoryService, StockStatus } from '@/services/inventory.service'
import StockReceivedModal from '@/components/inventory/StockReceivedModal'
import StockAdjustModal from '@/components/inventory/StockAdjustModal'
import MovementsModal from '@/components/inventory/MovementsModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export default function InventoryPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [isStockReceivedModalOpen, setIsStockReceivedModalOpen] = useState(false)
  const [isStockAdjustModalOpen, setIsStockAdjustModalOpen] = useState(false)
  const [isMovementsModalOpen, setIsMovementsModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<StockStatus | null>(null)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, showLowStockOnly])

  const offset = (currentPage - 1) * pageSize

  // Obtener estado del stock con paginación y búsqueda en servidor
  const { data: stockStatusData, isLoading } = useQuery({
    queryKey: [
      'inventory',
      'stock-status',
      searchQuery,
      showLowStockOnly,
      currentPage,
      pageSize,
      user?.store_id,
    ],
    queryFn: () =>
      inventoryService.getStockStatusPaged({
        search: searchQuery || undefined,
        limit: pageSize,
        offset,
        low_stock_only: showLowStockOnly || undefined,
      }),
    enabled: !!user?.store_id,
    staleTime: 1000 * 60 * 10, // 10 minutos
    gcTime: Infinity, // Nunca eliminar
  })

  const { data: lowStockCountData } = useQuery({
    queryKey: ['inventory', 'low-stock-count', searchQuery, user?.store_id],
    queryFn: () =>
      inventoryService.getStockStatusPaged({
        search: searchQuery || undefined,
        low_stock_only: true,
        limit: 1,
        offset: 0,
      }),
    enabled: !!user?.store_id && !showLowStockOnly,
    staleTime: 1000 * 60 * 10,
    gcTime: Infinity,
  })

  const stockItems = stockStatusData?.items || []
  const total = stockStatusData?.total || 0
  const lowStockCount = showLowStockOnly ? total : lowStockCountData?.total || 0

  const handleReceiveStock = (product: StockStatus) => {
    setSelectedProduct(product)
    setIsStockReceivedModalOpen(true)
  }

  const handleAdjustStock = (product: StockStatus) => {
    setSelectedProduct(product)
    setIsStockAdjustModalOpen(true)
  }

  const handleViewMovements = (product: StockStatus | null) => {
    setSelectedProduct(product)
    setIsMovementsModalOpen(true)
  }

  const handleCloseModals = () => {
    setIsStockReceivedModalOpen(false)
    setIsStockAdjustModalOpen(false)
    setIsMovementsModalOpen(false)
    setSelectedProduct(null)
  }

  // Calcular porcentaje de stock para Progress
  const getStockPercentage = (item: StockStatus) => {
    if (item.low_stock_threshold === 0) return 100
    const percentage = (item.current_stock / (item.low_stock_threshold * 2)) * 100
    return Math.min(100, Math.max(0, percentage))
  }

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestión de Inventario</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {total} productos
              {showLowStockOnly && ` con stock bajo`}
              {!showLowStockOnly && lowStockCount > 0 && (
                <span className="text-orange-600 font-semibold ml-2">
                  ({lowStockCount} con stock bajo)
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => {
                setSelectedProduct(null)
                setIsStockReceivedModalOpen(true)
              }}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Recibir Stock
            </Button>
            <Button
              variant="outline"
              onClick={() => handleViewMovements(null)}
              className="w-full sm:w-auto"
            >
              <History className="w-4 h-4 mr-2" />
              Ver Todos los Movimientos
            </Button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-4 sm:mb-6 border border-border">
        <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Búsqueda */}
        <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 sm:w-5 sm:h-5 z-10" />
            <Input
            type="text"
            placeholder="Buscar por nombre, SKU o código de barras..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 sm:pl-10 h-11 sm:h-12 text-base sm:text-lg"
          />
        </div>

        {/* Filtro de stock bajo */}
          <div className="flex items-center space-x-2">
            <Switch
              id="low-stock-filter"
              checked={showLowStockOnly}
              onCheckedChange={setShowLowStockOnly}
            />
            <Label
              htmlFor="low-stock-filter"
              className="text-sm sm:text-base cursor-pointer flex items-center"
            >
              <AlertTriangle className="w-4 h-4 mr-1 text-orange-500" />
              Solo mostrar productos con stock bajo
            </Label>
        </div>
        </CardContent>
      </Card>

      {/* Lista de productos */}
      <Card className="border border-border">
        <CardContent className="p-0">
        {isLoading ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
          </div>
        ) : stockItems.length === 0 ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-sm sm:text-base font-medium text-foreground mb-1">
              {searchQuery || showLowStockOnly
                ? 'No se encontraron productos'
                : 'No hay productos en inventario'}
            </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
              {searchQuery
                ? 'Intenta con otro término de búsqueda'
                : 'Haz clic en "Recibir Stock" para agregar productos'}
            </p>
              </div>
          </div>
        ) : (
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50%] sm:w-[45%]">Producto</TableHead>
                    <TableHead className="text-center">Stock Actual</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Umbral Mínimo</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Estado</TableHead>
                    <TableHead className="text-right w-32 sm:w-40">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockItems.map((item) => {
                    const stockPercentage = getStockPercentage(item)
                    const isLowStock = item.is_low_stock

                    return (
                      <TableRow
                    key={item.product_id}
                        className={cn(
                          'transition-colors',
                          isLowStock && 'bg-orange-50 hover:bg-orange-100'
                        )}
                  >
                        <TableCell className="align-top w-[50%] sm:w-[45%]">
                          <div className="flex items-center gap-2 min-w-0">
                            <Package className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0 max-w-full">
                              <p
                                className="font-semibold text-foreground text-sm sm:text-base break-words"
                                title={item.product_name}
                              >
                            {item.product_name}
                          </p>
                              {isLowStock && (
                            <p className="text-xs text-orange-600 font-medium mt-0.5">
                              Stock bajo
                            </p>
                          )}
                        </div>
                      </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="space-y-1">
                      <span
                              className={cn(
                                'text-lg sm:text-xl font-bold block',
                                isLowStock ? 'text-orange-600' : 'text-foreground'
                              )}
                      >
                        {item.current_stock}
                      </span>
                            {/* Indicador de progreso visual */}
                            <div className="w-16 mx-auto">
                              <Progress
                                value={stockPercentage}
                                className={cn(
                                  'h-2',
                                  isLowStock ? 'bg-orange-200' : 'bg-muted'
                                )}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground hidden sm:table-cell">
                      {item.low_stock_threshold}
                        </TableCell>
                        <TableCell className="text-center hidden md:table-cell">
                          {isLowStock ? (
                            <Badge
                              variant="outline"
                              className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100"
                            >
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Bajo
                            </Badge>
                      ) : (
                            <Badge
                              variant="outline"
                              className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100"
                            >
                          Normal
                            </Badge>
                      )}
                        </TableCell>
                        <TableCell className="w-32 sm:w-40">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                          onClick={() => handleViewMovements(item)}
                              className="h-8 w-8 sm:h-9 sm:w-9"
                          title="Ver movimientos"
                        >
                          <History className="w-4 h-4 sm:w-5 sm:h-5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                          onClick={() => handleReceiveStock(item)}
                              className="h-8 w-8 sm:h-9 sm:w-9 text-primary hover:text-primary hover:bg-primary/10"
                          title="Recibir stock"
                        >
                          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                          onClick={() => handleAdjustStock(item)}
                              className="h-8 w-8 sm:h-9 sm:w-9 text-purple-600 hover:text-purple-600 hover:bg-purple-50"
                          title="Ajustar stock"
                        >
                          <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
                            </Button>
                      </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
          </div>
        )}
        </CardContent>
      </Card>

      {/* Paginación */}
      {stockItems.length > 0 && total > pageSize && (
        <div className="mt-4 flex items-center justify-between px-4">
          <div className="text-sm text-muted-foreground">
            Mostrando {offset + 1} - {Math.min(offset + pageSize, total)} de {total} productos
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <div className="flex items-center gap-2 px-3">
              <span className="text-sm">
                Página {currentPage} de {Math.ceil(total / pageSize)}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage >= Math.ceil(total / pageSize)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Modales */}
      <StockReceivedModal
        isOpen={isStockReceivedModalOpen}
        onClose={handleCloseModals}
        product={selectedProduct}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['inventory'] })
          handleCloseModals()
        }}
      />

      <StockAdjustModal
        isOpen={isStockAdjustModalOpen}
        onClose={handleCloseModals}
        product={selectedProduct}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['inventory'] })
          handleCloseModals()
        }}
      />

      <MovementsModal
        isOpen={isMovementsModalOpen}
        onClose={handleCloseModals}
        product={selectedProduct}
      />
    </div>
  )
}
