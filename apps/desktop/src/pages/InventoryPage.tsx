import { useState, useEffect, lazy, Suspense } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useAuth } from '@/stores/auth.store'
import { Search, Package, AlertTriangle, Plus, TrendingUp, TrendingDown, History, Trash2, AlertOctagon, Download, ShoppingCart, RefreshCw, MoreHorizontal } from 'lucide-react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InventorySkeleton } from '@/components/ui/module-skeletons'
import { PremiumEmptyState } from '@/components/ui/premium-empty-state'
import { useSmoothLoading } from '@/hooks/use-smooth-loading'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  const debouncedSearchQuery = useDebounce(searchQuery, 250)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
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
  }, [debouncedSearchQuery, showLowStockOnly, warehouseFilter])

  const offset = (currentPage - 1) * pageSize

  // Obtener estado del stock con paginación y búsqueda en servidor
  const {
    data: stockStatusData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'inventory',
      'stock-status',
      debouncedSearchQuery,
      showLowStockOnly,
      warehouseFilter,
      currentPage,
      pageSize,
      user?.store_id,
    ],
    queryFn: () =>
      inventoryService.getStockStatusPaged({
        search: debouncedSearchQuery || undefined,
        warehouse_id: warehouseFilter !== 'all' ? warehouseFilter : undefined,
        limit: pageSize,
        offset,
        low_stock_only: showLowStockOnly || undefined,
      }),
    enabled: !!user?.store_id,
    staleTime: 1000 * 60 * 10, // 10 minutos
    gcTime: Infinity, // Nunca eliminar
  })

  // Smooth loading state to prevent skeleton flickering
  const isSmoothLoading = useSmoothLoading(isLoading || isFetching)

  const { data: lowStockCountData } = useQuery({
    queryKey: ['inventory', 'low-stock-count', debouncedSearchQuery, warehouseFilter, user?.store_id],
    queryFn: () =>
      inventoryService.getStockStatusPaged({
        search: debouncedSearchQuery || undefined,
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
  const activeFiltersCount = [
    debouncedSearchQuery.trim().length > 0,
    showLowStockOnly,
    warehouseFilter !== 'all',
  ].filter(Boolean).length

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
    onError: (error: unknown) => {
      const apiError = error as { response?: { data?: { message?: string } } }
      toast.error(apiError.response?.data?.message || 'Error al vaciar el stock')
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
    onError: (error: unknown) => {
      const apiError = error as { response?: { data?: { message?: string } } }
      toast.error(apiError.response?.data?.message || 'Error al vaciar el inventario')
    },
  })

  const reconcileMutation = useMutation({
    mutationFn: () => inventoryService.reconcileStock(),
    onSuccess: (data) => {
      toast.success(data.message)
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: (error: unknown) => {
      const apiError = error as { response?: { data?: { message?: string } } }
      toast.error(apiError.response?.data?.message || 'Error al reconciliar stock')
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
        search: debouncedSearchQuery.trim() || undefined,
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

  const handleResetFilters = () => {
    setSearchQuery('')
    setWarehouseFilter('all')
    setShowLowStockOnly(false)
    setCurrentPage(1)
  }

  return (
    <div className="h-full max-w-7xl mx-auto">

      {/* KPI Cards: Minimalist Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card className="premium-shadow border-none bg-card/50 backdrop-blur-sm overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute right-0 top-0 h-24 w-24 bg-primary/5 rounded-full blur-2xl transform translate-x-8 -translate-y-8" />
          <CardContent className="p-6 flex flex-col justify-center relative z-10">
            <div className="flex items-center justify-between space-x-2">
              <span className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Total Productos</span>
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <Package className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tighter text-foreground">{total}</span>
              <span className="text-xs font-medium text-muted-foreground">items</span>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-shadow border-none bg-card/50 backdrop-blur-sm overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute right-0 top-0 h-24 w-24 bg-orange-500/5 rounded-full blur-2xl transform translate-x-8 -translate-y-8" />
          <CardContent className="p-6 flex flex-col justify-center relative z-10">
            <div className="flex items-center justify-between space-x-2">
              <span className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Stock Bajo</span>
              <div className="p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tighter text-foreground">
                {lowStockCount}
              </span>
              <span className="text-sm font-bold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md">
                requieren atención
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-shadow border-none bg-card/50 backdrop-blur-sm overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute right-0 top-0 h-24 w-24 bg-emerald-500/5 rounded-full blur-2xl transform translate-x-8 -translate-y-8" />
          <CardContent className="p-6 flex flex-col justify-center relative z-10">
            <div className="flex items-center justify-between space-x-2">
              <span className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Salud de Stock</span>
              <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tighter text-foreground">
                {total > 0 ? Math.round(((total - lowStockCount) / total) * 100) : 0}%
              </span>
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                inventario óptimo
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header Actions & Title */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Inventario</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => {
              setSelectedProduct(null)
              setIsStockReceivedModalOpen(true)
            }}
            className="w-full sm:w-auto shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Recibir Stock
          </Button>

          {/* Opciones Adicionales Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-auto px-3 gap-2 bg-background/50 backdrop-blur-sm hover:bg-background/80">
                <MoreHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Opciones</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => setIsBulkStockAdjustModalOpen(true)}>
                <TrendingUp className="w-4 h-4 mr-2" />
                Ajuste Masivo
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => handleViewMovements(null)}>
                <History className="w-4 h-4 mr-2" />
                Ver Todos los Movimientos
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleExportInventory} disabled={isExporting}>
                <Download className="w-4 h-4 mr-2" />
                {isExporting ? 'Exportando...' : 'Exportar Excel'}
              </DropdownMenuItem>

              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-destructive/80 text-xs uppercase tracking-wider mt-2">Administración</DropdownMenuLabel>

                  <DropdownMenuItem
                    onClick={() => reconcileMutation.mutate()}
                    disabled={reconcileMutation.isPending}
                  >
                    <RefreshCw className={cn('w-4 h-4 mr-2', reconcileMutation.isPending && 'animate-spin')} />
                    {reconcileMutation.isPending ? 'Reconciliando...' : 'Reconciliar Stock'}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => {
                      setResetNote('')
                      setResetConfirmText('')
                      setIsResetAllModalOpen(true)
                    }}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Vaciar Todo
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6 border-none shadow-md shadow-black/5 bg-background transition-all duration-300">
        <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs sm:text-sm text-muted-foreground">
              {activeFiltersCount > 0 ? `${activeFiltersCount} filtro(s) activo(s)` : 'Filtros rápidos de inventario'}
            </p>
            {activeFiltersCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 text-xs"
              >
                Limpiar filtros
              </Button>
            )}
          </div>

          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/60 w-4 h-4 sm:w-5 sm:h-5 z-10" />
            <Input
              type="text"
              placeholder="Buscar por nombre, SKU o código de barras…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 sm:pl-10 h-11 sm:h-12 text-base border-muted/40 bg-muted/50 focus:bg-background transition-all shadow-sm focus:ring-primary/20"
              aria-label="Buscar productos en inventario"
            />
          </div>

          {/* Filtro de bodega */}
          {warehouses.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Bodega</Label>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger className="mt-1.5 border-muted/40 bg-muted/50">
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pt-1">
            <div className="flex items-center gap-2 flex-1 min-w-0 bg-orange-500/10 p-2 rounded-lg border border-orange-500/20">
              <Switch
                id="low-stock-filter"
                checked={showLowStockOnly}
                onCheckedChange={setShowLowStockOnly}
                className="flex-shrink-0 data-[state=checked]:bg-orange-500"
              />
              <Label
                htmlFor="low-stock-filter"
                className="text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 min-w-0"
              >
                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500 flex-shrink-0" />
                <span className="truncate font-medium text-orange-600 dark:text-orange-400">Solo mostrar productos con stock bajo</span>
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
                className="border-primary/30 text-primary hover:bg-primary/5 min-h-[44px] w-full sm:w-auto flex-shrink-0"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Crear Orden ({lowStockCount})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de productos */}
      <Card className="border-none shadow-sm overflow-hidden bg-card ring-1 ring-border/50">
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
          ) : isSmoothLoading ? (
            <InventorySkeleton />
          ) : (
            <>
              {stockItems.length === 0 ? (
                <PremiumEmptyState
                  title={searchQuery || showLowStockOnly ? 'No se encontraron productos' : 'Inventario Vacío'}
                  description={searchQuery
                    ? 'Intenta ajustar tus términos de búsqueda o filtros.'
                    : 'Comienza agregando productos a tu inventario mediante el botón "Recibir Stock".'}
                  icon={Package}
                  action={!searchQuery ? {
                    label: 'Agregar Primer Producto',
                    onClick: () => setIsStockReceivedModalOpen(true)
                  } : undefined}
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table className="w-full sm:table-fixed">
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30 border-b-muted/60">
                        <TableHead className="w-[50%] sm:w-[45%] font-semibold pl-4">Producto</TableHead>
                        <TableHead className="text-center font-semibold">Stock Actual</TableHead>
                        <TableHead className="text-center hidden sm:table-cell font-semibold">Mínimo</TableHead>
                        <TableHead className="text-center hidden md:table-cell font-semibold">Estado</TableHead>
                        <TableHead className="text-right w-32 sm:w-40 font-semibold pr-4"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockItems.map((item) => {
                        const stockPercentage = getStockPercentage(item)
                        const isLowStock = item.is_low_stock
                        const initial = item.product_name.charAt(0).toUpperCase()

                        return (
                          <TableRow
                            key={item.product_id}
                            className={cn(
                              'transition-colors hover:bg-muted/40 border-b-muted/40 group',
                              isLowStock && 'bg-orange-500/5 hover:bg-orange-500/10'
                            )}
                          >
                            <TableCell className="align-middle w-[50%] sm:w-[45%] py-3 pl-4">
                              <div className="flex items-center gap-3 min-w-0">
                                {/* Avatar del producto */}
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm shrink-0 ring-2 ring-background",
                                  isLowStock
                                    ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                    : "bg-primary/10 text-primary"
                                )}>
                                  {initial}
                                </div>

                                <div className="flex-1 min-w-0 max-w-full">
                                  <p
                                    className="font-bold text-foreground text-sm sm:text-base break-words leading-tight group-hover:text-primary transition-colors"
                                    title={item.product_name}
                                  >
                                    {item.product_name}
                                  </p>
                                  {isLowStock && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                        Stock Crítico
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center py-3">
                              <div className="space-y-1.5 flex flex-col items-center">
                                <span
                                  className={cn(
                                    'text-base sm:text-lg font-bold block tabular-nums',
                                    isLowStock ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'
                                  )}
                                >
                                  {formatStockValue(item, item.current_stock)}
                                </span>
                                {/* Indicador de progreso visual */}
                                <div className="w-20 sm:w-24 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                  <div
                                    className={cn("h-full rounded-full transition-all duration-500", isLowStock ? "bg-orange-500" : "bg-blue-500")}
                                    style={{ width: `${stockPercentage}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm text-muted-foreground hidden sm:table-cell tabular-nums">
                              {formatStockValue(item, item.low_stock_threshold)}
                            </TableCell>
                            <TableCell className="text-center hidden md:table-cell">
                              {isLowStock ? (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium px-2.5 py-0.5 rounded-full"
                                >
                                  Bajo
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium px-2.5 py-0.5 rounded-full"
                                >
                                  Normal
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="w-32 sm:w-40 py-3 text-right pr-4">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 sm:opacity-100">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewMovements(item)}
                                  className="h-8 w-8 hover:bg-muted text-muted-foreground rounded-full"
                                  title="Ver movimientos"
                                  aria-label={`Ver movimientos de ${item.product_name}`}
                                >
                                  <History className="w-4 h-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleReceiveStock(item)}
                                  className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 rounded-full"
                                  title="Recibir stock"
                                  aria-label={`Recibir stock de ${item.product_name}`}
                                >
                                  <TrendingUp className="w-4 h-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleAdjustStock(item)}
                                  className="h-8 w-8 text-purple-500 hover:text-purple-600 hover:bg-purple-500/10 rounded-full"
                                  title="Ajustar stock"
                                  aria-label={`Ajustar stock de ${item.product_name}`}
                                >
                                  <TrendingDown className="w-4 h-4" />
                                </Button>
                                {/* Solo owners pueden vaciar stock de un producto */}
                                {isOwner && item.current_stock > 0 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleResetProductStock(item)}
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                                    title="Vaciar stock"
                                    aria-label={`Vaciar stock de ${item.product_name}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
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
            </>
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
        warehouseId={warehouseFilter !== 'all' ? warehouseFilter : undefined}
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
              <p className="text-sm text-destructive dark:text-red-400 font-medium">
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
                Para confirmar, escribe <code className="text-destructive dark:text-red-400 font-bold">VACIAR TODO</code>
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
