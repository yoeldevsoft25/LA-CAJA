import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Edit, Trash2, Package, CheckCircle, DollarSign, Layers, Boxes, Hash, Upload, AlertTriangle, LayoutGrid, LayoutList, Download, Copy, MoreHorizontal, AlertCircle } from 'lucide-react'
import { productsService, Product } from '@la-caja/app-core'
import { warehousesService } from '@/services/warehouses.service'
import { useAuth } from '@/stores/auth.store'
import { useOnline } from '@/hooks/use-online'
import toast from '@/lib/toast'
// ⚡ OPTIMIZACIÓN: Lazy load del modal grande
const ProductFormModal = lazy(() => import('@/components/products/ProductFormModal'))
import ChangePriceModal from '@/components/products/ChangePriceModal'
// ⚡ OPTIMIZACIÓN: Lazy load de modales grandes
const BulkPriceChangeModal = lazy(() => import('@/components/products/BulkPriceChangeModal'))
const ProductVariantsModal = lazy(() => import('@/components/variants/ProductVariantsModal'))
const ProductLotsModal = lazy(() => import('@/components/lots/ProductLotsModal'))
const ProductSerialsModal = lazy(() => import('@/components/serials/ProductSerialsModal'))
const ImportCSVModal = lazy(() => import('@/components/products/ImportCSVModal'))
const CleanDuplicatesModal = lazy(() => import('@/components/products/CleanDuplicatesModal'))
import ProductCard from '@/components/products/ProductCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { inventoryService, StockStatus } from '@/services/inventory.service'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh-indicator'
import { useDebounce } from '@/hooks/use-debounce'
import { useMobileDetection } from '@/hooks/use-mobile-detection'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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

const formatStockValue = (product: Product, item?: StockStatus) => {
  const isWeight =
    item?.is_weight_product ?? product.is_weight_product ?? false
  if (!isWeight) return `${item?.current_stock ?? 0}`
  const unit = (item?.weight_unit || product.weight_unit || 'kg') as WeightUnit
  const value = item?.current_stock ?? 0
  const kgValue = value * WEIGHT_UNIT_TO_KG[unit]
  return `${formatKg(kgValue)} kg`
}

const getCategoryColor = (category: string): [string, string, string] => {
  const colorPalette: Array<[string, string, string]> = [
    ['bg-blue-500/10', 'text-blue-500 dark:text-blue-400', 'border-blue-500/20'],
    ['bg-green-500/10', 'text-green-500 dark:text-green-400', 'border-green-500/20'],
    ['bg-purple-500/10', 'text-purple-500 dark:text-purple-400', 'border-purple-500/20'],
    ['bg-orange-500/10', 'text-orange-500 dark:text-orange-400', 'border-orange-500/20'],
    ['bg-pink-500/10', 'text-pink-500 dark:text-pink-400', 'border-pink-500/20'],
    ['bg-cyan-500/10', 'text-cyan-500 dark:text-cyan-400', 'border-cyan-500/20'],
    ['bg-amber-500/10', 'text-amber-500 dark:text-amber-400', 'border-amber-500/20'],
    ['bg-indigo-500/10', 'text-indigo-500 dark:text-indigo-400', 'border-indigo-500/20'],
    ['bg-teal-500/10', 'text-teal-500 dark:text-teal-400', 'border-teal-500/20'],
    ['bg-rose-500/10', 'text-rose-500 dark:text-rose-400', 'border-rose-500/20'],
    ['bg-violet-500/10', 'text-violet-500 dark:text-violet-400', 'border-violet-500/20'],
    ['bg-emerald-500/10', 'text-emerald-500 dark:text-emerald-400', 'border-emerald-500/20'],
  ]

  let hash = 0
  for (let i = 0; i < category.length; i++) {
    hash = ((hash << 5) - hash) + category.charCodeAt(i)
    hash = hash & hash
  }

  const index = Math.abs(hash) % colorPalette.length
  return colorPalette[index]
}

