import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { productsService, Product } from '@/services/products.service'
import { exchangeService } from '@/services/exchange.service'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-1 sm:p-4">
      <Card className="max-w-2xl w-full max-h-[85vh] sm:max-h-[90vh] flex flex-col border border-border">
        {/* Header - Fijo */}
        <CardHeader className="flex-shrink-0 border-b border-border px-3 sm:px-4 py-2 sm:py-3 flex flex-row items-center justify-between rounded-t-lg">
          <CardTitle className="text-lg sm:text-xl">
            {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>

        {/* Contenido - Scrollable */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <CardContent className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 overscroll-contain">
          {/* Nombre */}
          <div>
            <Label htmlFor="name" className="text-sm font-semibold">
              Nombre del Producto <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              {...register('name')}
              className="mt-2 text-base"
              placeholder="Ej: Coca Cola 350ml"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Categoría y SKU */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category" className="text-sm font-semibold">Categoría</Label>
              <Input
                id="category"
                type="text"
                {...register('category')}
                className="mt-2 text-base"
                placeholder="Ej: Bebidas"
              />
            </div>
            <div>
              <Label htmlFor="sku" className="text-sm font-semibold">SKU</Label>
              <Input
                id="sku"
                type="text"
                {...register('sku')}
                className="mt-2 text-base"
                placeholder="Código SKU"
              />
            </div>
          </div>

          {/* Código de Barras */}
          <div>
            <Label htmlFor="barcode" className="text-sm font-semibold">Código de Barras</Label>
            <Input
              id="barcode"
              type="text"
              {...register('barcode')}
              className="mt-2 text-base"
              placeholder="Ej: 7801234567890"
            />
          </div>

          {/* Precios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price_bs" className="text-sm font-semibold">
                Precio Bs <span className="text-destructive">*</span>
              </Label>
              <Input
                id="price_bs"
                type="number"
                step="0.01"
                {...register('price_bs', { valueAsNumber: true })}
                className="mt-2 text-base"
                placeholder="0.00"
              />
              {errors.price_bs && (
                <p className="mt-1 text-xs sm:text-sm text-destructive">{errors.price_bs.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="price_usd" className="text-sm font-semibold">
                Precio USD <span className="text-destructive">*</span>
              </Label>
              <Input
                id="price_usd"
                type="number"
                step="0.01"
                {...register('price_usd', { valueAsNumber: true })}
                className="mt-2 text-base"
                placeholder="0.00"
              />
              {errors.price_usd && (
                <p className="mt-1 text-sm text-destructive">{errors.price_usd.message}</p>
              )}
            </div>
          </div>

          {/* Costos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cost_usd" className="text-sm font-semibold">
                Costo USD <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cost_usd"
                type="number"
                step="0.01"
                {...register('cost_usd', { valueAsNumber: true })}
                className="mt-2 text-base"
                placeholder="0.00"
              />
              {errors.cost_usd && (
                <p className="mt-1 text-sm text-destructive">{errors.cost_usd.message}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {bcvRateData?.available && bcvRateData.rate
                  ? `Se calcula automáticamente en Bs usando tasa BCV: ${bcvRateData.rate}`
                  : 'El costo en Bs se calculará automáticamente'}
              </p>
            </div>
            <div>
              <Label htmlFor="cost_bs" className="text-sm font-semibold">
                Costo Bs <span className="text-destructive">*</span>
                <span className="text-xs font-normal text-muted-foreground ml-2">(Calculado automáticamente)</span>
              </Label>
              <Input
                id="cost_bs"
                type="number"
                step="0.01"
                {...register('cost_bs', { valueAsNumber: true })}
                className="mt-2 text-base bg-muted cursor-not-allowed"
                placeholder="0.00"
                readOnly
              />
              {errors.cost_bs && (
                <p className="mt-1 text-xs sm:text-sm text-destructive">{errors.cost_bs.message}</p>
              )}
            </div>
          </div>

          {/* Umbral de stock bajo */}
          <div>
            <Label htmlFor="low_stock_threshold" className="text-sm font-semibold">
              Umbral de Stock Bajo
            </Label>
            <Input
              id="low_stock_threshold"
              type="number"
              step="1"
              {...register('low_stock_threshold', { valueAsNumber: true })}
              className="mt-2 text-base"
              placeholder="0"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Se mostrará una alerta cuando el stock esté por debajo de este valor
            </p>
          </div>
          </CardContent>

          {/* Botones - Fijos en la parte inferior */}
          <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4 rounded-b-lg">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading
                  ? 'Guardando...'
                  : isEditing
                    ? 'Actualizar Producto'
                    : 'Crear Producto'}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  )
}
