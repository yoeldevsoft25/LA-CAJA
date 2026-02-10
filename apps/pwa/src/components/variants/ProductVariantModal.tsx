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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
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

    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0 border-l border-border shadow-2xl">
        <SheetHeader className="px-5 py-4 border-b border-border flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SheetTitle className="text-xl font-semibold flex items-center">
            <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-3" />
            {variant ? 'Editar Variante' : 'Agregar Variante'}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {variant ? 'Edita los datos de la variante' : 'Crea una nueva variante para el producto'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 bg-background">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-6 space-y-6">
            <Alert className="bg-primary/5 border-primary/20 p-4">
              <AlertDescription className="text-sm text-foreground/90 leading-relaxed">
                Las variantes permiten gestionar diferentes versiones de un producto (tallas,
                colores, etc.) con precios y stock independientes.
              </AlertDescription>
            </Alert>

            <div className="space-y-5">
              {/* Tipo de variante */}
              <div>
                <Label htmlFor="variant_type" className="text-sm font-medium mb-1.5 block">
                  Tipo de Variante <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={variantType}
                  onValueChange={(value) => setValue('variant_type', value)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-10">
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
                    className="mt-2 h-10"
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
                <Label htmlFor="variant_value" className="text-sm font-medium mb-1.5 block">
                  Valor de Variante <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="variant_value"
                  {...register('variant_value')}
                  className="h-10"
                  placeholder="Ej: M, L, XL, Rojo, Azul, etc."
                  maxLength={100}
                  disabled={isLoading}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Separa con comas para crear múltiples (ej: S, M, L)
                </p>
                {errors.variant_value && (
                  <p className="mt-1 text-sm text-destructive">{errors.variant_value.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* SKU */}
                <div>
                  <Label htmlFor="sku" className="text-sm font-medium mb-1.5 block">SKU (Opcional)</Label>
                  <Input
                    id="sku"
                    {...register('sku')}
                    className="h-10 font-mono text-sm"
                    placeholder="Código SKU"
                    disabled={isLoading}
                  />
                  {errors.sku && <p className="mt-1 text-sm text-destructive">{errors.sku.message}</p>}
                </div>

                {/* Código de barras */}
                <div>
                  <Label htmlFor="barcode" className="text-sm font-medium mb-1.5 block">Código de Barras</Label>
                  <Input
                    id="barcode"
                    {...register('barcode')}
                    className="h-10 font-mono text-sm"
                    placeholder="EAN / UPC / Code128"
                    disabled={isLoading}
                  />
                  {errors.barcode && (
                    <p className="mt-1 text-sm text-destructive">{errors.barcode.message}</p>
                  )}
                </div>
              </div>

              {/* Precios (opcionales) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                <div>
                  <Label htmlFor="price_bs" className="text-sm font-medium mb-1.5 block">Precio Bs (Opcional)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Bs.</span>
                    <Input
                      id="price_bs"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('price_bs', {
                        valueAsNumber: true,
                        setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
                      })}
                      className="pl-9 h-10"
                      placeholder="Heredar del producto"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.price_bs && (
                    <p className="mt-1 text-sm text-destructive">{errors.price_bs.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="price_usd" className="text-sm font-medium mb-1.5 block">Precio USD (Opcional)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      id="price_usd"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('price_usd', {
                        valueAsNumber: true,
                        setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
                      })}
                      className="pl-7 h-10"
                      placeholder="Heredar del producto"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.price_usd && (
                    <p className="mt-1 text-sm text-destructive">{errors.price_usd.message}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-border/50">
                    💡 Si dejas los precios vacíos, se usarán los precios del producto principal.
                  </p>
                </div>
              </div>

              {/* Activo */}
              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active" className="text-base font-medium">
                    Variante Activa
                  </Label>
                  <p className="text-sm text-muted-foreground max-w-[280px]">
                    Si está desactivada, no aparecerá en el POS ni en el catálogo
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
          <div className="flex-shrink-0 border-t border-border px-5 py-4 bg-muted/10 backdrop-blur-sm">
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 h-11"
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {variant ? 'Guardar Cambios' : 'Crear Variante'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

