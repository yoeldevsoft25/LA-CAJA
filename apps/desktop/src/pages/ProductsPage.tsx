import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Edit, Trash2, Package, CheckCircle, DollarSign } from 'lucide-react'
import { productsService, Product } from '@/services/products.service'
import toast from 'react-hot-toast'
import ProductFormModal from '@/components/products/ProductFormModal'
import ChangePriceModal from '@/components/products/ChangePriceModal'
import BulkPriceChangeModal from '@/components/products/BulkPriceChangeModal'

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false)
  const [priceProduct, setPriceProduct] = useState<Product | null>(null)
  const [isBulkPriceModalOpen, setIsBulkPriceModalOpen] = useState(false)
  const queryClient = useQueryClient()

  // Búsqueda de productos
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', 'list', searchQuery],
    queryFn: () =>
      productsService.search({
        q: searchQuery || undefined,
        limit: 100,
      }),
  })

  const products = productsData?.products || []
  const total = productsData?.total || 0

  // Mutación para desactivar producto
  const deactivateMutation = useMutation({
    mutationFn: productsService.deactivate,
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
    mutationFn: productsService.activate,
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
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setIsBulkPriceModalOpen(true)}
              className="inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 active:bg-green-800 transition-colors shadow-md touch-manipulation"
            >
              <DollarSign className="w-5 h-5 mr-2" />
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

      {/* Barra de búsqueda */}
      <div className="mb-4 sm:mb-6">
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
      </div>

      {/* Lista de productos */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {isLoading ? (
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
    </div>
  )
}
