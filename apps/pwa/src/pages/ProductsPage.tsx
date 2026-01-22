import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Edit, Trash2, Package, CheckCircle, DollarSign, Layers, Boxes, Hash, Upload, AlertTriangle, LayoutGrid, LayoutList, Download, Copy } from 'lucide-react'
import { productsService, Product, ProductSearchResponse } from '@/services/products.service'
import { productsCacheService } from '@/services/products-cache.service'
import { warehousesService } from '@/services/warehouses.service'
import { useAuth } from '@/stores/auth.store'
import { useOnline } from '@/hooks/use-online'
import toast from '@/lib/toast'
import ProductFormModal from '@/components/products/ProductFormModal'
import ChangePriceModal from '@/components/products/ChangePriceModal'
import BulkPriceChangeModal from '@/components/products/BulkPriceChangeModal'
import ProductVariantsModal from '@/components/variants/ProductVariantsModal'
import ProductLotsModal from '@/components/lots/ProductLotsModal'
import ProductSerialsModal from '@/components/serials/ProductSerialsModal'
import ImportCSVModal from '@/components/products/ImportCSVModal'
import CleanDuplicatesModal from '@/components/products/CleanDuplicatesModal'
import ProductCard from '@/components/products/ProductCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { inventoryService, StockStatus } from '@/services/inventory.service'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh'
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh-indicator'
import { useMobileDetection } from '@/hooks/use-mobile-detection'
import { cn } from '@/lib/utils'

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

/**
 * Genera un color consistente para una categoría usando hash
 * Retorna una tupla [bgColor, textColor, borderColor]
 */
const getCategoryColor = (category: string): [string, string, string] => {
  // Paleta de colores predefinida para mejor contraste y accesibilidad
  const colorPalette: Array<[string, string, string]> = [
    ['bg-blue-100', 'text-blue-700', 'border-blue-300'], // Azul
    ['bg-green-100', 'text-green-700', 'border-green-300'], // Verde
    ['bg-purple-100', 'text-purple-700', 'border-purple-300'], // Púrpura
    ['bg-orange-100', 'text-orange-700', 'border-orange-300'], // Naranja
    ['bg-pink-100', 'text-pink-700', 'border-pink-300'], // Rosa
    ['bg-cyan-100', 'text-cyan-700', 'border-cyan-300'], // Cian
    ['bg-amber-100', 'text-amber-700', 'border-amber-300'], // Ámbar
    ['bg-indigo-100', 'text-indigo-700', 'border-indigo-300'], // Índigo
    ['bg-teal-100', 'text-teal-700', 'border-teal-300'], // Verde azulado
    ['bg-rose-100', 'text-rose-700', 'border-rose-300'], // Rosa oscuro
    ['bg-violet-100', 'text-violet-700', 'border-violet-300'], // Violeta
    ['bg-emerald-100', 'text-emerald-700', 'border-emerald-300'], // Esmeralda
  ]

  // Genera un hash simple del nombre de categoría
  let hash = 0
  for (let i = 0; i < category.length; i++) {
    hash = ((hash << 5) - hash) + category.charCodeAt(i)
    hash = hash & hash // Convierte a entero de 32 bits
  }

  // Usa el hash para seleccionar un color de la paleta
  const index = Math.abs(hash) % colorPalette.length
  return colorPalette[index]
}

