import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Layers, Save } from 'lucide-react'
import {
  ProductVariant,
  CreateProductVariantRequest,
  VariantType,
} from '@/services/product-variants.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'

const variantSchema = z.object({
  variant_type: z.string().min(1, 'El tipo es requerido').max(50, 'Máximo 50 caracteres'),
  variant_value: z.string().min(1, 'El valor es requerido').max(100, 'Máximo 100 caracteres'),
  sku: z.string().max(100).nullable().optional(),
  barcode: z.string().max(100).nullable().optional(),
  price_bs: z.number().min(0).nullable().optional(),
  price_usd: z.number().min(0).nullable().optional(),
  is_active: z.boolean().optional(),
})

type VariantFormData = z.infer<typeof variantSchema>

const variantTypeLabels: Record<VariantType, string> = {
  size: 'Talla',
  color: 'Color',
  material: 'Material',
  style: 'Estilo',
  other: 'Otro',
}

interface ProductVariantModalProps {
  isOpen: boolean
  onClose: () => void
  productId: string
  variant: ProductVariant | null
  onConfirm: (data: CreateProductVariantRequest) => void
  isLoading: boolean
}

export default function ProductVariantModal({
  isOpen,
  onClose,
  productId,
  variant,
  onConfirm,
  isLoading,
}: ProductVariantModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<VariantFormData>({
    resolver: zodResolver(variantSchema),
    defaultValues: {
      variant_type: 'size',
      variant_value: '',
      sku: null,
      barcode: null,
      price_bs: null,
      price_usd: null,
      is_active: true,
    },
  })

  useEffect(() => {
    if (variant) {
      reset({
        variant_type: variant.variant_type,
        variant_value: variant.variant_value,
        sku: variant.sku || null,
        barcode: variant.barcode || null,
        price_bs: variant.price_bs ? Number(variant.price_bs) : null,
        price_usd: variant.price_usd ? Number(variant.price_usd) : null,
        is_active: variant.is_active,
      })
    } else {
      reset({
        variant_type: 'size',
        variant_value: '',
        sku: null,
        barcode: null,
        price_bs: null,
        price_usd: null,
        is_active: true,
      })
    }
  }, [variant, reset])

  const onSubmit = (data: VariantFormData) => {
    const requestData: CreateProductVariantRequest = {
      product_id: productId,
      variant_type: data.variant_type,
      variant_value: data.variant_value,
      sku: data.sku || null,
      barcode: data.barcode || null,
      price_bs: data.price_bs === null || data.price_bs === undefined ? null : data.price_bs,
      price_usd: data.price_usd === null || data.price_usd === undefined ? null : data.price_usd,
      is_active: data.is_active ?? true,
    }
    onConfirm(requestData)
  }

  const variantType = watch('variant_type')

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            {variant ? 'Editar Variante' : 'Agregar Variante'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {variant ? 'Edita los datos de la variante' : 'Crea una nueva variante para el producto'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
            <div className="space-y-4">
              <Alert className="bg-info/5 border-info/50">
                <AlertDescription className="text-sm text-foreground">
                  Las variantes permiten gestionar diferentes versiones de un producto (tallas,
                  colores, etc.) con precios y stock independientes.
                </AlertDescription>
              </Alert>

              {/* Tipo de variante */}
              <div>
                <Label htmlFor="variant_type">
                  Tipo de Variante <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={variantType}
                  onValueChange={(value) => setValue('variant_type', value)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(variantTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
                {variantType === 'custom' && (
                  <Input
                    {...register('variant_type')}
                    className="mt-2"
                    placeholder="Ej: Modelo, Versión, etc."
                    disabled={isLoading}
                  />
                )}
                {errors.variant_type && (
                  <p className="mt-1 text-sm text-destructive">{errors.variant_type.message}</p>
                )}
              </div>

              {/* Valor de variante */}
              <div>
                <Label htmlFor="variant_value">
                  Valor de Variante <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="variant_value"
                  {...register('variant_value')}
                  className="mt-2"
                  placeholder="Ej: M, L, XL, Rojo, Azul, etc."
                  maxLength={100}
                  disabled={isLoading}
                />
                {errors.variant_value && (
                  <p className="mt-1 text-sm text-destructive">{errors.variant_value.message}</p>
                )}
              </div>

              {/* SKU */}
              <div>
                <Label htmlFor="sku">SKU (Opcional)</Label>
                <Input
                  id="sku"
                  {...register('sku')}
                  className="mt-2"
                  placeholder="Código SKU único"
                  disabled={isLoading}
                />
                {errors.sku && <p className="mt-1 text-sm text-destructive">{errors.sku.message}</p>}
              </div>

              {/* Código de barras */}
              <div>
                <Label htmlFor="barcode">Código de Barras (Opcional)</Label>
                <Input
                  id="barcode"
                  {...register('barcode')}
                  className="mt-2"
                  placeholder="Código de barras único"
                  disabled={isLoading}
                />
                {errors.barcode && (
                  <p className="mt-1 text-sm text-destructive">{errors.barcode.message}</p>
                )}
              </div>

              {/* Precios (opcionales) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price_bs">Precio Bs (Opcional)</Label>
                  <Input
                    id="price_bs"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('price_bs', {
                      valueAsNumber: true,
                      setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
                    })}
                    className="mt-2"
                    placeholder="Usa precio del producto base"
                    disabled={isLoading}
                  />
                  {errors.price_bs && (
                    <p className="mt-1 text-sm text-destructive">{errors.price_bs.message}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Si no se especifica, se usa el precio del producto base
                  </p>
                </div>
                <div>
                  <Label htmlFor="price_usd">Precio USD (Opcional)</Label>
                  <Input
                    id="price_usd"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('price_usd', {
                      valueAsNumber: true,
                      setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
                    })}
                    className="mt-2"
                    placeholder="Usa precio del producto base"
                    disabled={isLoading}
                  />
                  {errors.price_usd && (
                    <p className="mt-1 text-sm text-destructive">{errors.price_usd.message}</p>
                  )}
                </div>
              </div>

              {/* Activo */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active" className="text-base">
                    Variante Activa
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Si está desactivada, no aparecerá en el POS
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={watch('is_active')}
                  onCheckedChange={(checked) => setValue('is_active', checked)}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    {variant ? 'Actualizar' : 'Crear'} Variante
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

