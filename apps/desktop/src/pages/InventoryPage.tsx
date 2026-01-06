import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Package, AlertTriangle, Plus, TrendingUp, TrendingDown, History } from 'lucide-react'
import { inventoryService, StockStatus } from '@/services/inventory.service'
import StockReceivedModal from '@/components/inventory/StockReceivedModal'
import StockAdjustModal from '@/components/inventory/StockAdjustModal'
import MovementsModal from '@/components/inventory/MovementsModal'

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(50)
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)
  const [isStockReceivedModalOpen, setIsStockReceivedModalOpen] = useState(false)
  const [isStockAdjustModalOpen, setIsStockAdjustModalOpen] = useState(false)
  const [isMovementsModalOpen, setIsMovementsModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<StockStatus | null>(null)
  const queryClient = useQueryClient()

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
    ],
    queryFn: () =>
      inventoryService.getStockStatusPaged({
        search: searchQuery || undefined,
        limit: pageSize,
        offset,
        low_stock_only: showLowStockOnly || undefined,
      }),
    staleTime: 1000 * 60 * 10,
    gcTime: Infinity,
  })

  const { data: lowStockCountData } = useQuery({
    queryKey: ['inventory', 'low-stock-count', searchQuery],
    queryFn: () =>
      inventoryService.getStockStatusPaged({
        search: searchQuery || undefined,
        low_stock_only: true,
        limit: 1,
        offset: 0,
      }),
    enabled: !showLowStockOnly,
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

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestión de Inventario</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
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
            <button
              onClick={() => {
                setSelectedProduct(null)
                setIsStockReceivedModalOpen(true)
              }}
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-md touch-manipulation text-sm"
            >
              <Plus className="w-5 h-5 mr-2" />
              Recibir Stock
            </button>
            <button
              onClick={() => handleViewMovements(null)}
              className="inline-flex items-center justify-center px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-md touch-manipulation text-sm"
            >
              <History className="w-5 h-5 mr-2" />
              Ver Todos los Movimientos
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4 sm:mb-6 space-y-3">
        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU o código de barras..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 sm:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-lg"
          />
        </div>

        {/* Filtro de stock bajo */}
        <div className="flex items-center">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showLowStockOnly}
              onChange={(e) => setShowLowStockOnly(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm sm:text-base text-gray-700 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1 text-orange-500" />
              Solo mostrar productos con stock bajo
            </span>
          </label>
        </div>
      </div>

      {/* Lista de productos */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300 animate-pulse" />
            <p>Cargando inventario...</p>
          </div>
        ) : stockItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium mb-1">
              {searchQuery || showLowStockOnly
                ? 'No se encontraron productos'
                : 'No hay productos en inventario'}
            </p>
            <p className="text-sm">
              {searchQuery
                ? 'Intenta con otro término de búsqueda'
                : 'Haz clic en "Recibir Stock" para agregar productos'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 overflow-x-auto">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[50%] sm:w-[45%]">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Stock Actual
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider hidden sm:table-cell">
                    Umbral Mínimo
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider w-32 sm:w-40">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stockItems.map((item) => (
                  <tr
                    key={item.product_id}
                    className={`hover:bg-gray-50 transition-colors ${
                      item.is_low_stock ? 'bg-orange-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 align-top w-[50%] sm:w-[45%]">
                      <div className="flex items-center min-w-0">
                        <Package className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" />
                        <div className="min-w-0 max-w-full">
                          <p
                            className="font-semibold text-gray-900 text-sm sm:text-base break-words"
                            title={item.product_name}
                          >
                            {item.product_name}
                          </p>
                          {item.is_low_stock && (
                            <p className="text-xs text-orange-600 font-medium mt-0.5">
                              Stock bajo
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-lg sm:text-xl font-bold ${
                          item.is_low_stock ? 'text-orange-600' : 'text-gray-900'
                        }`}
                      >
                        {item.current_stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600 hidden sm:table-cell">
                      {item.low_stock_threshold}
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      {item.is_low_stock ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Bajo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 w-32 sm:w-40">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleViewMovements(item)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
                          title="Ver movimientos"
                        >
                          <History className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          onClick={() => handleReceiveStock(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-manipulation"
                          title="Recibir stock"
                        >
                          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          onClick={() => handleAdjustStock(item)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors touch-manipulation"
                          title="Ajustar stock"
                        >
                          <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {stockItems.length > 0 && total > pageSize && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Mostrando {offset + 1} - {Math.min(offset + pageSize, total)} de {total} productos
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-700">
              Página {currentPage} de {Math.ceil(total / pageSize)}
            </span>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage >= Math.ceil(total / pageSize)}
              className="px-3 py-1.5 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
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
