import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { inventoryService, StockAdjustedRequest, StockStatus } from '@/services/inventory.service'
import { X } from 'lucide-react'

interface StockAdjustModalProps {
  isOpen: boolean
  onClose: () => void
  product: StockStatus | null
  onSuccess?: () => void
}

const stockAdjustSchema = z.object({
  qty_delta: z.preprocess(
    (val) => Number(val),
    z.number().refine((val) => val !== 0, 'La cantidad debe ser diferente de 0')
  ),
  reason: z.enum(['loss', 'damage', 'count', 'other']),
  note: z.string().optional(),
})

type StockAdjustForm = z.infer<typeof stockAdjustSchema>

const reasonLabels = {
  loss: 'Pérdida',
  damage: 'Daño',
  count: 'Conteo',
  other: 'Otro',
}

export default function StockAdjustModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: StockAdjustModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<StockAdjustForm>({
    // @ts-ignore - zodResolver tiene problemas de tipos con Zod v4
    resolver: zodResolver(stockAdjustSchema),
    defaultValues: {
      qty_delta: 0,
      reason: 'other',
      note: '',
    },
  })

  const qtyDelta = watch('qty_delta')

  // Calcular stock resultante
  const resultingStock = product ? product.current_stock + (qtyDelta || 0) : 0

  useEffect(() => {
    if (isOpen) {
      reset({
        qty_delta: 0,
        reason: 'other',
        note: '',
      })
    }
  }, [isOpen, reset])

  const stockAdjustMutation = useMutation({
    mutationFn: (data: StockAdjustedRequest) => {
      if (!product) throw new Error('Producto no seleccionado')
      return inventoryService.stockAdjusted({
        ...data,
        product_id: product.product_id,
      })
    },
    onSuccess: () => {
      toast.success('Stock ajustado exitosamente')
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al ajustar stock')
    },
  })

  const onSubmit = (data: StockAdjustForm) => {
    if (!product) return
    stockAdjustMutation.mutate({
      product_id: product.product_id,
      qty_delta: data.qty_delta,
      reason: data.reason,
      note: data.note,
    })
  }

  if (!isOpen || !product) return null

  const isLoading = stockAdjustMutation.isPending

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Ajustar Stock</h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        {/* @ts-ignore - handleSubmit tiene problemas de tipos */}
        <form onSubmit={handleSubmit(onSubmit as any)} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
            {/* Información del producto */}
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
              <p className="text-sm text-gray-600 mb-1">Producto:</p>
              <p className="font-semibold text-gray-900">{product.product_name}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Stock actual:</span>
                  <span className="ml-2 font-bold text-gray-900">{product.current_stock}</span>
                </div>
                <div>
                  <span className="text-gray-600">Stock resultante:</span>
                  <span
                    className={`ml-2 font-bold ${
                      resultingStock < 0
                        ? 'text-red-600'
                        : resultingStock === product.current_stock
                          ? 'text-gray-500'
                          : 'text-blue-600'
                    }`}
                  >
                    {resultingStock}
                  </span>
                </div>
              </div>
              {resultingStock < 0 && (
                <p className="mt-2 text-xs text-red-600">
                  ⚠️ El stock resultante será negativo
                </p>
              )}
            </div>

            {/* Cantidad delta */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ajuste de Cantidad <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="1"
                {...register('qty_delta', { valueAsNumber: true })}
                className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej: -5 (reducir) o +3 (aumentar)"
              />
              {errors.qty_delta && (
                <p className="mt-1 text-sm text-red-600">{errors.qty_delta.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Usa valores positivos para aumentar y negativos para reducir el stock
              </p>
            </div>

            {/* Razón */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Razón del Ajuste <span className="text-red-500">*</span>
              </label>
              <select
                {...register('reason')}
                className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.entries(reasonLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Nota */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Nota</label>
              <textarea
                {...register('note')}
                rows={3}
                className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Descripción del ajuste (opcional)"
              />
            </div>
          </div>

          {/* Botones */}
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
                disabled={isLoading || qtyDelta === 0 || resultingStock < 0}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-purple-600 text-white rounded-lg font-semibold text-sm sm:text-base hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors touch-manipulation"
              >
                {isLoading ? 'Ajustando...' : 'Ajustar Stock'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

