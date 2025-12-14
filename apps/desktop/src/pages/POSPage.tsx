import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Search, Plus, Minus, ShoppingCart, Trash2 } from 'lucide-react'
import { productsService } from '@/services/products.service'
import { salesService } from '@/services/sales.service'
import { cashService } from '@/services/cash.service'
import { useCart } from '@/stores/cart.store'
import toast from 'react-hot-toast'
import CheckoutModal from '@/components/pos/CheckoutModal'

export default function POSPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [showCheckout, setShowCheckout] = useState(false)
  const { items, addItem, updateItem, removeItem, clear, getTotal } = useCart()

  // Obtener sesión actual de caja
  const { data: currentCashSession } = useQuery({
    queryKey: ['cash', 'current-session'],
    queryFn: () => cashService.getCurrentSession(),
    refetchInterval: 60000, // Refrescar cada minuto
  })

  // Búsqueda de productos
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', 'search', searchQuery],
    queryFn: () =>
      productsService.search({
        q: searchQuery || undefined,
        is_active: true,
        limit: 50,
      }),
    enabled: searchQuery.length >= 2 || searchQuery.length === 0,
  })

  const products = productsData?.products || []

  const handleAddToCart = (product: any) => {
    addItem({
      product_id: product.id,
      product_name: product.name,
      qty: 1,
      unit_price_bs: Number(product.price_bs),
      unit_price_usd: Number(product.price_usd),
    })
    toast.success(`${product.name} agregado al carrito`)
  }

  const handleUpdateQty = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeItem(itemId)
    } else {
      updateItem(itemId, { qty: newQty })
    }
  }

  const total = getTotal()

  // Crear venta
  const createSaleMutation = useMutation({
    mutationFn: salesService.create,
    onSuccess: (sale) => {
      toast.success(`Venta #${sale.id.slice(0, 8)} procesada exitosamente`)
      clear()
      setShowCheckout(false)
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al procesar la venta'
      toast.error(message)
    },
  })

  const handleCheckout = (checkoutData: {
    payment_method: 'CASH_BS' | 'CASH_USD' | 'PAGO_MOVIL' | 'TRANSFER' | 'OTHER' | 'FIAO'
    currency: 'BS' | 'USD' | 'MIXED'
    exchange_rate: number
    cash_payment?: {
      received_usd: number
      change_bs?: number
    }
    customer_id?: string
    customer_name?: string
    customer_document_id?: string
    customer_phone?: string
    customer_note?: string
  }) => {
    const saleItems = items.map((item) => ({
      product_id: item.product_id,
      qty: item.qty,
      discount_bs: item.discount_bs || 0,
      discount_usd: item.discount_usd || 0,
    }))

    createSaleMutation.mutate({
      items: saleItems,
      exchange_rate: checkoutData.exchange_rate,
      currency: checkoutData.currency,
      payment_method: checkoutData.payment_method,
      cash_payment: checkoutData.cash_payment,
      cash_session_id: currentCashSession?.id || undefined, // Asociar con sesión de caja actual
      customer_id: checkoutData.customer_id,
      customer_name: checkoutData.customer_name,
      customer_document_id: checkoutData.customer_document_id,
      customer_phone: checkoutData.customer_phone,
      customer_note: checkoutData.customer_note,
      note: null,
    })
  }

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Header - Mobile/Desktop */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Punto de Venta</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Busca y agrega productos al carrito</p>
      </div>

      {/* Layout: Mobile (stacked) / Tablet-Desktop (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Búsqueda y Lista de Productos */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {/* Barra de búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-lg"
              autoFocus
            />
          </div>

          {/* Lista de productos */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            {isLoading ? (
              <div className="p-6 sm:p-8 text-center text-sm sm:text-base text-gray-500">
                Buscando productos...
              </div>
            ) : products.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-sm sm:text-base text-gray-500">
                {searchQuery ? 'No se encontraron productos' : 'Escribe para buscar productos'}
              </div>
            ) : (
              <div className="divide-y divide-gray-200 max-h-[calc(100vh-250px)] sm:max-h-[calc(100vh-300px)] lg:max-h-[calc(100vh-350px)] overflow-y-auto">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="p-3 sm:p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer touch-manipulation"
                    onClick={() => handleAddToCart(product)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleAddToCart(product)
                      }
                    }}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                          {product.name}
                        </h3>
                        {product.category && (
                          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">
                            {product.category}
                          </p>
                        )}
                        {product.barcode && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {product.barcode}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-base sm:text-lg text-gray-900">
                          ${Number(product.price_usd).toFixed(2)}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500">
                          Bs. {Number(product.price_bs).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Carrito - Sticky en desktop, normal en mobile */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm lg:sticky lg:top-20">
            <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Carrito ({items.length})
              </h2>
              {items.length > 0 && (
                <button
                  onClick={clear}
                  className="text-xs sm:text-sm text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-gray-500">
                <ShoppingCart className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm sm:text-base">El carrito está vacío</p>
              </div>
            ) : (
              <>
                <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 max-h-[300px] sm:max-h-[400px] lg:max-h-[calc(100vh-450px)] overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="bg-gray-50 rounded-lg p-2.5 sm:p-3">
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-sm text-gray-900 truncate">
                            {item.product_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            ${item.unit_price_usd.toFixed(2)} c/u
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeItem(item.id)
                          }}
                          className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors flex-shrink-0 touch-manipulation"
                          aria-label="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUpdateQty(item.id, item.qty - 1)
                            }}
                            className="p-1.5 rounded bg-white border border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation"
                            aria-label="Disminuir cantidad"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-semibold text-sm sm:text-base">
                            {item.qty}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUpdateQty(item.id, item.qty + 1)
                            }}
                            className="p-1.5 rounded bg-white border border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation"
                            aria-label="Aumentar cantidad"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="font-semibold text-sm sm:text-base text-gray-900">
                          ${(item.qty * item.unit_price_usd).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 sm:p-4 border-t border-gray-200 space-y-2 sm:space-y-3 bg-gray-50">
                  <div className="flex justify-between text-base sm:text-lg">
                    <span className="font-semibold text-gray-700">Total USD:</span>
                    <span className="font-bold text-gray-900">${total.usd.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm text-gray-600">
                    <span>Total Bs:</span>
                    <span>Bs. {total.bs.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={() => setShowCheckout(true)}
                    className="w-full bg-blue-600 text-white py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors touch-manipulation shadow-md"
                    disabled={items.length === 0}
                  >
                    Procesar Venta
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de checkout */}
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        items={items}
        total={total}
        onConfirm={handleCheckout}
        isLoading={createSaleMutation.isPending}
      />
    </div>
  )
}

