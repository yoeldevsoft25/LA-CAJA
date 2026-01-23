import { useState, useEffect, lazy, Suspense } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useAuth } from '@/stores/auth.store'
import { Search, Package, AlertTriangle, Plus, TrendingUp, TrendingDown, History, Trash2, AlertOctagon, Download, ShoppingCart } from 'lucide-react'
import { inventoryService, StockStatus } from '@/services/inventory.service'
import { warehousesService } from '@/services/warehouses.service'
// ⚡ OPTIMIZACIÓN: Lazy load de modales grandes - solo cargar cuando se abren
const StockReceivedModal = lazy(() => import('@/components/inventory/StockReceivedModal'))
const StockAdjustModal = lazy(() => import('@/components/inventory/StockAdjustModal'))
const BulkStockAdjustModal = lazy(() => import('@/components/inventory/BulkStockAdjustModal'))
const MovementsModal = lazy(() => import('@/components/inventory/MovementsModal'))
const PurchaseOrderFormModal = lazy(() => import('@/components/purchase-orders/PurchaseOrderFormModal'))
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import toast from '@/lib/toast'

type WeightUnit = 'kg' | 'g' | 'lb' | 'oz'

const WEIGHT_UNIT_TO_KG: Record<WeightUnit, number> = {
  kg: 1,
  g: 0.001,
  lb: 0.45359237,
  oz: 0.028349523125,
}

const formatKg = (value: number) => {
  const fixed = value.toFixed(3)
  return fixed.replace(/\.?0+$/, '')
}

const formatStockValue = (item: StockStatus, value: number) => {
  const isWeight = item.is_weight_product ?? Boolean(item.weight_unit)
  if (!isWeight) return `${value}`
  const unit = (item.weight_unit || 'kg') as WeightUnit
  const kgValue = value * WEIGHT_UNIT_TO_KG[unit]
  return `${formatKg(kgValue)} kg`
}

const escapeCsvValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return ''
  const stringValue = String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

const buildInventoryCsv = (items: StockStatus[]) => {
  const headers = ['ID', 'Producto', 'Stock Actual', 'Umbral Minimo', 'Estado']
  const rows = items.map((item) => [
    item.product_id,
    item.product_name,
    formatStockValue(item, item.current_stock),
    formatStockValue(item, item.low_stock_threshold),
    item.is_low_stock ? 'Bajo' : 'Normal',
  ])

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n')
}

