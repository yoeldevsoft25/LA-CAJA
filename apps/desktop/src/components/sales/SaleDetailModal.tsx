import { X, FileText, Package, DollarSign, Calendar, User, CreditCard, UserCircle } from 'lucide-react'
import { Sale } from '@/services/sales.service'
import { format } from 'date-fns'

interface SaleDetailModalProps {
  isOpen: boolean
  onClose: () => void
  sale: Sale | null
}

const paymentMethodLabels: Record<string, string> = {
  CASH_BS: 'Efectivo Bs',
  CASH_USD: 'Efectivo USD',
  PAGO_MOVIL: 'Pago Móvil',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
  SPLIT: 'Mixto',
  FIAO: 'Fiado',
}

const currencyLabels: Record<string, string> = {
  BS: 'Bolívares',
  USD: 'Dólares',
  MIXED: 'Mixto',
}

export default function SaleDetailModal({
  isOpen,
  onClose,
  sale,
}: SaleDetailModalProps) {
  if (!isOpen || !sale) return null

  const totalItems = sale.items.reduce((sum, item) => sum + item.qty, 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between rounded-t-lg">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Detalle de Venta</h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
              ID: {sale.id.substring(0, 8)}...
            </p>
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
          <div className="space-y-4 sm:space-y-6">
            {/* Sección: Información de la Venta */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Información de la Venta
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center mb-2">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mr-2" />
                    <span className="text-xs sm:text-sm font-semibold text-gray-700">Fecha y Hora</span>
                  </div>
                  <p className="text-sm sm:text-base font-semibold text-gray-900">
                    {format(new Date(sale.sold_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center mb-2">
                    <Package className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mr-2" />
                    <span className="text-xs sm:text-sm font-semibold text-gray-700">Productos</span>
                  </div>
                  <p className="text-sm sm:text-base font-semibold text-gray-900">
                    {sale.items.length} producto{sale.items.length !== 1 ? 's' : ''} - {totalItems}{' '}
                    unidad{totalItems !== 1 ? 'es' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Sección: Responsable y Cliente */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3 flex items-center">
                <UserCircle className="w-4 h-4 mr-2" />
                Responsable y Cliente
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center mb-2">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mr-2" />
                    <span className="text-xs sm:text-sm font-semibold text-blue-900">Responsable</span>
                  </div>
                  {sale.sold_by_user ? (
                    <>
                      <p className="text-sm sm:text-base font-semibold text-blue-900">
                        {sale.sold_by_user.full_name || 'Sin nombre'}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        ID: {sale.sold_by_user_id?.substring(0, 8)}...
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-blue-400">No disponible</p>
                  )}
                </div>

                {sale.customer ? (
                  <div
                    className={`rounded-lg p-3 sm:p-4 ${
                      sale.payment.method === 'FIAO'
                        ? 'bg-orange-50 border border-orange-200'
                        : 'bg-green-50 border border-green-200'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <UserCircle className={`w-4 h-4 sm:w-5 sm:h-5 mr-2 ${
                        sale.payment.method === 'FIAO' ? 'text-orange-600' : 'text-green-600'
                      }`} />
                      <span className={`text-xs sm:text-sm font-semibold ${
                        sale.payment.method === 'FIAO' ? 'text-orange-900' : 'text-green-900'
                      }`}>
                        Cliente {sale.payment.method === 'FIAO' && '(Fiado)'}
                      </span>
                    </div>
                    <p className={`text-sm sm:text-base font-semibold ${
                      sale.payment.method === 'FIAO' ? 'text-orange-900' : 'text-green-900'
                    }`}>
                      {sale.customer.name}
                    </p>
                    {sale.customer.document_id && (
                      <p className={`text-xs mt-1 ${
                        sale.payment.method === 'FIAO' ? 'text-orange-700' : 'text-green-700'
                      }`}>
                        CI: {sale.customer.document_id}
                      </p>
                    )}
                    {sale.customer.phone && (
                      <p className={`text-xs mt-1 ${
                        sale.payment.method === 'FIAO' ? 'text-orange-700' : 'text-green-700'
                      }`}>
                        Tel: {sale.customer.phone}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center mb-2">
                      <UserCircle className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mr-2" />
                      <span className="text-xs sm:text-sm font-semibold text-gray-700">Cliente</span>
                    </div>
                    <p className="text-sm text-gray-400">No registrado</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sección: Información de Pago */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3 flex items-center">
                <CreditCard className="w-4 h-4 mr-2" />
                Información de Pago
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center mb-2">
                    <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mr-2" />
                    <span className="text-xs sm:text-sm font-semibold text-gray-700">
                      Método de Pago
                    </span>
                  </div>
                  <p className="text-sm sm:text-base font-semibold text-gray-900">
                    {paymentMethodLabels[sale.payment.method] || sale.payment.method}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center mb-2">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mr-2" />
                    <span className="text-xs sm:text-sm font-semibold text-gray-700">Moneda</span>
                  </div>
                  <p className="text-sm sm:text-base font-semibold text-gray-900">
                    {currencyLabels[sale.currency] || sale.currency}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Tasa: {Number(sale.exchange_rate).toFixed(2)} Bs/USD
                  </p>
                </div>
              </div>
            </div>

            {/* Sección: Estado de Deuda (FIAO) */}
            {sale.payment.method === 'FIAO' && sale.debt && (
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3 flex items-center">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Estado de Deuda
                </h3>
                <div
                  className={`rounded-lg p-3 sm:p-4 border ${
                    sale.debt.status === 'paid'
                      ? 'bg-green-50 border-green-200'
                      : sale.debt.status === 'partial'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-orange-50 border-orange-200'
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">Estado</p>
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                          sale.debt.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : sale.debt.status === 'partial'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {sale.debt.status === 'paid'
                          ? 'Pagado Completamente'
                          : sale.debt.status === 'partial'
                          ? 'Pago Parcial'
                          : 'Pendiente por Pagar'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">Monto Original</p>
                      <p className="text-sm sm:text-base font-semibold text-gray-900">
                        {Number(sale.debt.amount_bs).toFixed(2)} Bs / ${Number(sale.debt.amount_usd).toFixed(2)} USD
                      </p>
                    </div>
                    {sale.debt.total_paid_bs !== undefined && sale.debt.total_paid_bs > 0 && (
                      <>
                        <div>
                          <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">Total Pagado</p>
                          <p className="text-sm sm:text-base font-semibold text-green-700">
                            {Number(sale.debt.total_paid_bs).toFixed(2)} Bs / ${Number(sale.debt.total_paid_usd || 0).toFixed(2)} USD
                          </p>
                        </div>
                        {sale.debt.remaining_bs !== undefined && sale.debt.remaining_bs > 0 && (
                          <div>
                            <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">Pendiente</p>
                            <p className="text-sm sm:text-base font-semibold text-orange-700">
                              {Number(sale.debt.remaining_bs).toFixed(2)} Bs / ${Number(sale.debt.remaining_usd || 0).toFixed(2)} USD
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {sale.debt.id && (
                    <p className="text-xs text-gray-500 mt-3">
                      ID de Deuda: {sale.debt.id.substring(0, 8)}...
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Detalle de pago mixto */}
            {sale.payment.method === 'SPLIT' && sale.payment.split && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                <h3 className="text-sm sm:text-base font-semibold text-blue-900 mb-3">
                  Desglose de Pago Mixto
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  {sale.payment.split.cash_bs && (
                    <div>
                      <span className="text-blue-700">Efectivo Bs:</span>
                      <span className="ml-2 font-semibold text-blue-900">
                        {Number(sale.payment.split.cash_bs).toFixed(2)} Bs
                      </span>
                    </div>
                  )}
                  {sale.payment.split.cash_usd && (
                    <div>
                      <span className="text-blue-700">Efectivo USD:</span>
                      <span className="ml-2 font-semibold text-blue-900">
                        ${Number(sale.payment.split.cash_usd).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {sale.payment.split.pago_movil_bs && (
                    <div>
                      <span className="text-blue-700">Pago Móvil:</span>
                      <span className="ml-2 font-semibold text-blue-900">
                        {Number(sale.payment.split.pago_movil_bs).toFixed(2)} Bs
                      </span>
                    </div>
                  )}
                  {sale.payment.split.transfer_bs && (
                    <div>
                      <span className="text-blue-700">Transferencia:</span>
                      <span className="ml-2 font-semibold text-blue-900">
                        {Number(sale.payment.split.transfer_bs).toFixed(2)} Bs
                      </span>
                    </div>
                  )}
                  {sale.payment.split.other_bs && (
                    <div>
                      <span className="text-blue-700">Otro:</span>
                      <span className="ml-2 font-semibold text-blue-900">
                        {Number(sale.payment.split.other_bs).toFixed(2)} Bs
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lista de productos */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">
                Productos Vendidos
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="divide-y divide-gray-200">
                  {sale.items.map((item) => {
                    const unitPriceBs = Number(item.unit_price_bs)
                    const unitPriceUsd = Number(item.unit_price_usd)
                    const discountBs = Number(item.discount_bs || 0)
                    const discountUsd = Number(item.discount_usd || 0)
                    const subtotalBs = unitPriceBs * item.qty - discountBs
                    const subtotalUsd = unitPriceUsd * item.qty - discountUsd

                    return (
                      <div key={item.id} className="p-3 sm:p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <Package className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                              <div>
                                <p className="font-semibold text-gray-900 text-sm sm:text-base">
                                  {item.product?.name || `Producto ${item.product_id.substring(0, 8)}`}
                                </p>
                                {item.product?.sku && (
                                  <p className="text-xs text-gray-500">SKU: {item.product.sku}</p>
                                )}
                              </div>
                            </div>
                            <div className="ml-6 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm">
                              <div>
                                <span className="text-gray-600">Cantidad:</span>
                                <span className="ml-1 font-semibold text-gray-900">{item.qty}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Precio unit:</span>
                                <span className="ml-1 font-semibold text-gray-900">
                                  ${unitPriceUsd.toFixed(2)} / {unitPriceBs.toFixed(2)} Bs
                                </span>
                              </div>
                              {(discountBs > 0 || discountUsd > 0) && (
                                <div>
                                  <span className="text-gray-600">Descuento:</span>
                                  <span className="ml-1 font-semibold text-red-600">
                                    ${discountUsd.toFixed(2)} / {discountBs.toFixed(2)} Bs
                                  </span>
                                </div>
                              )}
                              <div>
                                <span className="text-gray-600">Subtotal:</span>
                                <span className="ml-1 font-bold text-gray-900">
                                  ${subtotalUsd.toFixed(2)} / {subtotalBs.toFixed(2)} Bs
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Totales */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">Resumen</h3>
              <div className="space-y-2 text-sm sm:text-base">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold text-gray-900">
                    ${Number(sale.totals.subtotal_usd).toFixed(2)} USD /{' '}
                    {Number(sale.totals.subtotal_bs).toFixed(2)} Bs
                  </span>
                </div>
                {(Number(sale.totals.discount_bs) > 0 || Number(sale.totals.discount_usd) > 0) && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Descuento:</span>
                    <span className="font-semibold text-red-600">
                      -${Number(sale.totals.discount_usd).toFixed(2)} USD / -{' '}
                      {Number(sale.totals.discount_bs).toFixed(2)} Bs
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-300 pt-2">
                  <span className="font-bold text-gray-900">Total:</span>
                  <span className="font-bold text-blue-600 text-lg">
                    ${Number(sale.totals.total_usd).toFixed(2)} USD /{' '}
                    {Number(sale.totals.total_bs).toFixed(2)} Bs
                  </span>
                </div>
              </div>
            </div>

            {/* Nota */}
            {sale.note && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
                <h3 className="text-sm sm:text-base font-semibold text-yellow-900 mb-2">Nota</h3>
                <p className="text-sm text-yellow-800">{sale.note}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-white rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm sm:text-base hover:bg-blue-700 transition-colors touch-manipulation"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

