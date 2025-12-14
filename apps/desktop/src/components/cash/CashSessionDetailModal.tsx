import { useQuery } from '@tanstack/react-query'
import { X, DollarSign, Calendar, CheckCircle2, AlertTriangle, Lock, Unlock } from 'lucide-react'
import { cashService, CashSession, CashSessionSummary } from '@/services/cash.service'
import { format } from 'date-fns'

interface CashSessionDetailModalProps {
  isOpen: boolean
  onClose: () => void
  session: CashSession
}

export default function CashSessionDetailModal({
  isOpen,
  onClose,
  session,
}: CashSessionDetailModalProps) {
  const { data: summary, isLoading } = useQuery<CashSessionSummary>({
    queryKey: ['cash', 'session-summary', session.id],
    queryFn: () => cashService.getSessionSummary(session.id),
    enabled: isOpen,
  })

  if (!isOpen) return null

  const isOpenSession = session.closed_at === null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 sm:py-4 flex items-center justify-between rounded-t-lg">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Detalle de Sesión de Caja</h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
              ID: {session.id.substring(0, 8)}...
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Cargando resumen...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Estado */}
              <div
                className={`rounded-lg p-4 border ${
                  isOpenSession
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center">
                  {isOpenSession ? (
                    <Unlock className="w-5 h-5 text-green-600 mr-2" />
                  ) : (
                    <Lock className="w-5 h-5 text-gray-600 mr-2" />
                  )}
                  <span className="font-semibold text-gray-900">
                    {isOpenSession ? 'Sesión Abierta' : 'Sesión Cerrada'}
                  </span>
                </div>
              </div>

              {/* Información básica */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center mb-2">
                    <Calendar className="w-4 h-4 text-blue-600 mr-2" />
                    <span className="text-sm font-semibold text-blue-900">Apertura</span>
                  </div>
                  <p className="text-base font-semibold text-blue-900">
                    {format(new Date(session.opened_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>

                {session.closed_at && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center mb-2">
                      <Lock className="w-4 h-4 text-gray-600 mr-2" />
                      <span className="text-sm font-semibold text-gray-900">Cierre</span>
                    </div>
                    <p className="text-base font-semibold text-gray-900">
                      {format(new Date(session.closed_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                )}
              </div>

              {/* Montos de apertura */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Montos de Apertura</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-sm text-green-700 mb-1">Apertura en Bs</p>
                    <p className="text-xl font-bold text-green-900">
                      {Number(session.opening_amount_bs).toFixed(2)} Bs
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-sm text-green-700 mb-1">Apertura en USD</p>
                    <p className="text-xl font-bold text-green-900">
                      ${Number(session.opening_amount_usd).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Resumen de ventas */}
              {summary && (
                <>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Resumen de Ventas</h3>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Total de Ventas</p>
                          <p className="text-xl font-bold text-gray-900">
                            {summary.sales_count} venta{summary.sales_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Total Vendido</p>
                          <p className="text-lg font-bold text-gray-900">
                            {Number(summary.sales.total_bs).toFixed(2)} Bs / $
                            {Number(summary.sales.total_usd).toFixed(2)} USD
                          </p>
                        </div>
                      </div>

                      {/* Ventas por método de pago */}
                      <div className="border-t border-gray-300 pt-4">
                        <p className="text-sm font-medium text-gray-700 mb-3">
                          Ventas por Método de Pago
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-gray-600">Efectivo Bs:</span>{' '}
                            <span className="font-semibold">
                              {Number(summary.sales.by_method.CASH_BS || 0).toFixed(2)} Bs
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Efectivo USD:</span>{' '}
                            <span className="font-semibold">
                              ${Number(summary.sales.by_method.CASH_USD || 0).toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Pago Móvil:</span>{' '}
                            <span className="font-semibold">
                              {Number(summary.sales.by_method.PAGO_MOVIL || 0).toFixed(2)} Bs
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Transferencia:</span>{' '}
                            <span className="font-semibold">
                              {Number(summary.sales.by_method.TRANSFER || 0).toFixed(2)} Bs
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Flujo de efectivo */}
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-3">
                      Flujo de Efectivo
                    </h3>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-blue-700 mb-1">Efectivo Esperado (Bs)</p>
                          <p className="text-xl font-bold text-blue-900">
                            {Number(summary.cash_flow.expected_bs).toFixed(2)} Bs
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            Apertura: {Number(summary.cash_flow.opening_bs).toFixed(2)} Bs + Ventas:{' '}
                            {Number(summary.cash_flow.sales_bs).toFixed(2)} Bs
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-blue-700 mb-1">Efectivo Esperado (USD)</p>
                          <p className="text-xl font-bold text-blue-900">
                            ${Number(summary.cash_flow.expected_usd).toFixed(2)}
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            Apertura: ${Number(summary.cash_flow.opening_usd).toFixed(2)} + Ventas:{' '}
                            ${Number(summary.cash_flow.sales_usd).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Información de cierre */}
              {session.closed_at && session.counted && session.expected && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Información de Cierre</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Esperado</p>
                        <p className="text-base font-semibold text-gray-900">
                          {Number(session.expected.cash_bs).toFixed(2)} Bs / $
                          {Number(session.expected.cash_usd).toFixed(2)} USD
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Contado</p>
                        <p className="text-base font-semibold text-gray-900">
                          {Number(session.counted.cash_bs).toFixed(2)} Bs / $
                          {Number(session.counted.cash_usd).toFixed(2)} USD
                        </p>
                      </div>
                    </div>

                    {/* Diferencias */}
                    {(() => {
                      const diffBs =
                        Number(session.counted.cash_bs) - Number(session.expected.cash_bs)
                      const diffUsd =
                        Number(session.counted.cash_usd) - Number(session.expected.cash_usd)
                      const hasDifference = Math.abs(diffBs) > 0.01 || Math.abs(diffUsd) > 0.01

                      return hasDifference ? (
                        <div
                          className={`border-t pt-4 ${
                            Math.abs(diffBs) > 10 || Math.abs(diffUsd) > 10
                              ? 'bg-red-50 -mx-4 px-4 py-3 rounded'
                              : 'bg-orange-50 -mx-4 px-4 py-3 rounded'
                          }`}
                        >
                          <p className="text-sm font-medium text-gray-700 mb-2">Diferencias</p>
                          <p
                            className={`text-lg font-bold ${
                              Math.abs(diffBs) > 10 || Math.abs(diffUsd) > 10
                                ? 'text-red-700'
                                : 'text-orange-700'
                            }`}
                          >
                            {diffBs >= 0 ? '+' : ''}
                            {diffBs.toFixed(2)} Bs / {diffUsd >= 0 ? '+' : ''}
                            {diffUsd.toFixed(2)} USD
                          </p>
                        </div>
                      ) : (
                        <div className="border-t pt-4 bg-green-50 -mx-4 px-4 py-3 rounded">
                          <p className="text-sm font-medium text-green-900 mb-1 flex items-center">
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Cuadre Perfecto
                          </p>
                          <p className="text-xs text-green-700">No hay diferencias</p>
                        </div>
                      )
                    })()}
                  </div>

                  {session.note && (
                    <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-yellow-900 mb-1">Nota</p>
                      <p className="text-sm text-yellow-800">{session.note}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 px-4 py-4 bg-white rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors touch-manipulation"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

