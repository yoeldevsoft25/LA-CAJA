import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { inventoryService, StockReceivedRequest, StockStatus } from '@/services/inventory.service'
import { productsService, Product } from '@/services/products.service'
import { exchangeService } from '@/services/exchange.service'
import { X, Plus, Trash2, Search } from 'lucide-react'

interface StockReceivedModalProps {
  isOpen: boolean
  onClose: () => void
  product?: StockStatus | null
  onSuccess?: () => void
}

interface ProductItem {
  id: string
  product_id: string
  product_name: string
  qty: number
  unit_cost_usd: number
  unit_cost_bs: number
}

export default function StockReceivedModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: StockReceivedModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [productItems, setProductItems] = useState<ProductItem[]>([])
  const [supplier, setSupplier] = useState('')
  const [invoice, setInvoice] = useState('')
  const [note, setNote] = useState('')

  // Obtener productos para selección
  const { data: productsData } = useQuery({
    queryKey: ['products', 'list'],
    queryFn: () => productsService.search({ limit: 1000 }),
    enabled: isOpen,
  })

  // Obtener tasa BCV
  const { data: bcvRateData } = useQuery({
    queryKey: ['bcvRate'],
    queryFn: () => exchangeService.getBCVRate(),
    enabled: isOpen,
    staleTime: 1000 * 60 * 5,
  })

  const products = productsData?.products || []
  const exchangeRate = bcvRateData?.rate || 36

  // Filtrar productos según búsqueda (excluyendo los ya agregados)
  const addedProductIds = new Set(productItems.map((item) => item.product_id))
  const filteredProducts = products.filter((p) => {
    if (addedProductIds.has(p.id)) return false
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      p.name.toLowerCase().includes(searchLower) ||
      p.sku?.toLowerCase().includes(searchLower) ||
      p.barcode?.toLowerCase().includes(searchLower)
    )
  })

  // Si se pasa un producto específico, agregarlo automáticamente
  useEffect(() => {
    if (isOpen && product && productItems.length === 0) {
      // Buscar el producto completo para obtener los costos predeterminados
      const fullProduct = products.find((p: any) => p.id === product.product_id)
      // Convertir a número si viene como string (PostgreSQL devuelve NUMERIC como string)
      const defaultCostUsd = fullProduct?.cost_usd ? Number(fullProduct.cost_usd) : 0
      const defaultCostBs = fullProduct?.cost_bs ? Number(fullProduct.cost_bs) : 0

      setProductItems([
        {
          id: `item-${Date.now()}`,
          product_id: product.product_id,
          product_name: product.product_name,
          qty: 1,
          unit_cost_usd: defaultCostUsd,
          unit_cost_bs: defaultCostBs > 0 ? defaultCostBs : Math.round(defaultCostUsd * exchangeRate * 100) / 100,
        },
      ])
    } else if (isOpen && !product) {
      setProductItems([])
    }
  }, [isOpen, product, products, exchangeRate])

  // Limpiar al cerrar
  useEffect(() => {
    if (!isOpen) {
      setProductItems([])
      setSupplier('')
      setInvoice('')
      setNote('')
      setSearchQuery('')
      setShowProductSearch(false)
    }
  }, [isOpen])

  const addProduct = (product: Product) => {
    // Cargar costos predeterminados del producto si existen, sino usar 0
    // Convertir a número si viene como string (PostgreSQL devuelve NUMERIC como string)
    const defaultCostUsd = Number(product.cost_usd) || 0
    const defaultCostBs = Number(product.cost_bs) || 0

    const newItem: ProductItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      product_id: product.id,
      product_name: product.name,
      qty: 1,
      unit_cost_usd: defaultCostUsd,
      unit_cost_bs: defaultCostBs > 0 ? defaultCostBs : Math.round(defaultCostUsd * exchangeRate * 100) / 100,
    }
    setProductItems([...productItems, newItem])
    setSearchQuery('')
    setShowProductSearch(false)
  }

  const removeProduct = (itemId: string) => {
    setProductItems(productItems.filter((item) => item.id !== itemId))
  }

  const updateProductItem = (
    itemId: string,
    field: keyof ProductItem,
    value: number | string
  ) => {
    setProductItems(
      productItems.map((item) => {
        if (item.id === itemId) {
          const updated = { ...item, [field]: value }
          // Si cambia unit_cost_usd, recalcular unit_cost_bs
          if (field === 'unit_cost_usd') {
            updated.unit_cost_bs = Math.round(Number(value) * exchangeRate * 100) / 100
          }
          return updated
        }
        return item
      })
    )
  }

  const stockReceivedMutation = useMutation({
    mutationFn: async (requests: StockReceivedRequest[]) => {
      // Ejecutar todas las peticiones en paralelo
      const promises = requests.map((req) => inventoryService.stockReceived(req))
      return Promise.all(promises)
    },
    onSuccess: (results) => {
      toast.success(
        `Stock recibido exitosamente para ${results.length} producto${results.length > 1 ? 's' : ''}`
      )
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al recibir stock')
    },
  })

  const handleSubmit = () => {
    if (productItems.length === 0) {
      toast.error('Debes agregar al menos un producto')
      return
    }

    // Validar que todos los productos tengan cantidad y costo
    const invalidItems = productItems.filter(
      (item) => item.qty <= 0 || item.unit_cost_usd < 0
    )
    if (invalidItems.length > 0) {
      toast.error('Todos los productos deben tener cantidad mayor a 0 y costo válido')
      return
    }

    // Crear las peticiones
    const requests: StockReceivedRequest[] = productItems.map((item) => ({
      product_id: item.product_id,
      qty: item.qty,
      unit_cost_bs: item.unit_cost_bs,
      unit_cost_usd: item.unit_cost_usd,
      note: note || undefined,
      ref:
        supplier || invoice
          ? {
              supplier: supplier || undefined,
              invoice: invoice || undefined,
            }
          : undefined,
    }))

    stockReceivedMutation.mutate(requests)
  }

  if (!isOpen) return null

  const isLoading = stockReceivedMutation.isPending
  const totalProducts = productItems.length
  const totalItems = productItems.reduce((sum, item) => sum + item.qty, 0)
  const totalCostUsd = productItems.reduce(
    (sum, item) => sum + item.unit_cost_usd * item.qty,
    0
  )
  const totalCostBs = productItems.reduce(
    (sum, item) => sum + item.unit_cost_bs * item.qty,
    0
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            Recibir Stock {totalProducts > 0 && `(${totalProducts} productos)`}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="space-y-4 sm:space-y-6">
            {/* Botón para agregar producto */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProductSearch(!showProductSearch)}
                className="w-full flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors touch-manipulation"
              >
                <Plus className="w-5 h-5 mr-2" />
                Agregar Producto
              </button>

              {/* Búsqueda de productos */}
              {showProductSearch && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">
                        {searchQuery ? 'No se encontraron productos' : 'Busca un producto para agregar'}
                      </div>
                    ) : (
                      filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addProduct(p)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                          <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                          {p.sku && <p className="text-xs text-gray-500">SKU: {p.sku}</p>}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Lista de productos agregados */}
            {productItems.length > 0 && (
              <div className="space-y-3">
                {productItems.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 text-sm sm:text-base">
                          {item.product_name}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeProduct(item.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-manipulation ml-2"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Cantidad */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Cantidad <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          value={item.qty}
                          onChange={(e) =>
                            updateProductItem(item.id, 'qty', parseInt(e.target.value) || 1)
                          }
                          className="w-full px-3 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      {/* Costo USD */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Costo Unit. USD <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_cost_usd || ''}
                          onChange={(e) =>
                            updateProductItem(item.id, 'unit_cost_usd', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0.00"
                        />
                      </div>

                      {/* Costo BS (calculado) */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Costo Unit. Bs
                          <span className="text-xs font-normal text-gray-500 ml-1">
                            (Calculado)
                          </span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.unit_cost_bs.toFixed(2)}
                          className="w-full px-3 py-2 text-base border-2 border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                          readOnly
                        />
                      </div>
                    </div>

                    {/* Subtotal */}
                    <div className="mt-2 text-right text-sm">
                      <span className="text-gray-600">Subtotal: </span>
                      <span className="font-semibold text-gray-900">
                        ${(item.unit_cost_usd * item.qty).toFixed(2)} USD /{' '}
                        {(item.unit_cost_bs * item.qty).toFixed(2)} Bs
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Información compartida (Proveedor, Factura, Nota) */}
            {productItems.length > 0 && (
              <div className="border-t border-gray-200 pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Proveedor
                    </label>
                    <input
                      type="text"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nombre del proveedor"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      N° Factura
                    </label>
                    <input
                      type="text"
                      value={invoice}
                      onChange={(e) => setInvoice(e.target.value)}
                      className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Número de factura"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nota</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Notas adicionales (opcional)"
                  />
                </div>
              </div>
            )}

            {/* Resumen total */}
            {productItems.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Resumen</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Productos:</span>
                    <span className="ml-2 font-semibold text-gray-900">{totalProducts}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total unidades:</span>
                    <span className="ml-2 font-semibold text-gray-900">{totalItems}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total USD:</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      ${totalCostUsd.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Bs:</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      {totalCostBs.toFixed(2)}
                    </span>
                  </div>
                </div>
                {bcvRateData?.available && bcvRateData.rate && (
                  <p className="mt-2 text-xs text-gray-500">
                    Tasa BCV utilizada: {bcvRateData.rate.toFixed(2)} Bs/USD
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-white rounded-b-lg">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 sm:py-3 border-2 border-gray-300 rounded-lg font-semibold text-sm sm:text-base text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || productItems.length === 0}
              className="flex-1 px-4 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm sm:text-base hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              {isLoading
                ? 'Registrando...'
                : `Recibir Stock${totalProducts > 0 ? ` (${totalProducts})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
