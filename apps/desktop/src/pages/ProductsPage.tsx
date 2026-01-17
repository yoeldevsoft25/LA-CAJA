import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Edit, Trash2, Package, CheckCircle, DollarSign, Upload, AlertTriangle, ChevronLeft, ChevronRight, Layers, Boxes, Hash } from 'lucide-react'
import { productsService, Product } from '@/services/products.service'
import { inventoryService, StockStatus } from '@/services/inventory.service'
import { warehousesService } from '@/services/warehouses.service'
import toast from 'react-hot-toast'
import { useAuth } from '@/stores/auth.store'
import ProductFormModal from '@/components/products/ProductFormModal'
import ChangePriceModal from '@/components/products/ChangePriceModal'
import BulkPriceChangeModal from '@/components/products/BulkPriceChangeModal'
import ImportCSVModal from '@/components/products/ImportCSVModal'
import CleanDuplicatesModal from '@/components/products/CleanDuplicatesModal'
import ProductVariantsModal from '@/components/variants/ProductVariantsModal'
import ProductLotsModal from '@/components/lots/ProductLotsModal'
import ProductSerialsModal from '@/components/serials/ProductSerialsModal'

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

const formatStockValue = (product: Product, item: StockStatus) => {
  const isWeight = item.is_weight_product ?? Boolean(product.is_weight_product)
  if (!isWeight) return `${item.current_stock ?? 0}`
  const unit = (item.weight_unit || product.weight_unit || 'kg') as WeightUnit
  const kgValue = (item.current_stock ?? 0) * WEIGHT_UNIT_TO_KG[unit]
  return `${formatKg(kgValue)} kg`
}