export default function InventoryPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [isStockReceivedModalOpen, setIsStockReceivedModalOpen] = useState(false)
  const [isStockAdjustModalOpen, setIsStockAdjustModalOpen] = useState(false)
  const [isBulkStockAdjustModalOpen, setIsBulkStockAdjustModalOpen] = useState(false)
  const [isMovementsModalOpen, setIsMovementsModalOpen] = useState(false)
  const [isPurchaseOrderModalOpen, setIsPurchaseOrderModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<StockStatus | null>(null)
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [isExporting, setIsExporting] = useState(false)
  // Estados para vaciar stock (solo owners)
  const [isResetProductModalOpen, setIsResetProductModalOpen] = useState(false)
  const [isResetAllModalOpen, setIsResetAllModalOpen] = useState(false)
  const [resetNote, setResetNote] = useState('')
  const [resetConfirmText, setResetConfirmText] = useState('')
  const isOwner = user?.role === 'owner'

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, showLowStockOnly, warehouseFilter])

  const offset = (currentPage - 1) * pageSize

  // Obtener estado del stock con paginación y búsqueda en servidor
  const {
    data: stockStatusData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'inventory',
      'stock-status',
      searchQuery,
      showLowStockOnly,
      warehouseFilter,
      currentPage,
      pageSize,
      user?.store_id,
    ],
    queryFn: () =>
      inventoryService.getStockStatusPaged({
        search: searchQuery || undefined,
        warehouse_id: warehouseFilter !== 'all' ? warehouseFilter : undefined,
        limit: pageSize,
        offset,
        low_stock_only: showLowStockOnly || undefined,
      }),
    enabled: !!user?.store_id,
    staleTime: 1000 * 60 * 10, // 10 minutos
    gcTime: Infinity, // Nunca eliminar
  })

  const { data: lowStockCountData } = useQuery({
    queryKey: ['inventory', 'low-stock-count', searchQuery, warehouseFilter, user?.store_id],
    queryFn: () =>
      inventoryService.getStockStatusPaged({
        search: searchQuery || undefined,
        warehouse_id: warehouseFilter !== 'all' ? warehouseFilter : undefined,
        low_stock_only: true,
        limit: 1,
        offset: 0,
      }),
    enabled: !!user?.store_id && !showLowStockOnly,
    staleTime: 1000 * 60 * 10,
    gcTime: Infinity,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(),
    enabled: !!user?.store_id,
  })

  const stockItems = stockStatusData?.items || []
  const total = stockStatusData?.total || 0
  const lowStockCount = showLowStockOnly ? total : lowStockCountData?.total || 0

  // Mutaciones para vaciar stock (solo owners)
  const resetProductMutation = useMutation({
    mutationFn: ({ productId, note }: { productId: string; note?: string }) =>
      inventoryService.resetProductStock(productId, note),
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setIsResetProductModalOpen(false)
      setSelectedProduct(null)
      setResetNote('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al vaciar el stock')
    },
  })

  const resetAllMutation = useMutation({
    mutationFn: (note?: string) => inventoryService.resetAllStock(note),
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setIsResetAllModalOpen(false)
      setResetNote('')
      setResetConfirmText('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al vaciar el inventario')
    },
  })

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
    setIsBulkStockAdjustModalOpen(false)
    setIsPurchaseOrderModalOpen(false)
    setIsMovementsModalOpen(false)
    setIsResetProductModalOpen(false)
    setIsResetAllModalOpen(false)
    setSelectedProduct(null)
    setResetNote('')
    setResetConfirmText('')
  }

  const handleResetProductStock = (product: StockStatus) => {
    setSelectedProduct(product)
    setResetNote('')
    setIsResetProductModalOpen(true)
  }

  const handleExportInventory = async () => {
    setIsExporting(true)
    try {
      const items = await inventoryService.getStockStatus({
        search: searchQuery.trim() || undefined,
        warehouse_id: warehouseFilter !== 'all' ? warehouseFilter : undefined,
        low_stock_only: showLowStockOnly || undefined,
      })

      if (items.length === 0) {
        toast.error('No hay datos para exportar')
        return
      }

      const csv = buildInventoryCsv(items)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inventario-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('Inventario exportado')
    } catch (error) {
      toast.error('Error al exportar inventario')
    } finally {
      setIsExporting(false)
    }
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
              onClick={() => setIsBulkStockAdjustModalOpen(true)}
              className="w-full sm:w-auto"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Ajuste Masivo
            </Button>
            <Button
              variant="outline"
              onClick={() => handleViewMovements(null)}
              className="w-full sm:w-auto"
            >
              <History className="w-4 h-4 mr-2" />
              Ver Todos los Movimientos
            </Button>
            <Button
              variant="outline"
              onClick={handleExportInventory}
              className="w-full sm:w-auto"
              disabled={isExporting}
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? 'Exportando...' : 'Exportar Excel'}
            </Button>
            {/* Solo owners pueden vaciar todo el inventario */}
            {isOwner && (
              <Button
                variant="outline"
                onClick={() => {
                  setResetNote('')
                  setResetConfirmText('')
                  setIsResetAllModalOpen(true)
                }}
                className="w-full sm:w-auto text-destructive border-destructive/50 hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Vaciar Todo
              </Button>
            )}
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

        {/* Filtro de bodega */}
        {warehouses.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground">Bodega</Label>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Todas las bodegas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las bodegas</SelectItem>
                {warehouses
                  .filter((warehouse) => warehouse.is_active)
                  .map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} {warehouse.is_default ? '(Por defecto)' : ''}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Filtro de stock bajo */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Switch
                id="low-stock-filter"
                checked={showLowStockOnly}
                onCheckedChange={setShowLowStockOnly}
                className="flex-shrink-0"
              />
              <Label
                htmlFor="low-stock-filter"
                className="text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 min-w-0"
              >
                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500 flex-shrink-0" />
                <span className="truncate">Solo mostrar productos con stock bajo</span>
              </Label>
            </div>
            {/* Botón para crear orden desde productos con stock bajo */}
            {lowStockCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Obtener productos con stock bajo
                  const lowStockProducts = showLowStockOnly
                    ? stockItems
                    : stockItems.filter((item) => item.is_low_stock)
                  
                  if (lowStockProducts.length === 0) {
                    toast.error('No hay productos con stock bajo para crear orden')
                    return
                  }

                  setIsPurchaseOrderModalOpen(true)
                }}
                className="border-primary text-primary hover:bg-primary/10 min-h-[44px] w-full sm:w-auto flex-shrink-0"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Crear Orden ({lowStockCount})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de productos */}
      <Card className="border border-border">
        <CardContent className="p-0">
        {isError ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center justify-center py-8">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-destructive" />
                <p className="text-muted-foreground">No se pudo cargar el inventario</p>
                {error instanceof Error && (
                  <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
                )}
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => refetch()}
                >
                  Reintentar
                </Button>
              </div>
          </div>
        ) : isLoading ? (
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
              <Table className="w-full sm:table-fixed">
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
                        {formatStockValue(item, item.current_stock)}
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
                      {formatStockValue(item, item.low_stock_threshold)}
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
                          aria-label="Ver movimientos de inventario"
                        >
                          <History className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                          onClick={() => handleReceiveStock(item)}
                              className="h-8 w-8 sm:h-9 sm:w-9 text-primary hover:text-primary hover:bg-primary/10"
                          title="Recibir stock"
                          aria-label="Recibir stock"
                        >
                          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                          onClick={() => handleAdjustStock(item)}
                              className="h-8 w-8 sm:h-9 sm:w-9 text-purple-600 hover:text-purple-600 hover:bg-purple-50"
                          title="Ajustar stock"
                          aria-label="Ajustar stock"
                        >
                          <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                            </Button>
                            {/* Solo owners pueden vaciar stock de un producto */}
                            {isOwner && item.current_stock > 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleResetProductStock(item)}
                                className="h-8 w-8 sm:h-9 sm:w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Vaciar stock"
                              >
                                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                              </Button>
                            )}
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

      <BulkStockAdjustModal
        isOpen={isBulkStockAdjustModalOpen}
        onClose={() => setIsBulkStockAdjustModalOpen(false)}
        stockItems={stockItems}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['inventory'] })
          setIsBulkStockAdjustModalOpen(false)
        }}
      />

      {isPurchaseOrderModalOpen && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Cargando...</p>
            </div>
          </div>
        }>
          <PurchaseOrderFormModal
            isOpen={isPurchaseOrderModalOpen}
            onClose={() => setIsPurchaseOrderModalOpen(false)}
            initialProducts={
              showLowStockOnly
                ? stockItems.map((item) => ({
                    product_id: item.product_id,
                    quantity: Math.max(1, Math.ceil((item.low_stock_threshold || 10) * 1.5)), // Sugerir cantidad basada en umbral
                  }))
                : stockItems
                    .filter((item) => item.is_low_stock)
                    .map((item) => ({
                      product_id: item.product_id,
                      quantity: Math.max(1, Math.ceil((item.low_stock_threshold || 10) * 1.5)),
                    }))
            }
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
              setIsPurchaseOrderModalOpen(false)
            }}
          />
        </Suspense>
      )}

      <MovementsModal
        isOpen={isMovementsModalOpen}
        onClose={handleCloseModals}
        product={selectedProduct}
      />

      {/* Modal de confirmación para vaciar stock de un producto */}
      <Dialog open={isResetProductModalOpen} onOpenChange={(open) => !open && handleCloseModals()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertOctagon className="w-5 h-5" />
              Vaciar Stock del Producto
            </DialogTitle>
            <DialogDescription>
              Esta acción pondrá el stock de este producto en <strong>0</strong>.
              Se registrará como un ajuste de inventario.
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-semibold">{selectedProduct.product_name}</p>
                <p className="text-sm text-muted-foreground">
                  Stock actual: <span className="font-bold text-foreground">
                    {formatStockValue(selectedProduct, selectedProduct.current_stock)}
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-note">Nota (opcional)</Label>
                <Textarea
                  id="reset-note"
                  value={resetNote}
                  onChange={(e) => setResetNote(e.target.value)}
                  placeholder="Razón del vaciado de stock..."
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCloseModals}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedProduct) {
                  resetProductMutation.mutate({
                    productId: selectedProduct.product_id,
                    note: resetNote || undefined,
                  })
                }
              }}
              disabled={resetProductMutation.isPending}
            >
              {resetProductMutation.isPending ? 'Vaciando...' : 'Vaciar Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para vaciar TODO el inventario */}
      <Dialog open={isResetAllModalOpen} onOpenChange={(open) => !open && handleCloseModals()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertOctagon className="w-5 h-5" />
              Vaciar TODO el Inventario
            </DialogTitle>
            <DialogDescription>
              Esta acción es <strong className="text-destructive">IRREVERSIBLE</strong>.
              Se pondrá en <strong>0</strong> el stock de TODOS los productos de la tienda.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive font-medium">
                Se vaciarán {stockItems.filter(item => item.current_stock > 0).length} productos con stock
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-all-note">Nota (opcional)</Label>
              <Textarea
                id="reset-all-note"
                value={resetNote}
                onChange={(e) => setResetNote(e.target.value)}
                placeholder="Razón del vaciado masivo..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-confirm">
                Para confirmar, escribe <code className="text-destructive font-bold">VACIAR TODO</code>
              </Label>
              <Input
                id="reset-confirm"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="VACIAR TODO"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCloseModals}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => resetAllMutation.mutate(resetNote || undefined)}
              disabled={resetConfirmText !== 'VACIAR TODO' || resetAllMutation.isPending}
            >
              {resetAllMutation.isPending ? 'Vaciando...' : 'Vaciar Todo el Inventario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
