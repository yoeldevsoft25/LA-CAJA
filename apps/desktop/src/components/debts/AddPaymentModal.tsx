import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X, DollarSign, CreditCard, AlertTriangle } from 'lucide-react'
import { Debt, debtsService, calculateDebtTotals, PaymentMethod } from '@/services/debts.service'
import { exchangeService } from '@/services/exchange.service'
import toast from 'react-hot-toast'

const paymentSchema = z.object({
  amount_usd: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  amount_bs: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  method: z.enum(['CASH_BS', 'CASH_USD', 'PAGO_MOVIL', 'TRANSFER', 'OTHER']),
  note: z.string().optional(),
})

type PaymentFormData = z.infer<typeof paymentSchema>

interface AddPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  debt: Debt | null
  onSuccess?: () => void
}

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH_BS', label: 'Efectivo Bs' },
  { value: 'CASH_USD', label: 'Efectivo USD' },
  { value: 'PAGO_MOVIL', label: 'Pago Móvil' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' },
]

export default function AddPaymentModal({
  isOpen,
  onClose,
  debt,
  onSuccess,
}: AddPaymentModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount_usd: 0,
      amount_bs: 0,
      method: 'CASH_BS',
      note: '',
    },
  })

  // Obtener tasa BCV
  const { data: bcvRateData } = useQuery({
    queryKey: ['bcvRate'],
    queryFn: () => exchangeService.getBCVRate(),
    enabled: isOpen,
    staleTime: 1000 * 60 * 5,
  })

  const exchangeRate = bcvRateData?.rate || 0
  const debtWithTotals = useMemo(() => debt ? calculateDebtTotals(debt) : null, [debt])

  // Observar cambios en amount_usd para calcular amount_bs
  const amountUsd = watch('amount_usd')
  const selectedMethod = watch('method')

  useEffect(() => {
    if (amountUsd > 0 && exchangeRate > 0) {
      // Siempre usar tasa BCV actual para los pagos
      const calculatedBs = Math.round(amountUsd * exchangeRate * 100) / 100
      setValue('amount_bs', calculatedBs, { shouldValidate: false })
    } else if (amountUsd <= 0) {
      setValue('amount_bs', 0, { shouldValidate: false })
    }
  }, [amountUsd, exchangeRate, setValue])

  // Reset form cuando se abre el modal - solo depende de isOpen y debt.id
  useEffect(() => {
    if (isOpen && debt) {
      reset({
        amount_usd: 0,
        amount_bs: 0,
        method: 'CASH_BS',
        note: '',
      })
    }
  }, [isOpen, debt?.id, reset])

  const addPaymentMutation = useMutation({
    mutationFn: (data: PaymentFormData) => debtsService.addPayment(debt!.id, {
      amount_bs: data.amount_bs,
      amount_usd: data.amount_usd,
      method: data.method,
      note: data.note,
    }),
    onSuccess: () => {
      toast.success('Pago registrado exitosamente')
      onSuccess?.()
      onClose()
    },
    onError: (error: any) => {
      console.error('Error al registrar pago:', error)
      let message = 'Error al registrar el pago'
      
      if (error.response?.data) {
        // Si hay un mensaje directo
        if (error.response.data.message) {
          message = error.response.data.message
        }
        // Si hay un array de mensajes de validación
        else if (Array.isArray(error.response.data.message)) {
          message = error.response.data.message.join(', ')
        }
        // Si hay un objeto con mensajes
        else if (typeof error.response.data.message === 'object') {
          const messages = Object.values(error.response.data.message).flat()
          message = messages.join(', ')
        }
      }
      
      toast.error(message)
    },
  })

  const onSubmit = (data: PaymentFormData) => {
    if (!debt || !debtWithTotals) return

    // Validar que no exceda el saldo pendiente en USD (moneda de referencia)
    if (data.amount_usd > debtWithTotals.remaining_usd + 0.01) {
      toast.error(`El monto excede el saldo pendiente ($${debtWithTotals.remaining_usd.toFixed(2)})`)
      return
    }

    // El backend calculará el amount_bs usando la tasa BCV actual
    // Solo enviamos el amount_usd y un amount_bs aproximado (el backend lo recalculará)
    addPaymentMutation.mutate({
      amount_usd: data.amount_usd,
      amount_bs: data.amount_bs, // El backend lo recalculará con la tasa BCV actual
      method: data.method,
      note: data.note,
    })
  }

  const handlePayFull = () => {
    if (!debtWithTotals) return
    setValue('amount_usd', debtWithTotals.remaining_usd, { shouldValidate: true })
  }

  if (!isOpen || !debt || !debtWithTotals) return null

  const isLoading = addPaymentMutation.isPending

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between rounded-t-lg">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Registrar Abono</h2>
            {debt.customer && (
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                Cliente: {debt.customer.name}
              </p>
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
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5">
            {/* Info de saldo pendiente */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
                <span className="font-semibold text-orange-900">Saldo Pendiente</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">
                ${debtWithTotals.remaining_usd.toFixed(2)} USD
              </p>
              <p className="text-sm text-orange-700">
                {debtWithTotals.remaining_bs.toFixed(2)} Bs
              </p>
            </div>

            {/* Tasa de cambio */}
            {exchangeRate > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <span className="text-blue-800">
                  Tasa BCV: <strong>{exchangeRate.toFixed(2)} Bs/USD</strong>
                </span>
              </div>
            )}

            {/* Monto USD */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Monto a Abonar (USD) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="number"
                  step="0.01"
                  {...register('amount_usd', { valueAsNumber: true })}
                  className="w-full pl-10 pr-4 py-2.5 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              {errors.amount_usd && (
                <p className="mt-1 text-sm text-red-600">{errors.amount_usd.message}</p>
              )}
              <button
                type="button"
                onClick={handlePayFull}
                className="mt-2 text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Pagar saldo completo (${debtWithTotals.remaining_usd.toFixed(2)})
              </button>
            </div>

            {/* Monto Bs (calculado automáticamente) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Equivalente en Bs
                <span className="text-xs font-normal text-gray-500 ml-2">(Calculado automáticamente)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-medium">Bs</span>
                <input
                  type="number"
                  step="0.01"
                  {...register('amount_bs', { valueAsNumber: true })}
                  className="w-full pl-10 pr-4 py-2.5 text-lg border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                  placeholder="0.00"
                  readOnly
                />
              </div>
            </div>

            {/* Método de pago */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Método de Pago <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {paymentMethods.map((method) => (
                  <label
                    key={method.value}
                    className={`flex items-center justify-center px-3 py-2.5 border-2 rounded-lg cursor-pointer transition-all touch-manipulation ${
                      selectedMethod === method.value
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-300 hover:border-gray-400 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      value={method.value}
                      {...register('method')}
                      className="sr-only"
                    />
                    <CreditCard className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">{method.label}</span>
                  </label>
                ))}
              </div>
              {errors.method && (
                <p className="mt-1 text-sm text-red-600">{errors.method.message}</p>
              )}
            </div>

            {/* Nota */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nota (opcional)
              </label>
              <textarea
                {...register('note')}
                rows={2}
                className="w-full px-3 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                placeholder="Información adicional del pago..."
              />
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
                type="submit"
                disabled={isLoading || amountUsd <= 0}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-green-600 text-white rounded-lg font-semibold text-sm sm:text-base hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors touch-manipulation"
              >
                {isLoading ? 'Registrando...' : 'Registrar Abono'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
