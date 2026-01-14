import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Search, Plus, Minus, ShoppingCart, Trash2, Scale } from 'lucide-react'
import { productsService } from '@/services/products.service'
import { salesService } from '@/services/sales.service'
import { cashService } from '@/services/cash.service'
import { useCart } from '@/stores/cart.store'
import toast from 'react-hot-toast'
import CheckoutModal from '@/components/pos/CheckoutModal'
import WeightInputModal from '@/components/pos/WeightInputModal'

interface WeightProduct {
  id: string
  name: string
  weight_unit: 'kg' | 'g' | 'lb' | 'oz'
  price_per_weight_bs: number
  price_per_weight_usd: number
  min_weight?: number | null
  max_weight?: number | null
}

export default function POSPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [showCheckout, setShowCheckout] = useState(false)
  const [selectedWeightProduct, setSelectedWeightProduct] = useState<WeightProduct | null>(null)
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

  // Helper para obtener decimales de precio por peso
  const getWeightPriceDecimals = (unit?: string | null) => {
    return unit === 'g' || unit === 'oz' ? 4 : 2
  }

  const handleAddToCart = (product: any) => {
    // Si es producto por peso, abrir modal para ingresar peso
    if (product.is_weight_product) {
      setSelectedWeightProduct({
        id: product.id,
        name: product.name,
        weight_unit: product.weight_unit || 'kg',
        price_per_weight_bs: Number(product.price_per_weight_bs) || 0,
        price_per_weight_usd: Number(product.price_per_weight_usd) || 0,
        min_weight: product.min_weight,
        max_weight: product.max_weight,
      })
      return
    }

    // Producto normal
    const existingItem = items.find(
      (item) => item.product_id === product.id && !item.is_weight_product
    )

    if (existingItem) {
      updateItem(existingItem.id, { qty: existingItem.qty + 1 })
    } else {
      addItem({
        product_id: product.id,
        product_name: product.name,
        qty: 1,
        unit_price_bs: Number(product.price_bs),
        unit_price_usd: Number(product.price_usd),
      })
    }
    toast.success(`${product.name} agregado al carrito`)
  }

  // Handler para confirmar peso de producto
  const handleWeightConfirm = (weightValue: number) => {
    if (!selectedWeightProduct) return

    const unitLabel = selectedWeightProduct.weight_unit

    // Convertir a números (PostgreSQL devuelve NUMERIC como string)
    const pricePerWeightBs = Number(selectedWeightProduct.price_per_weight_bs) || 0
    const pricePerWeightUsd = Number(selectedWeightProduct.price_per_weight_usd) || 0

    // Agregar al carrito con qty = peso y unit_price = precio por unidad de peso
    addItem({
      product_id: selectedWeightProduct.id,
      product_name: `${selectedWeightProduct.name} (${weightValue} ${unitLabel})`,
      qty: weightValue,
      unit_price_bs: pricePerWeightBs,
      unit_price_usd: pricePerWeightUsd,
      // Guardar info de peso para el backend
      is_weight_product: true,
      weight_unit: selectedWeightProduct.weight_unit,
      weight_value: weightValue,
      price_per_weight_bs: pricePerWeightBs,
      price_per_weight_usd: pricePerWeightUsd,
    })

    toast.success(`${selectedWeightProduct.name} (${weightValue} ${unitLabel}) agregado al carrito`)
    setSelectedWeightProduct(null)
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
      // Incluir info de peso para productos por peso
      is_weight_product: item.is_weight_product || false,
      weight_unit: item.weight_unit || null,
      weight_value: item.weight_value || null,
      price_per_weight_bs: item.price_per_weight_bs || null,
      price_per_weight_usd: item.price_per_weight_usd || null,
    }))

    createSaleMutation.mutate({
      items: saleItems,
      exchange_rate: checkoutData.exchange_rate,
      currency: checkoutData.currency,
      payment_method: checkoutData.payment_method,
      cash_payment: checkoutData.cash_payment,
      cash_session_id: currentCashSession?.id || undefined,
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
                    <div className="flex items-start justify-between gap-3 min-w-0">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base text-gray-900 break-words leading-snug flex items-center gap-2">
                          {product.is_weight_product && (
                            <Scale className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          )}
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
                        {product.is_weight_product ? (
                          <>
                            <p className="font-bold text-base sm:text-lg text-gray-900">
                              ${Number(product.price_per_weight_usd).toFixed(
                                getWeightPriceDecimals(product.weight_unit)
                              )}
                              <span className="text-xs font-normal text-gray-500">
                                /{product.weight_unit || 'kg'}
                              </span>
                            </p>
                            <p className="text-xs sm:text-sm text-gray-500">
                              Bs. {Number(product.price_per_weight_bs).toFixed(
                                getWeightPriceDecimals(product.weight_unit)
                              )}
                              /{product.weight_unit || 'kg'}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-bold text-base sm:text-lg text-gray-900">
                              ${Number(product.price_usd).toFixed(2)}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-500">
                              Bs. {Number(product.price_bs).toFixed(2)}
                            </p>
                          </>
                        )}
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
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm lg:sticky lg:top-20 flex flex-col max-h-[calc(100vh-140px)] lg:h-[calc(100vh-12rem)] lg:max-h-none overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
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
              <div className="flex-1 p-6 sm:p-8 text-center text-gray-500">
                <ShoppingCart className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm sm:text-base">El carrito está vacío</p>
              </div>
            ) : (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="bg-gray-50 rounded-lg p-2.5 sm:p-3">
                        <div className="flex items-start justify-between mb-2 gap-2 min-w-0">
                          <div className="flex-1 min-w-0">
                            <p
                              className="font-medium text-xs sm:text-sm text-gray-900 break-words leading-snug flex items-center gap-1"
                              title={item.product_name}
                            >
                              {item.is_weight_product && (
                                <Scale className="w-3 h-3 text-blue-600 flex-shrink-0" />
                              )}
                              {item.product_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.is_weight_product ? (
                                <>
                                  {item.qty} {item.weight_unit || 'kg'} × $
                                  {Number(item.price_per_weight_usd ?? item.unit_price_usd).toFixed(
                                    getWeightPriceDecimals(item.weight_unit)
                                  )}/{item.weight_unit || 'kg'}
                                </>
                              ) : (
                                <>${item.unit_price_usd.toFixed(2)} c/u</>
                              )}
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
                          {/* Solo mostrar controles +/- para productos NO por peso */}
                          {!item.is_weight_product && (
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
                          )}
                          {item.is_weight_product && (
                            <span className="text-sm text-gray-600">
                              {item.qty} {item.weight_unit || 'kg'}
                            </span>
                          )}
                          <div className="text-right tabular-nums">
                            <p className="font-semibold text-sm sm:text-base text-gray-900">
                              ${(item.qty * Number(item.unit_price_usd || 0)).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Bs. {(item.qty * Number(item.unit_price_bs || 0)).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-shrink-0 p-3 sm:p-4 border-t border-gray-200 space-y-2 sm:space-y-3 bg-gray-50">
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

      {/* Modal para ingresar peso */}
      <WeightInputModal
        isOpen={!!selectedWeightProduct}
        onClose={() => setSelectedWeightProduct(null)}
        product={selectedWeightProduct}
        onConfirm={handleWeightConfirm}
      />
    </div>
  )
}
