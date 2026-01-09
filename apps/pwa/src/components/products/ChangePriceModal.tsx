import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { productsService, Product } from '@/services/products.service'
import { exchangeService } from '@/services/exchange.service'
import { useAuth } from '@/stores/auth.store'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ChangePriceModalProps {
  isOpen: boolean
  onClose: () => void
  product: Product | null
  onSuccess?: () => void
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
  onSuccess,
}: ChangePriceModalProps) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(priceSchema) as any,
    defaultValues: {
      price_bs: 0,
      price_usd: 0,
      rounding: 'none',
    },
  })

  // Obtener tasa BCV para cálculo automático (usa cache del prefetch)
  const { data: bcvRateData } = useQuery({
    queryKey: ['exchange', 'bcv'],
    queryFn: () => exchangeService.getBCVRate(),
    staleTime: 1000 * 60 * 60 * 2, // 2 horas
    gcTime: Infinity, // Nunca eliminar
    enabled: isOpen,
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

  // Obtener storeId del usuario autenticado
  const { user } = useAuth()

  const changePriceMutation = useMutation({
    mutationFn: (data: PriceFormData) =>
      productsService.changePrice(product!.id, {
        price_usd: data.price_usd,
        price_bs: data.price_bs ?? 0,
        rounding: data.rounding,
      }, user?.store_id),
    onSuccess: () => {
      toast.success('Precio actualizado exitosamente')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'status'] })
      onSuccess?.()
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-1 sm:p-4">
      <Card className="max-w-md w-full max-h-[85vh] sm:max-h-[90vh] flex flex-col border border-border">
        {/* Header */}
        <CardHeader className="flex-shrink-0 border-b border-border px-3 sm:px-4 py-2 sm:py-3 flex flex-row items-center justify-between rounded-t-lg">
          <CardTitle className="text-lg sm:text-xl">
            Cambiar Precio
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

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit as any)}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <CardContent className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 overscroll-contain">
            {/* Información del producto */}
            <Card className="bg-muted/50 border border-border">
              <CardContent className="p-3 sm:p-4">
                <p className="text-sm text-muted-foreground mb-1">Producto:</p>
                <p className="font-semibold text-foreground">{product.name}</p>
              </CardContent>
            </Card>

            {/* Precio USD */}
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
                <p className="mt-1 text-xs sm:text-sm text-destructive">
                  {errors.price_usd.message}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {bcvRateData?.available && bcvRateData.rate
                  ? `Se calcula automáticamente en Bs usando tasa BCV: ${bcvRateData.rate}`
                  : 'El precio en Bs se calculará automáticamente'}
              </p>
            </div>

            {/* Precio Bs (Calculado automáticamente) */}
            <div>
              <Label htmlFor="price_bs" className="text-sm font-semibold">
                Precio Bs <span className="text-destructive">*</span>
                <span className="text-xs font-normal text-muted-foreground ml-2">(Calculado automáticamente)</span>
              </Label>
              <Input
                id="price_bs"
                type="number"
                step="0.01"
                {...register('price_bs', { valueAsNumber: true })}
                className="mt-2 text-base bg-muted cursor-not-allowed"
                placeholder="0.00"
                readOnly
              />
              {errors.price_bs && (
                <p className="mt-1 text-xs sm:text-sm text-destructive">
                  {errors.price_bs.message}
                </p>
              )}
            </div>

            {/* Redondeo */}
            <div>
              <Label htmlFor="rounding" className="text-sm font-semibold">
                Redondeo (opcional)
              </Label>
              <Select
                value={watch('rounding') || 'none'}
                onValueChange={(value) => setValue('rounding', value as 'none' | '0.1' | '0.5' | '1')}
              >
                <SelectTrigger id="rounding" className="mt-2">
                  <SelectValue placeholder="Selecciona redondeo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin redondeo</SelectItem>
                  <SelectItem value="0.1">0.1</SelectItem>
                  <SelectItem value="0.5">0.5</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Aplicar redondeo a los precios después del cambio
              </p>
            </div>
          </CardContent>

          {/* Botones */}
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
                {isLoading ? 'Actualizando...' : 'Actualizar Precio'}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  )
}

