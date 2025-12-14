import { useQuery } from '@tanstack/react-query'
import { X, Package, TrendingUp, TrendingDown, ShoppingCart } from 'lucide-react'
import { inventoryService, InventoryMovement, StockStatus } from '@/services/inventory.service'
import { format } from 'date-fns'

interface MovementsModalProps {
  isOpen: boolean
  onClose: () => void
  product: StockStatus | null
}

const movementTypeLabels = {
  received: 'Recibido',
  adjust: 'Ajuste',
  sale: 'Venta',
}

const movementTypeIcons = {
  received: TrendingUp,
  adjust: TrendingDown,
  sale: ShoppingCart,
}

const movementTypeColors = {
  received: 'text-green-600 bg-green-50',
  adjust: 'text-purple-600 bg-purple-50',
  sale: 'text-blue-600 bg-blue-50',
}

export default function MovementsModal({
  isOpen,
  onClose,
  product,
}: MovementsModalProps) {
  const { data: movementsData, isLoading } = useQuery({
    queryKey: ['inventory', 'movements', product?.product_id || 'all'],
    queryFn: () =>
      inventoryService.getMovements(product?.product_id, 100, 0),
    enabled: isOpen,
  })

  if (!isOpen) return null

  const movements = movementsData?.movements || []
  const total = movementsData?.total || 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between rounded-t-lg">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              Movimientos de Inventario
            </h2>
            {product ? (
              <p className="text-xs sm:text-sm text-gray-600 mt-1">{product.product_name}</p>
            ) : (
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Todos los productos</p>
            )}
          </div>
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
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300 animate-pulse" />
              <p>Cargando movimientos...</p>
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium mb-1">No hay movimientos</p>
              <p className="text-sm">Este producto no tiene movimientos registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="mb-4 text-sm text-gray-600">
                Total de movimientos: <span className="font-semibold">{total}</span>
              </div>
              {movements.map((movement) => {
                const Icon =
                  movementTypeIcons[movement.movement_type] || Package
                const typeLabel =
                  movementTypeLabels[movement.movement_type] || movement.movement_type
                const typeColor =
                  movementTypeColors[movement.movement_type] || 'text-gray-600 bg-gray-50'

                return (
                  <div
                    key={movement.id}
                    className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div
                          className={`p-2 rounded-lg ${typeColor} flex-shrink-0`}
                        >
                          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Nombre del producto (si no está filtrado por producto) */}
                          {!product && movement.product_name && (
                            <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">
                              {movement.product_name}
                            </h4>
                          )}
                          
                          <div className="flex items-center space-x-2 mb-2 flex-wrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeColor}`}
                            >
                              {typeLabel}
                            </span>
                            <span
                              className={`text-base sm:text-lg font-bold ${
                                movement.qty_delta > 0
                                  ? 'text-green-600'
                                  : movement.qty_delta < 0
                                    ? 'text-red-600'
                                    : 'text-gray-600'
                              }`}
                            >
                              {movement.qty_delta > 0 ? '+' : ''}
                              {movement.qty_delta} unidades
                            </span>
                          </div>

                          <p className="text-xs sm:text-sm text-gray-500 mb-2">
                            {format(new Date(movement.happened_at), 'dd/MM/yyyy HH:mm')}
                          </p>

                          {/* Costos - Unitario y Total */}
                          {movement.movement_type === 'received' &&
                            (Number(movement.unit_cost_bs) > 0 ||
                              Number(movement.unit_cost_usd) > 0) && (
                              <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                                <div className="text-xs sm:text-sm space-y-1">
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Costo unitario:</span>
                                    <span className="font-semibold text-gray-900">
                                      ${Number(movement.unit_cost_usd).toFixed(2)} USD / Bs.{' '}
                                      {Number(movement.unit_cost_bs).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center border-t border-blue-200 pt-1">
                                    <span className="text-gray-700 font-medium">Costo total:</span>
                                    <span className="font-bold text-blue-700">
                                      ${(Number(movement.unit_cost_usd) * Math.abs(movement.qty_delta)).toFixed(2)} USD / Bs.{' '}
                                      {(Number(movement.unit_cost_bs) * Math.abs(movement.qty_delta)).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                          {movement.ref && (
                            <div className="mt-2 text-xs text-gray-600 space-y-1">
                              {movement.ref.supplier && (
                                <p>
                                  <span className="font-medium">Proveedor:</span>{' '}
                                  {movement.ref.supplier}
                                </p>
                              )}
                              {movement.ref.invoice && (
                                <p>
                                  <span className="font-medium">Factura:</span>{' '}
                                  {movement.ref.invoice}
                                </p>
                              )}
                            </div>
                          )}

                          {movement.note && (
                            <p className="text-sm text-gray-700 mt-2 italic border-l-2 border-gray-200 pl-2">
                              {movement.note}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-white rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 sm:py-3 border-2 border-gray-300 rounded-lg font-semibold text-sm sm:text-base text-gray-700 hover:bg-gray-50 transition-colors touch-manipulation"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

