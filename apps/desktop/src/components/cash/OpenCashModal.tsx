import { useState } from 'react'
import { X, DollarSign, Lock } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { OpenCashSessionRequest } from '@/services/cash.service'

const openCashSchema = z.object({
  cash_bs: z
    .number({ message: 'El monto en Bs es requerido' })
    .min(0, 'El monto en Bs no puede ser negativo')
    .max(999999999.99, 'El monto en Bs excede el límite máximo'),
  cash_usd: z
    .number({ message: 'El monto en USD es requerido' })
    .min(0, 'El monto en USD no puede ser negativo')
    .max(999999999.99, 'El monto en USD excede el límite máximo'),
  note: z.string().optional(),
})

interface OpenCashModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: OpenCashSessionRequest) => void
  isLoading: boolean
}

export default function OpenCashModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: OpenCashModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<OpenCashSessionRequest>({
    resolver: zodResolver(openCashSchema),
    defaultValues: {
      cash_bs: 0,
      cash_usd: 0,
      note: '',
    },
  })

  const onSubmit = (data: OpenCashSessionRequest) => {
    // Redondear a 2 decimales
    const roundedData = {
      ...data,
      cash_bs: Math.round(data.cash_bs * 100) / 100,
      cash_usd: Math.round(data.cash_usd * 100) / 100,
    }
    onConfirm(roundedData)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 sm:py-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center">
            <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 mr-2" />
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Abrir Caja</h2>
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
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <p className="text-sm text-blue-800">
                Ingresa los montos de apertura de caja. Estos valores deben coincidir con el dinero
                físico disponible en la caja.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto de Apertura en Bs <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="999999999.99"
                  {...register('cash_bs', { valueAsNumber: true })}
                  className={`w-full pl-10 pr-4 py-2.5 sm:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base ${
                    errors.cash_bs ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                  disabled={isLoading}
                />
              </div>
              {errors.cash_bs && (
                <p className="mt-1 text-sm text-red-600">{errors.cash_bs.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto de Apertura en USD <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="999999999.99"
                  {...register('cash_usd', { valueAsNumber: true })}
                  className={`w-full pl-10 pr-4 py-2.5 sm:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base ${
                    errors.cash_usd ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                  disabled={isLoading}
                />
              </div>
              {errors.cash_usd && (
                <p className="mt-1 text-sm text-red-600">{errors.cash_usd.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nota (opcional)
              </label>
              <textarea
                {...register('note')}
                rows={3}
                className="w-full px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base resize-none"
                placeholder="Observaciones sobre la apertura..."
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-gray-200 px-4 py-4 mt-6 bg-white rounded-b-lg flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 sm:py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors touch-manipulation disabled:opacity-50"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors touch-manipulation disabled:opacity-50 flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Abriendo...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5 mr-2" />
                  Abrir Caja
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