export default function ProductsPage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50) // 50 productos por página
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
  // Estado para edición inline de precios
  const [editingPriceProductId, setEditingPriceProductId] = useState<string | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState<string>('')
  const isMobile = useMobileDetection()
  // Vista: 'cards' para móvil, 'table' para desktop
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => 
    window.innerWidth < 640 ? 'cards' : 'table'
  )
  const queryClient = useQueryClient()

  // Actualizar viewMode cuando cambia el tamaño de pantalla
  useEffect(() => {
    if (isMobile) {
      setViewMode('cards')
    }
  }, [isMobile])

  // Reset page cuando cambia búsqueda
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, categoryFilter, statusFilter])

  // Cargar datos desde cache al iniciar (para mostrar inmediatamente)
  const [initialData, setInitialData] = useState<ProductSearchResponse | undefined>(undefined);
  const { isOnline } = useOnline(); // Usar hook más confiable
  const { data: stockStatus } = useQuery({
    queryKey: ['inventory', 'status', user?.store_id, warehouseFilter],
    queryFn: () =>
      inventoryService.getStockStatus({
        warehouse_id: warehouseFilter !== 'all' ? warehouseFilter : undefined,
      }),
    enabled: !!user?.store_id,
    staleTime: 1000 * 60 * 5,
  })
  const stockByProduct = (stockStatus || []).reduce<Record<string, StockStatus>>((acc, item) => {
    acc[item.product_id] = item
    return acc
  }, {})
  
  const isActiveFilter =
    statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined

  // Cargar desde IndexedDB al montar el componente o cuando cambia la búsqueda
  useEffect(() => {
    if (user?.store_id) {
      productsCacheService.getProductsFromCache(user.store_id, {
        search: searchQuery || undefined,
        category: categoryFilter || undefined,
        is_active: isActiveFilter,
        limit: pageSize, // Solo cargar una página del cache
      }).then(cached => {
        if (cached.length > 0) {
          setInitialData({
            products: cached,
            total: cached.length,
          });
        }
      }).catch(() => {
        // Silenciar errores
      });
    }
  }, [user?.store_id, searchQuery, categoryFilter, isActiveFilter, pageSize]);

  // Búsqueda de productos (con cache offline persistente y paginación)
  const offset = (currentPage - 1) * pageSize
  const { data: productsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['products', 'list', searchQuery, categoryFilter, statusFilter, currentPage, pageSize, user?.store_id],
    queryFn: () =>
      productsService.search({
        q: searchQuery || undefined,
        category: categoryFilter || undefined,
        is_active: isActiveFilter,
        limit: pageSize,
        offset: offset,
      }, user?.store_id),
    enabled: !!user?.store_id && isOnline, // Solo ejecutar query si está online
    // Configuración para persistencia offline
    staleTime: 1000 * 60 * 5, // 5 minutos - considerar datos frescos
    gcTime: Infinity, // Nunca eliminar del cache de React Query
    retry: false, // No reintentar si falla (usaremos cache)
    // Si está offline, usar cache como datos iniciales
    initialData: !isOnline ? initialData : undefined,
    // Si está offline, mantener cache como placeholder
    placeholderData: !isOnline ? initialData : undefined,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(),
    enabled: !!user?.store_id,
  })

  const products = productsData?.products || []
  const total = productsData?.total || 0
  const isOfflineEmpty = !isOnline && products.length === 0

  // Pull-to-refresh para móvil
  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      await refetch()
    },
    enabled: true,
    threshold: 80,
  })

  // Mutación para desactivar producto
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => productsService.deactivate(id, user?.store_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Producto desactivado exitosamente')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al desactivar el producto'
      toast.error(message)
    },
  })

  // Mutación para activar producto
  const activateMutation = useMutation({
    mutationFn: (id: string) => productsService.activate(id, user?.store_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Producto activado exitosamente')
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al activar el producto'
      toast.error(message)
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
    // Preparar producto duplicado: copiar todos los datos pero limpiar campos únicos
    const duplicated: Product = {
      ...product,
      id: '', // Sin ID para que se cree uno nuevo
      name: `${product.name} (Copia)`, // Agregar "(Copia)" al nombre
      sku: '', // Limpiar SKU (debe ser único)
      barcode: '', // Limpiar código de barras (debe ser único)
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

  // Mutación para edición inline de precios
  const inlinePriceMutation = useMutation({
    mutationFn: ({ productId, priceUsd }: { productId: string; priceUsd: number }) =>
      productsService.changePrice(productId, {
        price_usd: priceUsd,
        price_bs: 0, // El backend calculará el precio en Bs usando la tasa BCV
      }, user?.store_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'status'] })
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

  // Handler para iniciar edición inline
  const handleStartInlinePriceEdit = (product: Product) => {
    setEditingPriceProductId(product.id)
    setEditingPriceValue(Number(product.price_usd).toFixed(2))
  }

  // Handler para guardar precio inline
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

  // Handler para cancelar edición inline
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

  // Exportar productos a Excel - Obtiene TODOS los productos sin límite
  const handleExportProducts = async () => {
    try {
      toast.loading('Exportando productos...', { id: 'export-products' })
      
      // Obtener TODOS los productos sin límite, aplicando los mismos filtros
      // Primero obtenemos el total para saber cuántos productos hay
      const firstPage = await productsService.search({
        q: searchQuery || undefined,
        category: categoryFilter || undefined,
        is_active: isActiveFilter,
        limit: 1,
        offset: 0,
      }, user?.store_id)

      const totalProducts = firstPage.total || 0

      if (totalProducts === 0) {
        toast.error('No hay productos para exportar', { id: 'export-products' })
        return
      }

      // Obtener todos los productos en una sola petición
      // Si hay más de 5000 productos, obtenerlos en lotes para evitar problemas de memoria
      let allProducts: Product[] = []
      
      if (totalProducts <= 5000) {
        // Obtener todos de una vez si son menos de 5000
        const allProductsData = await productsService.search({
          q: searchQuery || undefined,
          category: categoryFilter || undefined,
          is_active: isActiveFilter,
          limit: totalProducts + 100, // Buffer por si acaso
          offset: 0,
        }, user?.store_id)
        allProducts = allProductsData.products || []
      } else {
        // Obtener en lotes de 1000 si hay muchos productos
        const batchSize = 1000
        const batches = Math.ceil(totalProducts / batchSize)
        
        for (let i = 0; i < batches; i++) {
          const batchData = await productsService.search({
            q: searchQuery || undefined,
            category: categoryFilter || undefined,
            is_active: isActiveFilter,
            limit: batchSize,
            offset: i * batchSize,
          }, user?.store_id)
          
          allProducts = [...allProducts, ...(batchData.products || [])]
          
          // Actualizar toast con progreso
          toast.loading(`Exportando productos... ${Math.min((i + 1) * batchSize, totalProducts)}/${totalProducts}`, { id: 'export-products' })
        }
      }

      if (allProducts.length === 0) {
        toast.error('No se pudieron obtener los productos para exportar', { id: 'export-products' })
        return
      }

      // Obtener stock para todos los productos exportados
      const stockStatusForExport = await inventoryService.getStockStatus({
        warehouse_id: warehouseFilter !== 'all' ? warehouseFilter : undefined,
      })
      const stockByProductExport = (stockStatusForExport || []).reduce<Record<string, StockStatus>>((acc, item) => {
        acc[item.product_id] = item
        return acc
      }, {})

      const timestamp = new Date().toISOString().split('T')[0]

      // Exportar con los campos exactos que requiere la importación CSV
      // Orden: nombre, categoria, sku, codigo_barras, precio_bs, precio_usd, costo_bs, costo_usd, stock_minimo
      // IMPORTANTE: Los headers deben coincidir exactamente con los que espera la importación
      // Los headers requeridos son: nombre, precio_bs, precio_usd
      const csvHeaders = 'nombre,categoria,sku,codigo_barras,precio_bs,precio_usd,costo_bs,costo_usd,stock_minimo'
      
      // Verificar que los headers incluyan los campos requeridos
      const requiredHeaders = ['nombre', 'precio_bs', 'precio_usd']
      const headerArray = csvHeaders.split(',')
      const missingInHeaders = requiredHeaders.filter(h => !headerArray.includes(h))
      if (missingInHeaders.length > 0) {
        console.error('ERROR: Headers faltantes en CSV:', missingInHeaders)
        toast.error(`Error al generar CSV: faltan headers ${missingInHeaders.join(', ')}`, { id: 'export-products' })
        return
      }
      
      const csvRows = allProducts.map((p) => {
        // Función para escapar valores CSV
        const escapeCSVValue = (val: string | number): string => {
          const str = String(val)
          // Si contiene coma, comilla o salto de línea, envolver en comillas
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        }
        
        // Preparar valores asegurando que siempre tengan un valor válido
        const nombre = escapeCSVValue(p.name || '')
        const categoria = escapeCSVValue(p.category || '')
        const sku = escapeCSVValue(p.sku || '')
        const codigo_barras = escapeCSVValue(p.barcode || '')
        
        // Asegurar que los precios siempre tengan un valor numérico válido
        const precio_bs = Number(p.price_bs || 0).toFixed(2)
        const precio_usd = Number(p.price_usd || 0).toFixed(2)
        const costo_bs = p.cost_bs ? Number(p.cost_bs).toFixed(2) : '0.00'
        const costo_usd = p.cost_usd ? Number(p.cost_usd).toFixed(2) : '0.00'
        const stock_minimo = String(stockByProductExport[p.id]?.low_stock_threshold ?? p.low_stock_threshold ?? 10)
        
        // Construir la fila CSV con todos los campos en el orden correcto
        return [
          nombre,
          categoria,
          sku,
          codigo_barras,
          precio_bs,  // precio_bs - REQUERIDO
          precio_usd, // precio_usd - REQUERIDO
          costo_bs,
          costo_usd,
          stock_minimo,
        ].join(',')
      })
      
      // Crear CSV sin BOM para evitar problemas de lectura
      const csvContent = [csvHeaders, ...csvRows].join('\n')
      
      // Crear blob y descargar
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
      console.error('[ProductsPage] Error exportando productos:', error)
      toast.error(error.response?.data?.message || 'Error al exportar productos', { id: 'export-products' })
    }
  }

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Indicador de pull-to-refresh */}
      <PullToRefreshIndicator
        isPulling={pullToRefresh.isPulling}
        isRefreshing={pullToRefresh.isRefreshing}
        pullDistance={pullToRefresh.pullDistance}
        threshold={80}
      />
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestión de Productos</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {total} {total === 1 ? 'producto' : 'productos'} encontrados
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleExportProducts}
              variant="outline"
              className="min-h-[44px]"
            >
              <Download className="w-5 h-5 mr-2" />
              Exportar Excel
            </Button>
            <Button
              onClick={() => setIsCleanDuplicatesOpen(true)}
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10 min-h-[44px]"
            >
              <Trash2 className="w-5 h-5 mr-2" />
              Limpiar Duplicados
            </Button>
            <Button
              onClick={() => setIsImportCSVOpen(true)}
              variant="outline"
              className="border-primary text-primary hover:bg-primary/10 min-h-[44px]"
            >
              <Upload className="w-5 h-5 mr-2" />
              Importar CSV
            </Button>
            <Button
              onClick={() => setIsBulkPriceModalOpen(true)}
              variant="default"
              className="bg-success hover:bg-success/90 min-h-[44px]"
            >
              <DollarSign className="w-5 h-5 mr-2" />
              Cambio Masivo
            </Button>
            <Button
              onClick={handleCreate}
              variant="default"
              className="min-h-[44px]"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nuevo Producto
            </Button>
          </div>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="mb-4 sm:mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 z-10" />
          <Input
            type="text"
            placeholder="Buscar por nombre, SKU o código de barras..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2.5 sm:py-3 text-base sm:text-lg"
            autoFocus
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:max-w-xs">
            <Label className="text-xs text-muted-foreground">Categoría</Label>
            <Input
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="mt-2"
              placeholder="Todas"
            />
          </div>
          <div className="w-full sm:max-w-xs">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as 'all' | 'active' | 'inactive')
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {warehouses.length > 0 && (
            <div className="w-full sm:max-w-sm">
              <Label className="text-xs text-muted-foreground">Stock por bodega</Label>
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
        </div>

        {/* Toggle de vista - Solo en desktop */}
        <div className="hidden sm:flex items-center justify-end">
          <Tabs
            value={viewMode}
            onValueChange={(v) => setViewMode(v as 'cards' | 'table')}
            className="w-auto"
          >
            <TabsList className="h-9">
              <TabsTrigger value="cards" className="px-3 gap-1.5">
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Cards</span>
              </TabsTrigger>
              <TabsTrigger value="table" className="px-3 gap-1.5">
                <LayoutList className="w-4 h-4" />
                <span className="hidden sm:inline">Tabla</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Lista de productos */}
      <Card className="border border-border overflow-hidden">
        <CardContent className="p-0">
        {isError ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center justify-center py-8">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-destructive" />
                <p className="text-muted-foreground">No se pudieron cargar los productos</p>
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
              <div className="flex flex-col items-center justify-center py-8">
                <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground animate-pulse" />
                <p className="text-muted-foreground">Cargando productos...</p>
              </div>
          </div>
        ) : products.length === 0 ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-foreground mb-1">
              {isOfflineEmpty
                ? 'Sin conexión'
                : searchQuery
                  ? 'No se encontraron productos'
                  : 'No hay productos registrados'}
            </p>
                <p className="text-sm text-muted-foreground">
              {isOfflineEmpty
                ? 'Conéctate para sincronizar o importa productos desde otro dispositivo'
                : searchQuery
                  ? 'Intenta con otro término de búsqueda'
                  : 'Haz clic en "Nuevo Producto" para comenzar'}
            </p>
              </div>
          </div>
        ) : viewMode === 'cards' || isMobile ? (
          /* Vista de Cards para móvil */
          <div className="p-4">
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
          /* Vista de Tabla para desktop */
            <div className="overflow-x-auto">
            <table className="w-full sm:table-fixed">
                <thead className="bg-muted/50">
                <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider w-[45%] sm:w-[40%]">
                    Producto
                  </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider hidden sm:table-cell">
                    Categoría
                  </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider hidden md:table-cell">
                    SKU
                  </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider w-28 sm:w-32">
                    Precio
                  </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-foreground uppercase tracking-wider hidden sm:table-cell">
                    Stock
                  </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-foreground uppercase tracking-wider w-24">
                    Estado
                  </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-foreground uppercase tracking-wider w-40">
                    Acciones
                  </th>
                </tr>
              </thead>
                <tbody className="bg-background divide-y divide-border">
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className={`hover:bg-accent/50 transition-colors ${
                      !product.is_active ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-4 py-3 align-top w-[45%] sm:w-[40%]">
                      <div className="min-w-0 max-w-full">
                        <p
                          className="font-semibold text-foreground text-sm sm:text-base break-words"
                          title={product.name}
                        >
                          {product.name}
                        </p>
                        {product.barcode && (
                          <p className="text-xs text-muted-foreground mt-0.5 break-words">
                            Código: {product.barcode}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm hidden sm:table-cell">
                      {product.category ? (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            ...getCategoryColor(product.category),
                            "border font-medium text-xs"
                          )}
                        >
                          {product.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                      {product.sku || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingPriceProductId === product.id ? (
                        <div className="flex items-center gap-2 justify-end">
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-muted-foreground">$</span>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min={0}
                              value={editingPriceValue}
                              onChange={(e) => setEditingPriceValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveInlinePrice(product.id)
                                } else if (e.key === 'Escape') {
                                  handleCancelInlinePriceEdit()
                                }
                              }}
                              onBlur={() => handleSaveInlinePrice(product.id)}
                              className="h-8 w-20 text-sm text-right"
                              autoFocus
                              disabled={inlinePriceMutation.isPending}
                            />
                          </div>
                          {inlinePriceMutation.isPending && (
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          )}
                        </div>
                      ) : (
                        <div 
                          className="text-sm sm:text-base cursor-pointer hover:bg-accent/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
                          onDoubleClick={() => handleStartInlinePriceEdit(product)}
                          title="Doble clic para editar precio"
                        >
                          <p className="font-semibold text-foreground">
                            ${Number(product.price_usd).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">Bs. {Number(product.price_bs).toFixed(2)}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      {stockByProduct[product.id] ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-semibold">
                            {formatStockValue(product, stockByProduct[product.id])}
                          </span>
                          {stockByProduct[product.id].is_low_stock && (
                            <Badge variant="destructive" className="text-[10px]">
                              Bajo
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {product.is_active ? (
                        <Badge variant="default" className="bg-success/10 text-success hover:bg-success/20">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Inactivo
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleManageVariants(product)}
                          className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                          title="Gestionar Variantes"
                        >
                          <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleManageLots(product)}
                          className="h-8 w-8 text-blue-600 hover:text-blue-600 hover:bg-blue-600/10"
                          title="Gestionar Lotes"
                        >
                          <Boxes className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleManageSerials(product)}
                          className="h-8 w-8 text-purple-600 hover:text-purple-600 hover:bg-purple-600/10"
                          title="Gestionar Seriales"
                        >
                          <Hash className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleChangePrice(product)}
                          className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                          title="Cambiar Precio"
                        >
                          <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicate(product)}
                          className="h-8 w-8 text-blue-600 hover:text-blue-600 hover:bg-blue-600/10"
                          title="Duplicar"
                          aria-label="Duplicar producto"
                        >
                          <Copy className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(product)}
                          className="h-8 w-8"
                          title="Editar"
                          aria-label="Editar producto"
                        >
                          <Edit className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                        </Button>
                        {product.is_active ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeactivate(product)}
                            disabled={deactivateMutation.isPending}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Desactivar"
                          >
                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleActivate(product)}
                            disabled={activateMutation.isPending}
                            className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                            title="Activar"
                          >
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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

      {/* Modal de formulario */}
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

      {/* Modal de cambio de precio */}
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

      {/* Modal de cambio masivo de precios */}
      <BulkPriceChangeModal
        isOpen={isBulkPriceModalOpen}
        onClose={() => setIsBulkPriceModalOpen(false)}
        products={products}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products'] })
          queryClient.invalidateQueries({ queryKey: ['inventory', 'status'] })
        }}
      />

      {/* Modal de gestión de variantes */}
      <ProductVariantsModal
        isOpen={!!variantsProduct}
        onClose={() => setVariantsProduct(null)}
        product={variantsProduct}
      />

      {/* Modal de gestión de lotes */}
      <ProductLotsModal
        isOpen={!!lotsProduct}
        onClose={() => setLotsProduct(null)}
        product={lotsProduct}
      />

      {/* Modal de gestión de seriales */}
      <ProductSerialsModal
        isOpen={!!serialsProduct}
        onClose={() => setSerialsProduct(null)}
        product={serialsProduct}
      />

      {/* Modal de importación CSV */}
      <ImportCSVModal
        isOpen={isImportCSVOpen}
        onClose={() => setIsImportCSVOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products'] })
        }}
      />

      {/* Modal de limpieza de duplicados */}
      <CleanDuplicatesModal
        isOpen={isCleanDuplicatesOpen}
        onClose={() => setIsCleanDuplicatesOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products'] })
        }}
      />
    </div>
  )
}
