import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { productsService, Product } from '@/services/products.service'
import { exchangeService } from '@/services/exchange.service'
import toast from 'react-hot-toast'

const productSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  category: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  price_bs: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
  price_usd: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
  cost_bs: z.number().min(0, 'El costo debe ser mayor o igual a 0'),
  cost_usd: z.number().min(0, 'El costo debe ser mayor o igual a 0'),
  low_stock_threshold: z.number().min(0, 'El umbral debe ser mayor o igual a 0').optional(),
})

type ProductFormData = z.infer<typeof productSchema>

interface ProductFormModalProps {
  isOpen: boolean
  onClose: () => void
  product?: Product | null
  onSuccess?: () => void
}

export default function ProductFormModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: ProductFormModalProps) {
  const isEditing = !!product

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
    setValue,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      category: '',
      sku: '',
      barcode: '',
      price_bs: 0,
      price_usd: 0,
      cost_bs: 0,
      cost_usd: 0,
      low_stock_threshold: 0,
    },
  })

  // Obtener tasa BCV para cálculo automático
  const { data: bcvRateData } = useQuery({
    queryKey: ['bcvRate'],
    queryFn: () => exchangeService.getBCVRate(),
    enabled: isOpen,
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  // Observar cambios en price_usd y cost_usd para calcular automáticamente los valores en Bs
  const priceUsd = useWatch({ control, name: 'price_usd' })
  const costUsd = useWatch({ control, name: 'cost_usd' })

  // Calcular automáticamente price_bs y cost_bs cuando cambian los valores USD
  useEffect(() => {
    if (bcvRateData?.available && bcvRateData.rate) {
      const exchangeRate = bcvRateData.rate
      
      if (priceUsd !== undefined && priceUsd !== null) {
        // Redondear a 2 decimales
        const calculatedPriceBs = Math.round((priceUsd * exchangeRate) * 100) / 100
        setValue('price_bs', calculatedPriceBs, { shouldValidate: false })
      }
      
      if (costUsd !== undefined && costUsd !== null) {
        // Redondear a 2 decimales
        const calculatedCostBs = Math.round((costUsd * exchangeRate) * 100) / 100
        setValue('cost_bs', calculatedCostBs, { shouldValidate: false })
      }
    }
  }, [priceUsd, costUsd, bcvRateData, setValue])

  // Cargar datos del producto si está en modo edición
  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        category: product.category || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        price_bs: Number(product.price_bs),
        price_usd: Number(product.price_usd),
        cost_bs: Number(product.cost_bs),
        cost_usd: Number(product.cost_usd),
        low_stock_threshold: product.low_stock_threshold || 0,
      })
    } else {
      reset({
        name: '',
        category: '',
        sku: '',
        barcode: '',
        price_bs: 0,
        price_usd: 0,
        cost_bs: 0,
        cost_usd: 0,
        low_stock_threshold: 0,
      })
    }
  }, [product, reset])

  // Mutación para crear/actualizar
  const createMutation = useMutation({
    mutationFn: productsService.create,
    onSuccess: () => {
      toast.success('Producto creado exitosamente')
      onSuccess?.()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al crear el producto'
      toast.error(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Product>) => productsService.update(product!.id, data),
    onSuccess: () => {
      toast.success('Producto actualizado exitosamente')
      onSuccess?.()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al actualizar el producto'
      toast.error(message)
    },
  })

  const onSubmit = (data: ProductFormData) => {
    if (isEditing) {
      // Al actualizar, solo enviar price_usd y cost_usd, el backend calculará los Bs
      const updateData = {
        ...data,
        // No enviar price_bs ni cost_bs, el backend los calculará desde USD
        price_bs: undefined,
        cost_bs: undefined,
      }
      updateMutation.mutate(updateData)
    } else {
      createMutation.mutate(data)
    }
  }

  if (!isOpen) return null

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header - Fijo */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido - Scrollable */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nombre del Producto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('name')}
              className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej: Coca Cola 350ml"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Categoría y SKU */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Categoría</label>
              <input
                type="text"
                {...register('category')}
                className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej: Bebidas"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">SKU</label>
              <input
                type="text"
                {...register('sku')}
                className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Código SKU"
              />
            </div>
          </div>

          {/* Código de Barras */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Código de Barras</label>
            <input
              type="text"
              {...register('barcode')}
              className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej: 7801234567890"
            />
          </div>

          {/* Precios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Precio Bs <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                {...register('price_bs', { valueAsNumber: true })}
                className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
              {errors.price_bs && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">{errors.price_bs.message}</p>
              )}
            </div>
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
                <p className="mt-1 text-sm text-red-600">{errors.price_usd.message}</p>
              )}
            </div>
          </div>

          {/* Costos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Costo USD <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                {...register('cost_usd', { valueAsNumber: true })}
                className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
              {errors.cost_usd && (
                <p className="mt-1 text-sm text-red-600">{errors.cost_usd.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {bcvRateData?.available && bcvRateData.rate
                  ? `Se calcula automáticamente en Bs usando tasa BCV: ${bcvRateData.rate}`
                  : 'El costo en Bs se calculará automáticamente'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Costo Bs <span className="text-red-500">*</span>
                <span className="text-xs font-normal text-gray-500 ml-2">(Calculado automáticamente)</span>
              </label>
              <input
                type="number"
                step="0.01"
                {...register('cost_bs', { valueAsNumber: true })}
                className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                placeholder="0.00"
                readOnly
              />
              {errors.cost_bs && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">{errors.cost_bs.message}</p>
              )}
            </div>
          </div>

          {/* Umbral de stock bajo */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Umbral de Stock Bajo
            </label>
            <input
              type="number"
              step="1"
              {...register('low_stock_threshold', { valueAsNumber: true })}
              className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0"
            />
            <p className="mt-1 text-xs text-gray-500">
              Se mostrará una alerta cuando el stock esté por debajo de este valor
            </p>
          </div>
          </div>

          {/* Botones - Fijos en la parte inferior */}
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
                {isLoading
                  ? 'Guardando...'
                  : isEditing
                    ? 'Actualizar Producto'
                    : 'Crear Producto'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
