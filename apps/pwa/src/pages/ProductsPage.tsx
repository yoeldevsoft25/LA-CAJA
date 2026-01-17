import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Edit, Trash2, Package, CheckCircle, DollarSign, Layers, Boxes, Hash, Upload, AlertTriangle, LayoutGrid, LayoutList } from 'lucide-react'
import { productsService, Product, ProductSearchResponse } from '@/services/products.service'
import { productsCacheService } from '@/services/products-cache.service'
import { warehousesService } from '@/services/warehouses.service'
import { useAuth } from '@/stores/auth.store'
import { useOnline } from '@/hooks/use-online'
import toast from 'react-hot-toast'
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

export default function ProductsPage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50) // 50 productos por página
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false)
  const [priceProduct, setPriceProduct] = useState<Product | null>(null)
  const [isBulkPriceModalOpen, setIsBulkPriceModalOpen] = useState(false)
  const [isImportCSVOpen, setIsImportCSVOpen] = useState(false)
  const [isCleanDuplicatesOpen, setIsCleanDuplicatesOpen] = useState(false)
  const [variantsProduct, setVariantsProduct] = useState<Product | null>(null)
  const [lotsProduct, setLotsProduct] = useState<Product | null>(null)
  const [serialsProduct, setSerialsProduct] = useState<Product | null>(null)
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all')
  // Vista: 'cards' para móvil, 'table' para desktop
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table')
  const queryClient = useQueryClient()

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
    setIsFormOpen(true)
  }

  const handleCreate = () => {
    setEditingProduct(null)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingProduct(null)
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

  const handleManageVariants = (product: Product) => {
    setVariantsProduct(product)
  }

  const handleManageLots = (product: Product) => {
    setLotsProduct(product)
  }

  const handleManageSerials = (product: Product) => {
    setSerialsProduct(product)
  }

  return (
    <div className="h-full max-w-7xl mx-auto">
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
              onClick={() => setIsCleanDuplicatesOpen(true)}
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-5 h-5 mr-2" />
              Limpiar Duplicados
            </Button>
            <Button
              onClick={() => setIsImportCSVOpen(true)}
              variant="outline"
              className="border-primary text-primary hover:bg-primary/10"
            >
              <Upload className="w-5 h-5 mr-2" />
              Importar CSV
            </Button>
            <Button
              onClick={() => setIsBulkPriceModalOpen(true)}
              variant="default"
              className="bg-success hover:bg-success/90"
            >
              <DollarSign className="w-5 h-5 mr-2" />
              Cambio Masivo
            </Button>
            <Button
              onClick={handleCreate}
              variant="default"
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

        {/* Toggle de vista */}
        <div className="flex items-center justify-end">
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
      <Card className="border border-border">
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
        ) : viewMode === 'cards' ? (
          /* Vista de Cards para móvil */
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  stock={stockByProduct[product.id]}
                  onEdit={handleEdit}
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
            <table className="w-full table-fixed">
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
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                      {product.category || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                      {product.sku || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm sm:text-base">
                        <p className="font-semibold text-foreground">
                          ${Number(product.price_usd).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">Bs. {Number(product.price_bs).toFixed(2)}</p>
                      </div>
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
                          onClick={() => handleEdit(product)}
                          className="h-8 w-8"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
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