export default function ProductsPage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [publicOnly, setPublicOnly] = useState(false)
  const [productTypeFilter, setProductTypeFilter] = useState<'all' | 'sale_item' | 'ingredient' | 'prepared'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [duplicatingProduct, setDuplicatingProduct] = useState<Product | null>(null)
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false)
  const [priceProduct, setPriceProduct] = useState<Product | null>(null)
  const [isBulkPriceModalOpen, setIsBulkPriceModalOpen] = useState(false)
  const [isImportCSVOpen, setIsImportCSVOpen] = useState(false)
  const [isCleanDuplicatesOpen, setIsCleanDuplicatesOpen] = useState(false)
  const [variantsProduct, setVariantsProduct] = useState<Product | null>(null)
  const [lotsProduct, setLotsProduct] = useState<Product | null>(null)
  const [serialsProduct, setSerialsProduct] = useState<Product | null>(null)
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all')
  const [editingPriceProductId, setEditingPriceProductId] = useState<string | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState<string>('')
  const isMobile = useMobileDetection()
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() =>
    window.innerWidth < 640 ? 'cards' : 'table'
  )
  const queryClient = useQueryClient()

  useEffect(() => {
    if (isMobile) {
      setViewMode('cards')
    }
  }, [isMobile])

  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Cache offline persistente ya no se maneja manualmente con useEffect,
  // useQuery lo hace de forma más eficiente.
  const { isOnline } = useOnline()

  const { data: lowStockCountData } = useQuery({
    queryKey: ['inventory', 'low-stock-count', user?.store_id],
    queryFn: () =>
      inventoryService.getStockStatusPaged({
        low_stock_only: true,
        limit: 1,
        offset: 0,
      }),
    enabled: !!user?.store_id,
    staleTime: 1000 * 60 * 10,
  })

  const isActiveFilter =
    statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined
  const isVisiblePublicFilter = publicOnly ? true : undefined
  const productTypeValue = productTypeFilter === 'all' ? undefined : productTypeFilter
  const offset = (currentPage - 1) * pageSize

  // Stock status actual
  const { data: stockStatusData } = useQuery({
    queryKey: [
      'inventory',
      'status',
      user?.store_id,
      warehouseFilter,
      searchQuery,
      categoryFilter,
      statusFilter,
      currentPage,
      pageSize,
    ],
    queryFn: () =>
      inventoryService.getStockStatusPaged({
        warehouse_id: warehouseFilter !== 'all' ? warehouseFilter : undefined,
        search: searchQuery || undefined,
        category: categoryFilter || undefined,
        is_active: isActiveFilter,
        is_visible_public: isVisiblePublicFilter,
        product_type: productTypeValue,
        limit: pageSize,
        offset,
      }),
    enabled: !!user?.store_id && isOnline,
    staleTime: 1000 * 60 * 5,
    gcTime: Infinity,
  })

  const stockByProduct = useMemo(
    () =>
      (stockStatusData?.items || []).reduce<Record<string, StockStatus>>(
        (acc, item) => {
          acc[item.product_id] = item
          return acc
        },
        {}
      ),
    [stockStatusData?.items]
  )

  // PERF: Se eliminó useEffect de productsCacheService.getProductsFromCache redundante

  const { data: productsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['products', 'list', debouncedSearchQuery, categoryFilter, statusFilter, publicOnly, productTypeFilter, currentPage, pageSize, user?.store_id],
    queryFn: () =>
      productsService.search({
        q: debouncedSearchQuery || undefined,
        category: categoryFilter || undefined,
        is_active: isActiveFilter,
        is_visible_public: isVisiblePublicFilter,
        product_type: productTypeValue,
        limit: pageSize,
        offset: offset,
      }, user?.store_id),
    enabled: !!user?.store_id && isOnline,
    staleTime: 1000 * 60 * 5,
    gcTime: Infinity,
    retry: false,
    initialData: undefined,
    placeholderData: undefined,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(),
    enabled: !!user?.store_id,
    staleTime: 1000 * 60 * 30, // 30 minutos
    gcTime: Infinity,
  })

  const products = productsData?.products || []
  const total = productsData?.total || 0
  const isOfflineEmpty = !isOnline && products.length === 0
  const lowStockCount = lowStockCountData?.total || 0

  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      await refetch()
    },
    enabled: true,
    threshold: 80,
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => productsService.deactivate(id, user?.store_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', 'list'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'status'], exact: false })
      toast.success('Producto desactivado exitosamente')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al desactivar el producto'
      toast.error(message)
    },
  })

  const activateMutation = useMutation({
    mutationFn: (id: string) => productsService.activate(id, user?.store_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', 'list'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'status'], exact: false })
      toast.success('Producto activado exitosamente')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al activar el producto'
      toast.error(message)
    },
  })

  const inlinePriceMutation = useMutation({
    mutationFn: ({ productId, priceUsd }: { productId: string; priceUsd: number }) =>
      productsService.changePrice(productId, {
        price_usd: priceUsd,
        price_bs: 0,
      }, user?.store_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', 'list'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'status', user?.store_id], exact: false })
      toast.success('Precio actualizado exitosamente')
      setEditingPriceProductId(null)
      setEditingPriceValue('')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al actualizar el precio'
      toast.error(message)
      setEditingPriceProductId(null)
      setEditingPriceValue('')
    },
  })

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setDuplicatingProduct(null)
    setIsFormOpen(true)
  }

  const handleCreate = () => {
    setEditingProduct(null)
    setDuplicatingProduct(null)
    setIsFormOpen(true)
  }

  const handleDuplicate = (product: Product) => {
    const duplicated: Product = {
      ...product,
      id: '',
      name: `${product.name} (Copia)`,
      sku: '',
      barcode: '',
    }
    setDuplicatingProduct(duplicated)
    setEditingProduct(null)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingProduct(null)
    setDuplicatingProduct(null)
  }

  const handleDeactivate = (product: Product) => {
    if (window.confirm(`¿Estás seguro de desactivar "${product.name}"?`)) {
      deactivateMutation.mutate(product.id)
    }
  }

  const handleActivate = (product: Product) => {
    if (window.confirm(`¿Estás seguro de activar "${product.name}"?`)) {
      activateMutation.mutate(product.id)
    }
  }

  const handleChangePrice = (product: Product) => {
    setPriceProduct(product)
    setIsPriceModalOpen(true)
  }

  const handleStartInlinePriceEdit = (product: Product) => {
    setEditingPriceProductId(product.id)
    setEditingPriceValue(Number(product.price_usd).toFixed(2))
  }

  const handleSaveInlinePrice = (productId: string) => {
    const parsed = parseFloat(editingPriceValue)
    if (isNaN(parsed) || parsed < 0) {
      toast.error('El precio debe ser un número válido mayor o igual a 0')
      setEditingPriceProductId(null)
      setEditingPriceValue('')
      return
    }
    inlinePriceMutation.mutate({ productId, priceUsd: parsed })
  }

  const handleCancelInlinePriceEdit = () => {
    setEditingPriceProductId(null)
    setEditingPriceValue('')
  }

  const handleManageVariants = (product: Product) => {
    setVariantsProduct(product)
  }

  const handleManageLots = (product: Product) => {
    setLotsProduct(product)
  }

  const handleManageSerials = (product: Product) => {
    setSerialsProduct(product)
  }

  const handleExportProducts = async () => {
    try {
      toast.loading('Exportando productos...', { id: 'export-products' })
      const firstPage = await productsService.search({
        q: searchQuery || undefined,
        category: categoryFilter || undefined,
        is_active: isActiveFilter,
        is_visible_public: isVisiblePublicFilter,
        product_type: productTypeValue,
        limit: 1,
        offset: 0,
      }, user?.store_id)

      const totalProducts = firstPage.total || 0
      if (totalProducts === 0) {
        toast.error('No hay productos para exportar', { id: 'export-products' })
        return
      }

      let allProducts: Product[] = []
      if (totalProducts <= 5000) {
        const allProductsData = await productsService.search({
          q: searchQuery || undefined,
          category: categoryFilter || undefined,
          is_active: isActiveFilter,
          is_visible_public: isVisiblePublicFilter,
          product_type: productTypeValue,
          limit: totalProducts + 100,
          offset: 0,
        }, user?.store_id)
        allProducts = allProductsData.products || []
      } else {
        const batchSize = 1000
        const batches = Math.ceil(totalProducts / batchSize)
        for (let i = 0; i < batches; i++) {
          const batchData = await productsService.search({
            q: searchQuery || undefined,
            category: categoryFilter || undefined,
            is_active: isActiveFilter,
            is_visible_public: isVisiblePublicFilter,
            product_type: productTypeValue,
            limit: batchSize,
            offset: i * batchSize,
          }, user?.store_id)
          allProducts = [...allProducts, ...(batchData.products || [])]
          toast.loading(`Exportando productos... ${Math.min((i + 1) * batchSize, totalProducts)}/${totalProducts}`, { id: 'export-products' })
        }
      }

      if (allProducts.length === 0) {
        toast.error('No se pudieron obtener los productos para exportar', { id: 'export-products' })
        return
      }

      const stockStatusForExport = await inventoryService.getStockStatus({
        warehouse_id: warehouseFilter !== 'all' ? warehouseFilter : undefined,
      })
      const stockByProductExport = (stockStatusForExport || []).reduce<Record<string, StockStatus>>((acc, item) => {
        acc[item.product_id] = item
        return acc
      }, {})

      const timestamp = new Date().toISOString().split('T')[0]
      const csvHeaders = 'nombre,categoria,sku,codigo_barras,precio_bs,precio_usd,costo_bs,costo_usd,stock_minimo'

      const csvRows = allProducts.map((p) => {
        const escapeCSVValue = (val: string | number): string => {
          const str = String(val)
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        }

        const nombre = escapeCSVValue(p.name || '')
        const categoria = escapeCSVValue(p.category || '')
        const sku = escapeCSVValue(p.sku || '')
        const codigo_barras = escapeCSVValue(p.barcode || '')
        const precio_bs = Number(p.price_bs || 0).toFixed(2)
        const precio_usd = Number(p.price_usd || 0).toFixed(2)
        const costo_bs = p.cost_bs ? Number(p.cost_bs).toFixed(2) : '0.00'
        const costo_usd = p.cost_usd ? Number(p.cost_usd).toFixed(2) : '0.00'
        const stock_minimo = String(stockByProductExport[p.id]?.low_stock_threshold ?? p.low_stock_threshold ?? 10)

        return [nombre, categoria, sku, codigo_barras, precio_bs, precio_usd, costo_bs, costo_usd, stock_minimo].join(',')
      })

      const csvContent = [csvHeaders, ...csvRows].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `Productos_${timestamp}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`${allProducts.length} productos exportados a Excel`, { id: 'export-products' })
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al exportar productos', { id: 'export-products' })
    }
  }

  return (
    <div className="h-full max-w-7xl mx-auto overflow-y-auto p-4 pb-20" data-pull-to-refresh>
      <PullToRefreshIndicator
        isPulling={pullToRefresh.isPulling}
        isRefreshing={pullToRefresh.isRefreshing}
        pullDistance={pullToRefresh.pullDistance}
        threshold={80}
      />

      {/* KPI Cards: Minimalist Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card className="premium-shadow border-none bg-card/50 backdrop-blur-sm overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute right-0 top-0 h-32 w-32 bg-primary/5 rounded-full blur-3xl transform translate-x-10 -translate-y-10" />
          <CardContent className="p-6 flex flex-col justify-center relative z-10">
            <div className="flex items-center justify-between space-x-2">
              <span className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Total Productos</span>
              <div className="p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors shadow-sm">
                <Package className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tighter text-foreground">{total}</span>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Registrados</span>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-shadow border-none bg-card/50 backdrop-blur-sm overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute right-0 top-0 h-32 w-32 bg-orange-500/5 rounded-full blur-3xl transform translate-x-10 -translate-y-10" />
          <CardContent className="p-6 flex flex-col justify-center relative z-10">
            <div className="flex items-center justify-between space-x-2">
              <span className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Alertas de Stock</span>
              <div className="p-2.5 bg-orange-500/10 rounded-xl group-hover:bg-orange-500/20 transition-colors shadow-sm">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tighter text-foreground">{lowStockCount}</span>
              <span className={cn(
                "text-xs font-bold px-2 py-0.5 rounded-lg uppercase tracking-widest",
                lowStockCount > 0
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                  : "bg-muted text-muted-foreground"
              )}>
                {lowStockCount > 0 ? 'Requieren Atención' : 'Todo en Orden'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Gestión de Productos</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Opciones Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-auto px-3 gap-2 bg-background/50 backdrop-blur-sm">
                <MoreHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Opciones</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Acciones Masivas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportProducts}>
                <Download className="w-4 h-4 mr-2" /> Exportar Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsImportCSVOpen(true)}>
                <Upload className="w-4 h-4 mr-2" /> Importar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsCleanDuplicatesOpen(true)}>
                <Trash2 className="w-4 h-4 mr-2" /> Limpiar Duplicados
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsBulkPriceModalOpen(true)}>
                <DollarSign className="w-4 h-4 mr-2" /> Cambio Masivo Precios
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={handleCreate}
            variant="default"
            className="shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all font-semibold"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Filtros Flotantes */}
      <Card className="mb-6 border-none shadow-lg shadow-black/5 bg-background/95 backdrop-blur-md sticky top-0 z-50 transition-all duration-300">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/60 w-5 h-5 z-10" />
            <Input
              type="text"
              placeholder="Buscar por nombre, SKU o código de barras..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 h-11 sm:h-12 text-base border-muted/40 bg-muted/50 focus:bg-background transition-all shadow-sm focus:ring-primary/20"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:max-w-xs">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Categoría</Label>
              <Input
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="mt-1 border-muted/40 bg-muted/50"
                placeholder="Todas"
              />
            </div>
            <div className="w-full sm:max-w-xs">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Estado</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as 'all' | 'active' | 'inactive')
                }
              >
                <SelectTrigger className="mt-1 border-muted/40 bg-muted/50">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:max-w-xs">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Tipo</Label>
              <Select
                value={productTypeFilter}
                onValueChange={(value) =>
                  setProductTypeFilter(value as 'all' | 'sale_item' | 'ingredient' | 'prepared')
                }
              >
                <SelectTrigger className="mt-1 border-muted/40 bg-muted/50">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sale_item">Producto de venta</SelectItem>
                  <SelectItem value="prepared">Plato elaborado</SelectItem>
                  <SelectItem value="ingredient">Ingrediente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:max-w-sm">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Catálogo público</Label>
              <div className="mt-1 flex items-center justify-between rounded-md border border-muted/40 bg-muted/50 px-3 py-2">
                <span className="text-sm text-muted-foreground">
                  Solo visibles
                </span>
                <Switch
                  checked={publicOnly}
                  onCheckedChange={setPublicOnly}
                />
              </div>
            </div>
            {warehouses.length > 0 && (
              <div className="w-full sm:max-w-sm">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Stock por bodega</Label>
                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                  <SelectTrigger className="mt-1 border-muted/40 bg-muted/50 dark:bg-muted/20">
                    <SelectValue placeholder="Todas las bodegas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las bodegas</SelectItem>
                    {warehouses.filter((w) => w.is_active).map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} {w.is_default ? '(Por defecto)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="hidden sm:flex items-end flex-1 justify-end">
              <Tabs
                value={viewMode}
                onValueChange={(v) => setViewMode(v as 'cards' | 'table')}
                className="w-auto"
              >
                <TabsList className="h-10 bg-muted/40">
                  <TabsTrigger value="cards" className="px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <LayoutGrid className="w-4 h-4" />
                    <span className="hidden sm:inline">Cards</span>
                  </TabsTrigger>
                  <TabsTrigger value="table" className="px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <LayoutList className="w-4 h-4" />
                    <span className="hidden sm:inline">Tabla</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de productos */}
      <Card className="border-none premium-shadow overflow-hidden bg-background/50 backdrop-blur-sm ring-1 ring-border/50">
        <CardContent className="p-0">
          {isError ? (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center justify-center">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-destructive dark:text-red-400" />
                <p className="text-muted-foreground">Error al cargar productos</p>
                <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                  Reintentar
                </Button>
              </div>
            </div>
          ) : isLoading ? (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center justify-center">
                <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30 animate-bounce" />
                <p className="text-muted-foreground">Cargando productos...</p>
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="p-16 text-center">
              <div className="flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                  <Package className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {isOfflineEmpty ? 'Sin conexión' : searchQuery ? 'No encontrado' : 'Inventario Vacío'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
                  {isOfflineEmpty ? 'Conéctate para ver tus productos.' : searchQuery ? 'Intenta con otro término.' : 'Crea tu primer producto ahora.'}
                </p>
                {!searchQuery && !isOfflineEmpty && (
                  <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" /> Crear Producto
                  </Button>
                )}
              </div>
            </div>
          ) : viewMode === 'cards' || isMobile ? (
            <div className="p-4 bg-transparent">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    stock={stockByProduct[product.id]}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onChangePrice={handleChangePrice}
                    onManageVariants={handleManageVariants}
                    onManageLots={handleManageLots}
                    onManageSerials={handleManageSerials}
                    onDeactivate={handleDeactivate}
                    onActivate={handleActivate}
                    isDeactivating={deactivateMutation.isPending}
                    isActivating={activateMutation.isPending}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full sm:table-fixed">
                <thead className="bg-muted/30">
                  <tr className="border-b border-border/60">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[45%] sm:w-[40%] pl-6">
                      Producto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                      Categoría
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28 sm:w-32">
                      Precio
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                      Stock
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider w-40 pr-6">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {products.map((product) => {
                    const initial = product.name.charAt(0).toUpperCase()
                    const stockItem = stockByProduct[product.id]
                    const isLowStock = stockItem?.is_low_stock

                    return (
                      <tr
                        key={product.id}
                        className={cn(
                          "hover:bg-muted/40 transition-colors group",
                          !product.is_active && 'opacity-60 bg-muted/20'
                        )}
                      >
                        <td className="px-4 py-3 align-middle w-[45%] sm:w-[40%] pl-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-background shrink-0">
                              {initial}
                            </div>
                            <div className="min-w-0 max-w-full">
                              <p
                                className="font-semibold text-foreground text-sm sm:text-base break-words leading-snug"
                                title={product.name}
                              >
                                {product.name}
                              </p>
                              {product.barcode && (
                                <p className="text-xs text-muted-foreground mt-0.5 font-mono bg-muted/50 inline-block px-1 rounded">
                                  {product.barcode}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm hidden sm:table-cell">
                          {product.category ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                ...getCategoryColor(product.category),
                                "border font-medium text-xs px-2 py-0.5 rounded-full"
                              )}
                            >
                              {product.category}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell font-mono">
                          {product.sku || '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editingPriceProductId === product.id ? (
                            <div className="flex items-center gap-2 justify-end">
                              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded border p-1 shadow-sm">
                                <span className="text-sm text-muted-foreground px-1">$</span>
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  min={0}
                                  value={editingPriceValue}
                                  onChange={(e) => setEditingPriceValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveInlinePrice(product.id)
                                    else if (e.key === 'Escape') handleCancelInlinePriceEdit()
                                  }}
                                  onBlur={() => handleSaveInlinePrice(product.id)}
                                  className="h-7 w-20 text-sm text-right border-none focus-visible:ring-0 p-0"
                                  autoFocus
                                  disabled={inlinePriceMutation.isPending}
                                />
                              </div>
                            </div>
                          ) : (
                            <div
                              className="group/price cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-all text-right"
                              onDoubleClick={() => handleStartInlinePriceEdit(product)}
                              title="Doble clic para editar precio"
                            >
                              <p className="font-bold text-foreground tabular-nums">
                                ${Number(product.price_usd).toFixed(2)}
                              </p>
                              <p className="text-[11px] text-muted-foreground tabular-nums">Bs. {Number(product.price_bs).toFixed(2)}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center hidden sm:table-cell">
                          {stockItem ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className={cn(
                                "text-sm font-bold tabular-nums",
                                isLowStock ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"
                              )}>
                                {formatStockValue(product, stockItem)}
                              </span>
                              {isLowStock && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">
                                  Bajo
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {product.is_active ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 mx-auto ring-4 ring-green-500/20" title="Activo" />
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 pr-6">
                          <div className="flex items-center justify-end space-x-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleManageVariants(product)}
                              className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:hover:bg-slate-800 rounded-full"
                              title="Gestionar Variantes"
                            >
                              <Layers className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleChangePrice(product)}
                              className="h-8 w-8 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 rounded-full"
                              title="Cambiar Precio"
                            >
                              <DollarSign className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(product)}
                              className="h-8 w-8 text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:bg-sky-500/10 rounded-full"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleDuplicate(product)}>
                                  <Copy className="w-4 h-4 mr-2" /> Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleManageLots(product)}>
                                  <Boxes className="w-4 h-4 mr-2" /> Lotes
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleManageSerials(product)}>
                                  <Hash className="w-4 h-4 mr-2" /> Seriales
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {product.is_active ? (
                                  <DropdownMenuItem onClick={() => handleDeactivate(product)} className="text-destructive dark:text-red-400 focus:text-destructive">
                                    <Trash2 className="w-4 h-4 mr-2" /> Desactivar
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleActivate(product)} className="text-emerald-600 dark:text-emerald-400 focus:text-emerald-600">
                                    <CheckCircle className="w-4 h-4 mr-2" /> Activar
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginación */}
      {products.length > 0 && total > pageSize && (
        <div className="mt-4 flex items-center justify-between px-4">
          <div className="text-sm text-muted-foreground">
            Mostrando {offset + 1} - {Math.min(offset + pageSize, total)} de {total} productos
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage >= Math.ceil(total / pageSize)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Modales */}
      {isFormOpen && (
        <Suspense fallback={<div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
          <ProductFormModal
            isOpen={isFormOpen}
            onClose={handleCloseForm}
            product={editingProduct}
            templateProduct={duplicatingProduct}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['products'] })
              queryClient.invalidateQueries({ queryKey: ['inventory', 'status'] })
              queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-status'] })
              handleCloseForm()
            }}
          />
        </Suspense>
      )}

      <ChangePriceModal
        isOpen={isPriceModalOpen}
        onClose={() => {
          setIsPriceModalOpen(false)
          setPriceProduct(null)
        }}
        product={priceProduct}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products'] })
          queryClient.invalidateQueries({ queryKey: ['inventory', 'status'] })
          setIsPriceModalOpen(false)
          setPriceProduct(null)
        }}
      />

      {isBulkPriceModalOpen && (
        <Suspense fallback={<div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
          <BulkPriceChangeModal
            isOpen={isBulkPriceModalOpen}
            onClose={() => setIsBulkPriceModalOpen(false)}
            products={products}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['products'] })
              queryClient.invalidateQueries({ queryKey: ['inventory', 'status'] })
            }}
          />
        </Suspense>
      )}

      {variantsProduct && (
        <Suspense fallback={null}>
          <ProductVariantsModal
            isOpen={!!variantsProduct}
            onClose={() => setVariantsProduct(null)}
            product={variantsProduct}
          />
        </Suspense>
      )}

      {lotsProduct && (
        <Suspense fallback={null}>
          <ProductLotsModal
            isOpen={!!lotsProduct}
            onClose={() => setLotsProduct(null)}
            product={lotsProduct}
          />
        </Suspense>
      )}

      {serialsProduct && (
        <Suspense fallback={null}>
          <ProductSerialsModal
            isOpen={!!serialsProduct}
            onClose={() => setSerialsProduct(null)}
            product={serialsProduct}
          />
        </Suspense>
      )}

      {isImportCSVOpen && (
        <Suspense fallback={null}>
          <ImportCSVModal
            isOpen={isImportCSVOpen}
            onClose={() => setIsImportCSVOpen(false)}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['products'] })}
          />
        </Suspense>
      )}

      {isCleanDuplicatesOpen && (
        <Suspense fallback={null}>
          <CleanDuplicatesModal
            isOpen={isCleanDuplicatesOpen}
            onClose={() => setIsCleanDuplicatesOpen(false)}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['products'] })}
          />
        </Suspense>
      )}
    </div>
  )
}
