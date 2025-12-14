import { useState, useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { productsService, Product } from '@/services/products.service'
import { exchangeService } from '@/services/exchange.service'
import { X } from 'lucide-react'

interface ChangePriceModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null
}

const priceSchema = z.object({
  price_usd: z.preprocess(
    (val) => Number(val),
    z.number().min(0, 'El precio en USD no puede ser negativo')
  ),
  price_bs: z.preprocess(
    (val) => Number(val),
    z.number().min(0, 'El precio en Bs no puede ser negativo')
  ).optional(), // Opcional porque se calcula automáticamente
  rounding: z.enum(['none', '0.1', '0.5', '1']).optional(),
})

type PriceFormData = z.infer<typeof priceSchema>

export default function ChangePriceModal({
  isOpen,
  onClose,
  product,
}: ChangePriceModalProps) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<PriceFormData>({
    // @ts-ignore - zodResolver tiene problemas de tipos con Zod v4
    resolver: zodResolver(priceSchema),
    defaultValues: {
      price_bs: 0,
      price_usd: 0,
      rounding: 'none',
    },
  })

  // Obtener tasa BCV para cálculo automático
  const { data: bcvRateData } = useQuery({
    queryKey: ['bcvRate'],
    queryFn: () => exchangeService.getBCVRate(),
    enabled: isOpen,
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  // Observar cambios en price_usd para calcular automáticamente price_bs
  const priceUsd = useWatch({ control, name: 'price_usd' })

  // Calcular automáticamente price_bs cuando cambia price_usd
  useEffect(() => {
    if (bcvRateData?.available && bcvRateData.rate && priceUsd !== undefined && priceUsd !== null) {
      // Redondear a 2 decimales
      const calculatedPriceBs = Math.round((priceUsd * bcvRateData.rate) * 100) / 100
      setValue('price_bs', calculatedPriceBs, { shouldValidate: false })
    }
  }, [priceUsd, bcvRateData, setValue])

  useEffect(() => {
    if (product) {
      reset({
        price_usd: Number(product.price_usd),
        price_bs: Number(product.price_bs),
        rounding: 'none',
      })
    }
  }, [product, reset])

  const changePriceMutation = useMutation({
    mutationFn: (data: PriceFormData) =>
      productsService.changePrice(product!.id, {
        price_usd: data.price_usd,
        price_bs: data.price_bs ?? 0, // Asegurar que siempre hay un valor
        rounding: data.rounding,
      }),
    onSuccess: () => {
      toast.success('Precio actualizado exitosamente')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      onClose()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar el precio')
    },
  })

  const onSubmit = (data: PriceFormData) => {
    // Solo enviar price_usd, el backend calculará price_bs usando la tasa BCV
    changePriceMutation.mutate({
      price_usd: data.price_usd,
      rounding: data.rounding,
      // No enviar price_bs, el backend lo calculará
    })
  }

  if (!isOpen || !product) return null

  const isLoading = changePriceMutation.isPending

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            Cambiar Precio
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
            {/* Información del producto */}
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
              <p className="text-sm text-gray-600 mb-1">Producto:</p>
              <p className="font-semibold text-gray-900">{product.name}</p>
            </div>

            {/* Precio USD */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Precio USD <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                {...register('price_usd', { valueAsNumber: true })}
                className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
              {errors.price_usd && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">
                  {errors.price_usd.message}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {bcvRateData?.available && bcvRateData.rate
                  ? `Se calcula automáticamente en Bs usando tasa BCV: ${bcvRateData.rate}`
                  : 'El precio en Bs se calculará automáticamente'}
              </p>
            </div>

            {/* Precio Bs (Calculado automáticamente) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Precio Bs <span className="text-red-500">*</span>
                <span className="text-xs font-normal text-gray-500 ml-2">(Calculado automáticamente)</span>
              </label>
              <input
                type="number"
                step="0.01"
                {...register('price_bs', { valueAsNumber: true })}
                className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                placeholder="0.00"
                readOnly
              />
              {errors.price_bs && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">
                  {errors.price_bs.message}
                </p>
              )}
            </div>

            {/* Redondeo */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Redondeo (opcional)
              </label>
              <select
                {...register('rounding')}
                className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="none">Sin redondeo</option>
                <option value="0.1">0.1</option>
                <option value="0.5">0.5</option>
                <option value="1">1</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Aplicar redondeo a los precios después del cambio
              </p>
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
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm sm:text-base hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors touch-manipulation"
              >
                {isLoading ? 'Actualizando...' : 'Actualizar Precio'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