export default function ProductsPage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)
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
  const queryClient = useQueryClient()

  // Reset page cuando cambia búsqueda o filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, categoryFilter, statusFilter])

  const { data: stockStatus } = useQuery({
    queryKey: ['inventory', 'status', warehouseFilter],
    queryFn: () =>
      inventoryService.getStockStatus({
        warehouse_id: warehouseFilter !== 'all' ? warehouseFilter : undefined,
      }),
    staleTime: 1000 * 60 * 5,
  })

  const stockByProduct = (stockStatus || []).reduce<Record<string, StockStatus>>((acc, item) => {
    acc[item.product_id] = item
    return acc
  }, {})

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getAll(),
    staleTime: 1000 * 60 * 5,
  })

  const isActiveFilter =
    statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined

  const offset = (currentPage - 1) * pageSize

  // Búsqueda de productos con paginación
  const { data: productsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['products', 'list', user?.store_id, searchQuery, categoryFilter, statusFilter, currentPage, pageSize],
    queryFn: () =>
      productsService.search({
        q: searchQuery || undefined,
        category: categoryFilter || undefined,
        is_active: isActiveFilter,
        limit: pageSize,
        offset: offset,
      }, user?.store_id),
    staleTime: 1000 * 60 * 5,
  })

  const products = productsData?.products || []
  const total = productsData?.total || 0
  const totalPages = Math.ceil(total / pageSize)

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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestión de Productos</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              {total} {total === 1 ? 'producto' : 'productos'} encontrados
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsImportCSVOpen(true)}
              className="inline-flex items-center justify-center px-3 py-2 bg-gray-600 text-white rounded-lg font-semibold text-sm hover:bg-gray-700 active:bg-gray-800 transition-colors shadow-md touch-manipulation"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Importar CSV
            </button>
            <button
              onClick={() => setIsCleanDuplicatesOpen(true)}
              className="inline-flex items-center justify-center px-3 py-2 bg-orange-600 text-white rounded-lg font-semibold text-sm hover:bg-orange-700 active:bg-orange-800 transition-colors shadow-md touch-manipulation"
            >
              <AlertTriangle className="w-4 h-4 mr-1.5" />
              Limpiar Duplicados
            </button>
            <button
              onClick={() => setIsBulkPriceModalOpen(true)}
              className="inline-flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 active:bg-green-800 transition-colors shadow-md touch-manipulation"
            >
              <DollarSign className="w-4 h-4 mr-1.5" />
              Cambio Masivo
            </button>
            <button
              onClick={handleCreate}
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md touch-manipulation"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nuevo Producto
            </button>
          </div>
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="mb-4 sm:mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU o código de barras..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 sm:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-lg"
            autoFocus
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Categoría</label>
            <input
              type="text"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Todas las categorías"
            />
          </div>
          <div className="w-full sm:w-48">
            <label className="block text-xs text-gray-500 mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
          {warehouses.length > 0 && (
            <div className="w-full sm:w-56">
              <label className="block text-xs text-gray-500 mb-1">Stock por bodega</label>
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Todas</option>
                {warehouses
                  .filter((warehouse) => warehouse.is_active)
                  .map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} {warehouse.is_default ? '(Por defecto)' : ''}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Lista de productos */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {isError ? (
          <div className="p-8 text-center text-gray-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-red-400" />
            <p className="text-lg font-medium mb-2">Error al cargar productos</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Reintentar
            </button>
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300 animate-pulse" />
            <p>Cargando productos...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium mb-1">
              {searchQuery ? 'No se encontraron productos' : 'No hay productos registrados'}
            </p>
            <p className="text-sm">
              {searchQuery
                ? 'Intenta con otro término de búsqueda'
                : 'Haz clic en "Nuevo Producto" para comenzar'}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden sm:table-cell">
                      Categoría
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Precio
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider hidden sm:table-cell">
                      Stock
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        !product.is_active ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm sm:text-base">{product.name}</p>
                          {product.barcode && (
                            <p className="text-xs text-gray-500 mt-0.5">Código: {product.barcode}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                        {product.category || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                        {product.sku || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm sm:text-base">
                          <p className="font-semibold text-gray-900">
                            ${Number(product.price_usd).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">Bs. {Number(product.price_bs).toFixed(2)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {stockByProduct[product.id] ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-semibold">
                              {formatStockValue(product, stockByProduct[product.id])}
                            </span>
                            {stockByProduct[product.id].is_low_stock && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                                Bajo
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {product.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleManageVariants(product)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors touch-manipulation"
                            title="Variantes"
                          >
                            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                          <button
                            onClick={() => handleManageLots(product)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-manipulation"
                            title="Lotes"
                          >
                            <Boxes className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                          <button
                            onClick={() => handleManageSerials(product)}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors touch-manipulation"
                            title="Seriales"
                          >
                            <Hash className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                          <button
                            onClick={() => handleChangePrice(product)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors touch-manipulation"
                            title="Cambiar Precio"
                          >
                            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-manipulation"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                          {product.is_active ? (
                            <button
                              onClick={() => handleDeactivate(product)}
                              disabled={deactivateMutation.isPending}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 touch-manipulation"
                              title="Desactivar"
                            >
                              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivate(product)}
                              disabled={activateMutation.isPending}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 touch-manipulation"
                              title="Activar"
                            >
                              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Mostrando {offset + 1} - {Math.min(offset + pageSize, total)} de {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-medium">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de formulario */}
      <ProductFormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        product={editingProduct}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products'] })
          handleCloseForm()
        }}
      />

      {/* Modal de cambio de precio */}
      <ChangePriceModal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        product={priceProduct}
      />

      {/* Modal de cambio masivo de precios */}
      <BulkPriceChangeModal
        isOpen={isBulkPriceModalOpen}
        onClose={() => setIsBulkPriceModalOpen(false)}
        products={products}
      />

      {/* Modal de importar CSV */}
      <ImportCSVModal
        isOpen={isImportCSVOpen}
        onClose={() => setIsImportCSVOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products'] })
        }}
      />

      {/* Modal de limpiar duplicados */}
      <CleanDuplicatesModal
        isOpen={isCleanDuplicatesOpen}
        onClose={() => setIsCleanDuplicatesOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products'] })
        }}
      />

      <ProductVariantsModal
        isOpen={Boolean(variantsProduct)}
        onClose={() => setVariantsProduct(null)}
        product={variantsProduct}
      />

      <ProductLotsModal
        isOpen={Boolean(lotsProduct)}
        onClose={() => setLotsProduct(null)}
        product={lotsProduct}
      />

      <ProductSerialsModal
        isOpen={Boolean(serialsProduct)}
        onClose={() => setSerialsProduct(null)}
        product={serialsProduct}
      />
    </div>
  )
}
