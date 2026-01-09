import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { productsService, Product } from '@/services/products.service'
import { exchangeService } from '@/services/exchange.service'
import toast from 'react-hot-toast'
import { useAuth } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

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
  is_weight_product: z.boolean().optional(),
  weight_unit: z.enum(['kg', 'g', 'lb', 'oz']).nullable().optional(),
  price_per_weight_bs: z.number().min(0).nullable().optional(),
  price_per_weight_usd: z.number().min(0).nullable().optional(),
  min_weight: z.number().min(0).nullable().optional(),
  max_weight: z.number().min(0).nullable().optional(),
  scale_plu: z.string().nullable().optional(),
  scale_department: z.number().min(1).nullable().optional(),
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

  // Obtener tasa BCV para cálculo automático (usa cache del prefetch)
  const { data: bcvRateData } = useQuery({
    queryKey: ['exchange', 'bcv'],
    queryFn: () => exchangeService.getBCVRate(),
    staleTime: 1000 * 60 * 60 * 2, // 2 horas
    gcTime: Infinity, // Nunca eliminar
    enabled: isOpen,
  })

  // Observar cambios en price_usd y cost_usd para calcular automáticamente los valores en Bs
  const priceUsd = useWatch({ control, name: 'price_usd' })
  const costUsd = useWatch({ control, name: 'cost_usd' })
  const isWeightProduct = useWatch({ control, name: 'is_weight_product' })
  const pricePerWeightUsd = useWatch({ control, name: 'price_per_weight_usd' })
  const weightUnit = useWatch({ control, name: 'weight_unit' })

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

      // Calcular price_per_weight_bs desde price_per_weight_usd
      if (pricePerWeightUsd !== undefined && pricePerWeightUsd !== null) {
        const calculatedPricePerWeightBs = Math.round((pricePerWeightUsd * exchangeRate) * 100) / 100
        setValue('price_per_weight_bs', calculatedPricePerWeightBs, { shouldValidate: false })
      }
    }
  }, [priceUsd, costUsd, pricePerWeightUsd, bcvRateData, setValue])

  // Limpiar formulario cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
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
        is_weight_product: false,
        weight_unit: null,
        price_per_weight_bs: null,
        price_per_weight_usd: null,
        min_weight: null,
        max_weight: null,
        scale_plu: null,
        scale_department: null,
      })
      return
    }
  }, [isOpen, reset])

  // Cargar datos del producto si está en modo edición
  useEffect(() => {
    if (!isOpen) return
    
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
        is_weight_product: product.is_weight_product || false,
        weight_unit: product.weight_unit || null,
        price_per_weight_bs: product.price_per_weight_bs
          ? Number(product.price_per_weight_bs)
          : null,
        price_per_weight_usd: product.price_per_weight_usd
          ? Number(product.price_per_weight_usd)
          : null,
        min_weight: product.min_weight ? Number(product.min_weight) : null,
        max_weight: product.max_weight ? Number(product.max_weight) : null,
        scale_plu: product.scale_plu || null,
        scale_department: product.scale_department || null,
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
        is_weight_product: false,
        weight_unit: null,
        price_per_weight_bs: null,
        price_per_weight_usd: null,
        min_weight: null,
        max_weight: null,
        scale_plu: null,
        scale_department: null,
      })
    }
  }, [isOpen, product, reset])

  // Obtener storeId del usuario autenticado
  const { user } = useAuth()

  // Mutación para crear/actualizar
  const createMutation = useMutation({
    mutationFn: (data: Partial<Product>) => productsService.create(data, user?.store_id),
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
    mutationFn: (data: Partial<Product>) => productsService.update(product!.id, data, user?.store_id),
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
      // Al actualizar, solo enviar campos permitidos en UpdateProductDto
      const updateData: Partial<Product> = {
        name: data.name,
        category: data.category || null,
        sku: data.sku || null,
        barcode: data.barcode || null,
        price_usd: data.price_usd,
        cost_usd: data.cost_usd,
        low_stock_threshold: data.low_stock_threshold || 0,
        is_active: true,
      }
      updateMutation.mutate(updateData)
    } else {
      // Al crear, enviar todos los campos incluyendo propiedades de peso
      const createData: Partial<Product> = {
        name: data.name,
        category: data.category || null,
        sku: data.sku || null,
        barcode: data.barcode || null,
        price_usd: data.price_usd,
        cost_usd: data.cost_usd,
        low_stock_threshold: data.low_stock_threshold || 0,
        is_weight_product: data.is_weight_product || false,
        weight_unit: data.is_weight_product ? (data.weight_unit || null) : null,
        price_per_weight_bs: data.is_weight_product
          ? (data.price_per_weight_bs || null)
          : null,
        price_per_weight_usd: data.is_weight_product
          ? (data.price_per_weight_usd || null)
          : null,
        min_weight: data.is_weight_product ? (data.min_weight || null) : null,
        max_weight: data.is_weight_product ? (data.max_weight || null) : null,
        scale_plu: data.is_weight_product ? (data.scale_plu || null) : null,
        scale_department: data.is_weight_product ? (data.scale_department || null) : null,
      }
      createMutation.mutate(createData)
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

          <Separator className="my-4" />

          {/* Producto con peso */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is_weight_product" className="text-base font-semibold">
                Producto con Peso
              </Label>
              <p className="text-sm text-muted-foreground">
                Activa esta opción si el producto se vende por peso (ej: carne, frutas, verduras)
              </p>
            </div>
            <Switch
              id="is_weight_product"
              checked={isWeightProduct || false}
              onCheckedChange={(checked) => setValue('is_weight_product', checked)}
              disabled={isLoading}
            />
          </div>

          {/* Campos de peso (solo si is_weight_product está activado) */}
          {isWeightProduct && (
            <div className="space-y-4 border border-primary/20 rounded-lg p-4 bg-primary/5">
              <h3 className="font-semibold text-foreground">Configuración de Peso</h3>

              {/* Unidad de peso */}
              <div>
                <Label htmlFor="weight_unit" className="text-sm font-semibold">
                  Unidad de Peso <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={weightUnit || 'kg'}
                  onValueChange={(value) =>
                    setValue('weight_unit', value as 'kg' | 'g' | 'lb' | 'oz')
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                    <SelectItem value="g">Gramos (g)</SelectItem>
                    <SelectItem value="lb">Libras (lb)</SelectItem>
                    <SelectItem value="oz">Onzas (oz)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Precio por peso */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price_per_weight_usd" className="text-sm font-semibold">
                    Precio por Peso USD <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="price_per_weight_usd"
                    type="number"
                    step="0.01"
                    {...register('price_per_weight_usd', { valueAsNumber: true })}
                    className="mt-2 text-base"
                    placeholder="0.00"
                  />
                  {errors.price_per_weight_usd && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.price_per_weight_usd.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="price_per_weight_bs" className="text-sm font-semibold">
                    Precio por Peso Bs <span className="text-destructive">*</span>
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      (Calculado automáticamente)
                    </span>
                  </Label>
                  <Input
                    id="price_per_weight_bs"
                    type="number"
                    step="0.01"
                    {...register('price_per_weight_bs', { valueAsNumber: true })}
                    className="mt-2 text-base bg-muted cursor-not-allowed"
                    placeholder="0.00"
                    readOnly
                  />
                  {errors.price_per_weight_bs && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.price_per_weight_bs.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Peso mínimo y máximo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min_weight" className="text-sm font-semibold">
                    Peso Mínimo
                  </Label>
                  <Input
                    id="min_weight"
                    type="number"
                    step="0.001"
                    {...register('min_weight', { valueAsNumber: true })}
                    className="mt-2 text-base"
                    placeholder="0.000"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Peso mínimo permitido para la venta
                  </p>
                </div>
                <div>
                  <Label htmlFor="max_weight" className="text-sm font-semibold">
                    Peso Máximo
                  </Label>
                  <Input
                    id="max_weight"
                    type="number"
                    step="0.001"
                    {...register('max_weight', { valueAsNumber: true })}
                    className="mt-2 text-base"
                    placeholder="0.000"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Peso máximo permitido para la venta
                  </p>
                </div>
              </div>

              {/* PLU y Departamento para balanza */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="scale_plu" className="text-sm font-semibold">
                    PLU de Balanza
                  </Label>
                  <Input
                    id="scale_plu"
                    type="text"
                    {...register('scale_plu')}
                    className="mt-2 text-base"
                    placeholder="Ej: 001"
                    maxLength={50}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Código PLU para identificar el producto en la balanza
                  </p>
                </div>
                <div>
                  <Label htmlFor="scale_department" className="text-sm font-semibold">
                    Departamento de Balanza
                  </Label>
                  <Input
                    id="scale_department"
                    type="number"
                    step="1"
                    min="1"
                    {...register('scale_department', { valueAsNumber: true })}
                    className="mt-2 text-base"
                    placeholder="1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Número de departamento para la balanza
                  </p>
                </div>
              </div>
            </div>
          )}
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
