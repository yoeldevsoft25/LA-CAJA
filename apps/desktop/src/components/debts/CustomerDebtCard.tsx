import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, User, Phone, CreditCard, DollarSign, Clock, CheckCircle, AlertCircle, Eye, Plus } from 'lucide-react'
import { Customer } from '@/services/customers.service'
import { debtsService, Debt, calculateDebtTotals } from '@/services/debts.service'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface CustomerDebtCardProps {
  customer: Customer
  debts: Debt[]
  onViewDebt: (debt: Debt) => void
  onAddPayment: (debt: Debt) => void
}

const statusConfig = {
  open: {
    label: 'Pendiente',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    icon: AlertCircle,
  },
  partial: {
    label: 'Parcial',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    icon: Clock,
  },
  paid: {
    label: 'Pagado',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    icon: CheckCircle,
  },
}

export default function CustomerDebtCard({
  customer,
  debts,
  onViewDebt,
  onAddPayment,
}: CustomerDebtCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Obtener resumen del cliente
  const { data: summary } = useQuery({
    queryKey: ['debtSummary', customer.id],
    queryFn: () => debtsService.getCustomerSummary(customer.id),
    enabled: debts.length > 0,
  })

  const openDebts = debts.filter((d) => d.status !== 'paid')
  const hasOpenDebts = openDebts.length > 0

  // Calcular totales localmente si no hay summary
  const totalRemaining = summary
    ? { usd: summary.remaining_usd, bs: summary.remaining_bs }
    : debts.reduce(
        (acc, debt) => {
          const calc = calculateDebtTotals(debt)
          return {
            usd: acc.usd + calc.remaining_usd,
            bs: acc.bs + calc.remaining_bs,
          }
        },
        { usd: 0, bs: 0 }
      )

  return (
    <div className={`bg-white rounded-lg border shadow-sm overflow-hidden ${
      hasOpenDebts ? 'border-orange-200' : 'border-gray-200'
    }`}>
      {/* Header del cliente - Clickeable para expandir */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors touch-manipulation"
      >
        <div className="flex items-center flex-1 min-w-0">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-3 flex-shrink-0 ${
            hasOpenDebts ? 'bg-orange-100' : 'bg-green-100'
          }`}>
            <span className={`font-bold text-lg ${
              hasOpenDebts ? 'text-orange-600' : 'text-green-600'
            }`}>
              {customer.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="font-semibold text-gray-900 truncate">{customer.name}</p>
            <div className="flex items-center gap-3 mt-0.5">
              {customer.document_id && (
                <span className="text-xs text-gray-500 flex items-center">
                  <CreditCard className="w-3 h-3 mr-1" />
                  {customer.document_id}
                </span>
              )}
              {customer.phone && (
                <span className="text-xs text-gray-500 flex items-center">
                  <Phone className="w-3 h-3 mr-1" />
                  {customer.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-3">
          {/* Total pendiente */}
          <div className="text-right">
            {hasOpenDebts ? (
              <>
                <p className="text-lg font-bold text-orange-600">
                  ${totalRemaining.usd.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">
                  {openDebts.length} deuda{openDebts.length !== 1 ? 's' : ''} pendiente{openDebts.length !== 1 ? 's' : ''}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-green-600">$0.00</p>
                <p className="text-xs text-gray-500">Sin deudas</p>
              </>
            )}
          </div>

          {/* Expand icon */}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Lista de deudas expandida */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Resumen */}
          {summary && (
            <div className="bg-gray-50 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Total Fiado</p>
                <p className="font-semibold text-gray-900">${summary.total_debt_usd.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500">Total Pagado</p>
                <p className="font-semibold text-green-600">${summary.total_paid_usd.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500">Pendiente</p>
                <p className="font-semibold text-orange-600">${summary.remaining_usd.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500">Deudas</p>
                <p className="font-semibold text-gray-900">
                  {summary.open_debts_count} abiertas / {summary.total_debts_count} total
                </p>
              </div>
            </div>
          )}

          {/* Lista de deudas */}
          <div className="divide-y divide-gray-100">
            {debts.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Este cliente no tiene deudas registradas</p>
              </div>
            ) : (
              debts.map((debt) => {
                const debtCalc = calculateDebtTotals(debt)
                const status = statusConfig[debt.status] || statusConfig.open
                const StatusIcon = status.icon

                return (
                  <div key={debt.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${status.bgColor} ${status.textColor}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {format(new Date(debt.created_at), "dd MMM yyyy", { locale: es })}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                          <div>
                            <span className="text-gray-500">Monto:</span>
                            <span className="ml-1 font-medium text-gray-900">
                              ${Number(debt.amount_usd).toFixed(2)}
                            </span>
                          </div>
                          {debt.status !== 'paid' && (
                            <div>
                              <span className="text-gray-500">Pendiente:</span>
                              <span className="ml-1 font-medium text-orange-600">
                                ${debtCalc.remaining_usd.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                        {debt.payments && debt.payments.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            {debt.payments.length} pago{debt.payments.length !== 1 ? 's' : ''} registrado{debt.payments.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-1 ml-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onViewDebt(debt)
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-manipulation"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {debt.status !== 'paid' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onAddPayment(debt)
                            }}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors touch-manipulation"
                            title="Agregar abono"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
