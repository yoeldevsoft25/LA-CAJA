import { X, Calendar, DollarSign, CreditCard, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { Debt, DebtPayment, calculateDebtTotals } from '@/services/debts.service'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface DebtDetailModalProps {
  isOpen: boolean
  onClose: () => void
  debt: Debt | null
  onAddPayment?: () => void
}

const paymentMethodLabels: Record<string, string> = {
  CASH_BS: 'Efectivo Bs',
  CASH_USD: 'Efectivo USD',
  PAGO_MOVIL: 'Pago Móvil',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
}

const statusConfig = {
  open: {
    label: 'Pendiente',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-200',
    icon: AlertCircle,
  },
  partial: {
    label: 'Pago Parcial',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-200',
    icon: Clock,
  },
  paid: {
    label: 'Pagado',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-200',
    icon: CheckCircle,
  },
}

export default function DebtDetailModal({
  isOpen,
  onClose,
  debt,
  onAddPayment,
}: DebtDetailModalProps) {
  if (!isOpen || !debt) return null

  const debtWithTotals = calculateDebtTotals(debt)
  const status = statusConfig[debt.status] || statusConfig.open
  const StatusIcon = status.icon
  const hasPayments = debt.payments && debt.payments.length > 0
  const canAddPayment = debt.status !== 'paid'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between rounded-t-lg">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Detalle de Deuda</h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
              ID: {debt.id.substring(0, 8)}...
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
            {/* Estado y Fecha */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={`rounded-lg p-4 border ${status.borderColor} ${status.bgColor}`}>
                <div className="flex items-center mb-2">
                  <StatusIcon className={`w-5 h-5 ${status.textColor} mr-2`} />
                  <span className={`text-sm font-semibold ${status.textColor}`}>Estado</span>
                </div>
                <p className={`text-lg font-bold ${status.textColor}`}>{status.label}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center mb-2">
                  <Calendar className="w-5 h-5 text-gray-400 mr-2" />
                  <span className="text-sm font-semibold text-gray-700">Fecha de Creación</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {format(new Date(debt.created_at), "dd 'de' MMMM, yyyy", { locale: es })}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {format(new Date(debt.created_at), 'HH:mm', { locale: es })} hrs
                </p>
              </div>
            </div>

            {/* Cliente */}
            {debt.customer && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">Cliente</h3>
                <p className="text-lg font-bold text-blue-900">{debt.customer.name}</p>
                {debt.customer.document_id && (
                  <p className="text-sm text-blue-700 mt-1">CI: {debt.customer.document_id}</p>
                )}
                {debt.customer.phone && (
                  <p className="text-sm text-blue-700">Tel: {debt.customer.phone}</p>
                )}
              </div>
            )}

            {/* Montos */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Resumen de Montos
                </h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Monto Original:</span>
                  <span className="font-semibold text-gray-900">
                    ${Number(debt.amount_usd).toFixed(2)} / {Number(debt.amount_bs).toFixed(2)} Bs
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Pagado:</span>
                  <span className="font-semibold text-green-600">
                    ${debtWithTotals.total_paid_usd.toFixed(2)} / {debtWithTotals.total_paid_bs.toFixed(2)} Bs
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                  <span className="font-bold text-gray-900">Saldo Pendiente:</span>
                  <span className={`text-lg font-bold ${debtWithTotals.remaining_bs > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    ${debtWithTotals.remaining_usd.toFixed(2)} / {debtWithTotals.remaining_bs.toFixed(2)} Bs
                  </span>
                </div>
              </div>
            </div>

            {/* Historial de Pagos */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Historial de Pagos ({debt.payments?.length || 0})
                </h3>
              </div>
              {hasPayments ? (
                <div className="divide-y divide-gray-100">
                  {debt.payments
                    .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
                    .map((payment: DebtPayment) => (
                      <div key={payment.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {paymentMethodLabels[payment.method] || payment.method}
                              </span>
                              <span className="text-xs text-gray-500 ml-2">
                                {format(new Date(payment.paid_at), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                              </span>
                            </div>
                            {payment.note && (
                              <p className="text-sm text-gray-600 mt-1 flex items-start">
                                <FileText className="w-3.5 h-3.5 mr-1.5 mt-0.5 text-gray-400 flex-shrink-0" />
                                {payment.note}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-bold text-green-600">
                              +${Number(payment.amount_usd).toFixed(2)}
                            </p>
                            <p className="text-sm text-gray-500">
                              +{Number(payment.amount_bs).toFixed(2)} Bs
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <CreditCard className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No hay pagos registrados</p>
                </div>
              )}
            </div>

            {/* Nota de la venta original */}
            {debt.sale && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Venta Asociada</h3>
                <p className="text-sm text-gray-600">
                  ID: {debt.sale.id.substring(0, 8)}... •{' '}
                  {format(new Date(debt.sale.sold_at), "dd/MM/yyyy HH:mm", { locale: es })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-white rounded-b-lg">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 sm:py-3 border-2 border-gray-300 rounded-lg font-semibold text-sm sm:text-base text-gray-700 hover:bg-gray-50 transition-colors touch-manipulation"
            >
              Cerrar
            </button>
            {canAddPayment && onAddPayment && (
              <button
                onClick={onAddPayment}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-green-600 text-white rounded-lg font-semibold text-sm sm:text-base hover:bg-green-700 transition-colors touch-manipulation"
              >
                Registrar Abono
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
