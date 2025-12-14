import { useState, useEffect } from 'react'
import { X, DollarSign, AlertTriangle, CheckCircle2, Calculator } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CashSession, CashSessionSummary, CloseCashSessionRequest } from '@/services/cash.service'

const closeCashSchema = z.object({
  counted_bs: z
    .number({ message: 'El monto contado en Bs es requerido' })
    .min(0, 'El monto contado en Bs no puede ser negativo')
    .max(999999999.99, 'El monto contado en Bs excede el límite máximo'),
  counted_usd: z
    .number({ message: 'El monto contado en USD es requerido' })
    .min(0, 'El monto contado en USD no puede ser negativo')
    .max(999999999.99, 'El monto contado en USD excede el límite máximo'),
  note: z.string().optional(),
})

interface CloseCashModalProps {
  isOpen: boolean
  onClose: () => void
  session: CashSession
  sessionSummary: CashSessionSummary
  onConfirm: (data: CloseCashSessionRequest) => void
  isLoading: boolean
}

export default function CloseCashModal({
  isOpen,
  onClose,
  session,
  sessionSummary,
  onConfirm,
  isLoading,
}: CloseCashModalProps) {
  const [confirmStep, setConfirmStep] = useState(1) // 1: datos, 2: revisión, 3: confirmación final
  const [requiresFinalConfirm, setRequiresFinalConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<CloseCashSessionRequest>({
    resolver: zodResolver(closeCashSchema),
    defaultValues: {
      counted_bs: Number(sessionSummary.cash_flow.expected_bs) || 0,
      counted_usd: Number(sessionSummary.cash_flow.expected_usd) || 0,
      note: '',
    },
  })

  const countedBs = watch('counted_bs')
  const countedUsd = watch('counted_usd')

  const expectedBs = Number(sessionSummary.cash_flow.expected_bs) || 0
  const expectedUsd = Number(sessionSummary.cash_flow.expected_usd) || 0

  const differenceBs = countedBs && !isNaN(countedBs) ? countedBs - expectedBs : 0
  const differenceUsd = countedUsd && !isNaN(countedUsd) ? countedUsd - expectedUsd : 0

  const hasDifference = Math.abs(differenceBs) > 0.01 || Math.abs(differenceUsd) > 0.01
  const hasLargeDifference = Math.abs(differenceBs) > 10 || Math.abs(differenceUsd) > 10

  useEffect(() => {
    if (hasLargeDifference) {
      setRequiresFinalConfirm(true)
    }
  }, [hasLargeDifference])

  const onSubmit = (data: CloseCashSessionRequest) => {
    if (confirmStep === 1) {
      // Redondear a 2 decimales
      const roundedData = {
        ...data,
        counted_bs: Math.round(data.counted_bs * 100) / 100,
        counted_usd: Math.round(data.counted_usd * 100) / 100,
      }

      // Si hay diferencias grandes, pedir confirmación adicional
      const diffBs = roundedData.counted_bs - expectedBs
      const diffUsd = roundedData.counted_usd - expectedUsd

      if (Math.abs(diffBs) > 10 || Math.abs(diffUsd) > 10) {
        setConfirmStep(2)
        return
      }

      // Si no hay diferencias grandes, ir directamente a confirmación final
      setConfirmStep(3)
      return
    }

    if (confirmStep === 2) {
      // Revisión con diferencias, ir a confirmación final
      setConfirmStep(3)
      return
    }

    // Confirmación final - enviar
    const roundedData = {
      ...data,
      counted_bs: Math.round(data.counted_bs * 100) / 100,
      counted_usd: Math.round(data.counted_usd * 100) / 100,
    }
    onConfirm(roundedData)
  }

  const handleBack = () => {
    if (confirmStep > 1) {
      setConfirmStep(confirmStep - 1)
    } else {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 sm:py-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center">
            <AlertTriangle
              className={`w-5 h-5 sm:w-6 sm:h-6 mr-2 ${
                hasLargeDifference ? 'text-red-600' : 'text-orange-600'
              }`}
            />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                {confirmStep === 1 && 'Cerrar Caja'}
                {confirmStep === 2 && 'Revisar Diferencias'}
                {confirmStep === 3 && 'Confirmación Final'}
              </h2>
              <p className="text-xs text-gray-500">
                Paso {confirmStep} de {requiresFinalConfirm ? 3 : 2}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
            aria-label="Cerrar"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4 sm:p-6">
          {confirmStep === 1 && (
            <div className="space-y-6">
              {/* Advertencia de seguridad */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900 mb-1">
                      Importante: Verifica los montos cuidadosamente
                    </p>
                    <p className="text-xs text-yellow-800">
                      Asegúrate de contar físicamente el dinero en la caja antes de ingresar los
                      valores. Este proceso es irreversible.
                    </p>
                  </div>
                </div>
              </div>

              {/* Montos esperados */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                  <Calculator className="w-4 h-4 mr-2" />
                  Montos Esperados (Calculados)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-blue-700 mb-1">Efectivo Esperado en Bs</p>
                    <p className="text-xl font-bold text-blue-900">{expectedBs.toFixed(2)} Bs</p>
                    <p className="text-xs text-blue-600 mt-1">
                      Apertura: {Number(session.opening_amount_bs).toFixed(2)} Bs + Ventas:{' '}
                      {Number(sessionSummary.cash_flow.sales_bs).toFixed(2)} Bs
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-700 mb-1">Efectivo Esperado en USD</p>
                    <p className="text-xl font-bold text-blue-900">
                      ${expectedUsd.toFixed(2)}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Apertura: ${Number(session.opening_amount_usd).toFixed(2)} + Ventas:{' '}
                      ${Number(sessionSummary.cash_flow.sales_usd).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Montos contados */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">
                  Montos Contados Físicamente
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monto Contado en Bs <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="999999999.99"
                        {...register('counted_bs', { valueAsNumber: true })}
                        className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold ${
                          errors.counted_bs ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="0.00"
                        disabled={isLoading}
                      />
                    </div>
                    {errors.counted_bs && (
                      <p className="mt-1 text-sm text-red-600">{errors.counted_bs.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monto Contado en USD <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="999999999.99"
                        {...register('counted_usd', { valueAsNumber: true })}
                        className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold ${
                          errors.counted_usd ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="0.00"
                        disabled={isLoading}
                      />
                    </div>
                    {errors.counted_usd && (
                      <p className="mt-1 text-sm text-red-600">{errors.counted_usd.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Diferencias en tiempo real */}
              {countedBs !== undefined &&
                countedUsd !== undefined &&
                !isNaN(countedBs) &&
                !isNaN(countedUsd) && (
                  <div
                    className={`rounded-lg p-4 border ${
                      hasLargeDifference
                        ? 'bg-red-50 border-red-200'
                        : hasDifference
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-green-50 border-green-200'
                    }`}
                  >
                    <h3 className="text-sm font-semibold mb-3 flex items-center">
                      {hasDifference ? (
                        <AlertTriangle
                          className={`w-4 h-4 mr-2 ${
                            hasLargeDifference ? 'text-red-600' : 'text-orange-600'
                          }`}
                        />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                      )}
                      Diferencias
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Diferencia en Bs</p>
                        <p
                          className={`text-xl font-bold ${
                            hasLargeDifference
                              ? 'text-red-900'
                              : hasDifference
                              ? 'text-orange-900'
                              : 'text-green-900'
                          }`}
                        >
                          {differenceBs >= 0 ? '+' : ''}
                          {differenceBs.toFixed(2)} Bs
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Diferencia en USD</p>
                        <p
                          className={`text-xl font-bold ${
                            hasLargeDifference
                              ? 'text-red-900'
                              : hasDifference
                              ? 'text-orange-900'
                              : 'text-green-900'
                          }`}
                        >
                          {differenceUsd >= 0 ? '+' : ''}
                          {differenceUsd.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {hasLargeDifference && (
                      <p className="text-xs text-red-700 mt-3 font-medium">
                        ⚠️ Advertencia: Diferencias significativas detectadas. Se requerirá
                        confirmación adicional.
                      </p>
                    )}
                  </div>
                )}

              {/* Nota */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nota (Opcional)
                </label>
                <textarea
                  {...register('note')}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base resize-none"
                  placeholder="Observaciones sobre el cierre, diferencias, etc..."
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {confirmStep === 2 && (
            <div className="space-y-6">
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 sm:p-6">
                <div className="flex items-start mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-bold text-red-900 mb-2">
                      Diferencias Significativas Detectadas
                    </h3>
                    <p className="text-sm text-red-800">
                      Has ingresado montos que difieren significativamente de los montos esperados.
                      Por favor, revisa cuidadosamente:
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Esperado vs Contado (Bs)</p>
                      <div className="flex items-baseline justify-between">
                        <span className="text-base text-gray-700">{expectedBs.toFixed(2)} Bs</span>
                        <span className="text-2xl font-bold text-red-600">
                          {differenceBs >= 0 ? '+' : ''}
                          {differenceBs.toFixed(2)} Bs
                        </span>
                      </div>
                      <p className="text-lg font-semibold text-gray-900 mt-2">
                        {countedBs.toFixed(2)} Bs
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Esperado vs Contado (USD)</p>
                      <div className="flex items-baseline justify-between">
                        <span className="text-base text-gray-700">
                          ${expectedUsd.toFixed(2)}
                        </span>
                        <span className="text-2xl font-bold text-red-600">
                          {differenceUsd >= 0 ? '+' : ''}
                          {differenceUsd.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-lg font-semibold text-gray-900 mt-2">
                        ${countedUsd.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded">
                  <p className="text-sm text-yellow-900 font-medium">
                    ¿Estás seguro de que estos montos son correctos? Verifica físicamente el dinero
                    antes de continuar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {confirmStep === 3 && (
            <div className="space-y-6">
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 sm:p-6">
                <div className="flex items-start mb-4">
                  <CheckCircle2 className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-bold text-blue-900 mb-2">
                      Confirmación Final Requerida
                    </h3>
                    <p className="text-sm text-blue-800">
                      Estás a punto de cerrar la caja. Este proceso es{' '}
                      <strong>IRREVERSIBLE</strong>. Por favor, confirma que todos los datos son
                      correctos:
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Apertura</p>
                    <p className="text-sm text-gray-700">
                      {Number(session.opening_amount_bs).toFixed(2)} Bs / $
                      {Number(session.opening_amount_usd).toFixed(2)} USD
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Ventas en Efectivo</p>
                    <p className="text-sm text-gray-700">
                      {Number(sessionSummary.cash_flow.sales_bs).toFixed(2)} Bs / $
                      {Number(sessionSummary.cash_flow.sales_usd).toFixed(2)} USD
                    </p>
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-xs text-gray-500 mb-1">Esperado</p>
                    <p className="text-lg font-bold text-gray-900">
                      {expectedBs.toFixed(2)} Bs / ${expectedUsd.toFixed(2)} USD
                    </p>
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-xs text-gray-500 mb-1">Contado</p>
                    <p className="text-lg font-bold text-blue-600">
                      {countedBs.toFixed(2)} Bs / ${countedUsd.toFixed(2)} USD
                    </p>
                  </div>
                  {hasDifference && (
                    <div
                      className={`border-t pt-4 ${
                        hasLargeDifference ? 'bg-red-50 -mx-4 px-4 py-3 rounded' : 'bg-orange-50 -mx-4 px-4 py-3 rounded'
                      }`}
                    >
                      <p className="text-xs text-gray-600 mb-1">Diferencia</p>
                      <p
                        className={`text-lg font-bold ${
                          hasLargeDifference ? 'text-red-700' : 'text-orange-700'
                        }`}
                      >
                        {differenceBs >= 0 ? '+' : ''}
                        {differenceBs.toFixed(2)} Bs / {differenceUsd >= 0 ? '+' : ''}
                        {differenceUsd.toFixed(2)} USD
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-gray-200 px-4 py-4 mt-6 bg-white rounded-b-lg flex gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 px-4 py-2.5 sm:py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors touch-manipulation disabled:opacity-50"
              disabled={isLoading}
            >
              {confirmStep === 1 ? 'Cancelar' : 'Atrás'}
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-2.5 sm:py-3 rounded-lg font-medium transition-colors touch-manipulation disabled:opacity-50 flex items-center justify-center ${
                confirmStep === 3
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Cerrando...
                </>
              ) : confirmStep === 3 ? (
                <>
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Confirmar y Cerrar Caja
                </>
              ) : (
                <>
                  Continuar
                  <X className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

