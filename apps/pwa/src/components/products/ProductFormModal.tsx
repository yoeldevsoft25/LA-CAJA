import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X, Search, Scale, Package, Coffee, Apple, Beef, Shirt, Home, Cpu, Pill, ShoppingBag, Monitor } from 'lucide-react'
import { productsService, Product } from '@/services/products.service'
import { exchangeService } from '@/services/exchange.service'
import { suppliersService } from '@/services/suppliers.service'
import { supplierPriceListsService, SupplierPriceListItem } from '@/services/supplier-price-lists.service'
import toast from '@/lib/toast'
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
import { Badge } from '@/components/ui/badge'

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
  cost_per_weight_bs: z.number().min(0).nullable().optional(),
  cost_per_weight_usd: z.number().min(0).nullable().optional(),
  min_weight: z.number().min(0).nullable().optional(),
  max_weight: z.number().min(0).nullable().optional(),
  scale_plu: z.string().nullable().optional(),
  scale_department: z.number().min(1).nullable().optional(),
})

type ProductFormData = z.infer<typeof productSchema>
type WeightUnit = 'kg' | 'g' | 'lb' | 'oz'

const WEIGHT_UNIT_TO_KG: Record<WeightUnit, number> = {
  kg: 1,
  g: 0.001,
  lb: 0.45359237,
  oz: 0.028349523125,
}

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

interface ProductFormModalProps {
  isOpen: boolean
  onClose: () => void
  product?: Product | null
  templateProduct?: Product | null // Producto template para duplicar (pre-llena el formulario en modo creación)
  onSuccess?: () => void
}

export default function ProductFormModal({
  isOpen,
  onClose,
  product,
  templateProduct,
  onSuccess,
}: ProductFormModalProps) {
  const isEditing = !!product && !!product.id
  const productToUse = product || templateProduct

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
    setValue,
    getValues,
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
      cost_per_weight_bs: null,
      cost_per_weight_usd: null,
    },
  })
  const [supplierPriceSearch, setSupplierPriceSearch] = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [applySupplierPriceToSale, setApplySupplierPriceToSale] = useState(false)

  // Obtener tasa BCV para cálculo automático (usa cache del prefetch)
  // Carga inmediata porque es ligera y necesaria para cálculos
  const { data: bcvRateData } = useQuery({
    queryKey: ['exchange', 'bcv'],
    queryFn: () => exchangeService.getBCVRate(),
    staleTime: 1000 * 60 * 60 * 2, // 2 horas
    gcTime: Infinity, // Nunca eliminar
    enabled: isOpen,
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersService.getAll(),
    staleTime: 1000 * 60 * 5,
    enabled: isOpen,
  })

  const {
    data: supplierPriceLookup,
    isLoading: isLoadingSupplierPrices,
    error: supplierPriceError,
  } = useQuery({
    queryKey: ['supplier-price-items', selectedSupplierId, supplierPriceSearch],
    queryFn: () =>
      supplierPriceListsService.searchItems({
        supplier_id: selectedSupplierId,
        search: supplierPriceSearch.trim(),
        limit: 20,
      }),
    enabled:
      isOpen &&
      Boolean(selectedSupplierId) &&
      supplierPriceSearch.trim().length >= 2,
    staleTime: 1000 * 60 * 2,
    retry: false,
  })

  // Observar cambios en price_usd y cost_usd para calcular automáticamente los valores en Bs
  const priceUsd = useWatch({ control, name: 'price_usd' })
  const costUsd = useWatch({ control, name: 'cost_usd' })
  const priceBs = useWatch({ control, name: 'price_bs' })
  const costBs = useWatch({ control, name: 'cost_bs' })
  const isWeightProduct = useWatch({ control, name: 'is_weight_product' })
  const pricePerWeightUsd = useWatch({ control, name: 'price_per_weight_usd' })
  const costPerWeightUsd = useWatch({ control, name: 'cost_per_weight_usd' })
  const pricePerWeightBs = useWatch({ control, name: 'price_per_weight_bs' })
  const costPerWeightBs = useWatch({ control, name: 'cost_per_weight_bs' })
  const weightUnit = useWatch({ control, name: 'weight_unit' })

  const safeNumber = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0

  // Memoizar cálculos de profit y margin para evitar recálculos innecesarios
  const priceUsdValue = useMemo(() => safeNumber(priceUsd), [priceUsd])
  const costUsdValue = useMemo(() => safeNumber(costUsd), [costUsd])
  const priceBsValue = useMemo(() => safeNumber(priceBs), [priceBs])
  const costBsValue = useMemo(() => safeNumber(costBs), [costBs])

  const profitUsd = useMemo(() => priceUsdValue - costUsdValue, [priceUsdValue, costUsdValue])
  const profitBs = useMemo(() => priceBsValue - costBsValue, [priceBsValue, costBsValue])

  const marginPercent = useMemo(
    () => (priceUsdValue > 0 ? (profitUsd / priceUsdValue) * 100 : 0),
    [priceUsdValue, profitUsd]
  )

  const markupPercent = useMemo(
    () => (costUsdValue > 0 ? (profitUsd / costUsdValue) * 100 : 0),
    [costUsdValue, profitUsd]
  )

  const weightPriceUsdValue = useMemo(() => safeNumber(pricePerWeightUsd), [pricePerWeightUsd])
  const weightCostUsdValue = useMemo(() => safeNumber(costPerWeightUsd), [costPerWeightUsd])
  const weightPriceBsValue = useMemo(() => safeNumber(pricePerWeightBs), [pricePerWeightBs])
  const weightCostBsValue = useMemo(() => safeNumber(costPerWeightBs), [costPerWeightBs])

  const weightProfitUsd = useMemo(
    () => weightPriceUsdValue - weightCostUsdValue,
    [weightPriceUsdValue, weightCostUsdValue]
  )
  const weightProfitBs = useMemo(
    () => weightPriceBsValue - weightCostBsValue,
    [weightPriceBsValue, weightCostBsValue]
  )

  const weightMarginPercent = useMemo(
    () => (weightPriceUsdValue > 0 ? (weightProfitUsd / weightPriceUsdValue) * 100 : 0),
    [weightPriceUsdValue, weightProfitUsd]
  )

  const weightMarkupPercent = useMemo(
    () => (weightCostUsdValue > 0 ? (weightProfitUsd / weightCostUsdValue) * 100 : 0),
    [weightCostUsdValue, weightProfitUsd]
  )

  const previousWeightUnitRef = useRef<WeightUnit | null>(null)
  const weightUnitInitializedRef = useRef(false)

  const weightPriceDecimals =
    weightUnit === 'g' || weightUnit === 'oz' ? 4 : 2
  const weightPriceStep =
    weightUnit === 'g' || weightUnit === 'oz' ? '0.0001' : '0.01'

  // Handlers para cálculo bidireccional
  const handlePriceUsdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.valueAsNumber || parseFloat(e.target.value)
    setValue('price_usd', value, { shouldValidate: true })

    if (bcvRateData?.available && bcvRateData.rate && !isNaN(value)) {
      const calculatedBs = Math.round((value * bcvRateData.rate) * 100) / 100
      setValue('price_bs', calculatedBs, { shouldValidate: true })
    }
  }

  const handlePriceBsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.valueAsNumber || parseFloat(e.target.value)
    setValue('price_bs', value, { shouldValidate: true })

    if (bcvRateData?.available && bcvRateData.rate && !isNaN(value) && bcvRateData.rate > 0) {
      const calculatedUsd = Math.round((value / bcvRateData.rate) * 100) / 100
      setValue('price_usd', calculatedUsd, { shouldValidate: true })
    }
  }

  const handleCostUsdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.valueAsNumber || parseFloat(e.target.value)
    setValue('cost_usd', value, { shouldValidate: true })

    if (bcvRateData?.available && bcvRateData.rate && !isNaN(value)) {
      const calculatedBs = Math.round((value * bcvRateData.rate) * 100) / 100
      setValue('cost_bs', calculatedBs, { shouldValidate: true })
    }
  }

  const handleCostBsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.valueAsNumber || parseFloat(e.target.value)
    setValue('cost_bs', value, { shouldValidate: true })

    if (bcvRateData?.available && bcvRateData.rate && !isNaN(value) && bcvRateData.rate > 0) {
      const calculatedUsd = Math.round((value / bcvRateData.rate) * 100) / 100
      setValue('cost_usd', calculatedUsd, { shouldValidate: true })
    }
  }

  // Handlers para peso (similares)
  const handleWeightPriceUsdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.valueAsNumber || parseFloat(e.target.value)
    setValue('price_per_weight_usd', value, { shouldValidate: true })

    if (bcvRateData?.available && bcvRateData.rate && !isNaN(value)) {
      const calculatedBs = roundTo(value * bcvRateData.rate, weightPriceDecimals)
      setValue('price_per_weight_bs', calculatedBs, { shouldValidate: true })
    }
  }

  const handleWeightPriceBsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.valueAsNumber || parseFloat(e.target.value)
    setValue('price_per_weight_bs', value, { shouldValidate: true })

    if (bcvRateData?.available && bcvRateData.rate && !isNaN(value) && bcvRateData.rate > 0) {
      const calculatedUsd = roundTo(value / bcvRateData.rate, weightPriceDecimals)
      setValue('price_per_weight_usd', calculatedUsd, { shouldValidate: true })
    }
  }

  const handleWeightCostUsdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.valueAsNumber || parseFloat(e.target.value)
    setValue('cost_per_weight_usd', value, { shouldValidate: true })

    if (bcvRateData?.available && bcvRateData.rate && !isNaN(value)) {
      const calculatedBs = roundTo(value * bcvRateData.rate, weightPriceDecimals)
      setValue('cost_per_weight_bs', calculatedBs, { shouldValidate: true })
    }
  }

  const handleWeightCostBsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.valueAsNumber || parseFloat(e.target.value)
    setValue('cost_per_weight_bs', value, { shouldValidate: true })

    if (bcvRateData?.available && bcvRateData.rate && !isNaN(value) && bcvRateData.rate > 0) {
      const calculatedUsd = roundTo(value / bcvRateData.rate, weightPriceDecimals)
      setValue('cost_per_weight_usd', calculatedUsd, { shouldValidate: true })
    }
  }

  useEffect(() => {
    if (!isOpen) {
      previousWeightUnitRef.current = null
      weightUnitInitializedRef.current = false
      return
    }

    const currentUnit = (weightUnit || 'kg') as WeightUnit

    if (!isWeightProduct) {
      previousWeightUnitRef.current = currentUnit
      return
    }

    if (!weightUnitInitializedRef.current) {
      previousWeightUnitRef.current = currentUnit
      weightUnitInitializedRef.current = true
      return
    }

    const previousUnit = previousWeightUnitRef.current
    if (!previousUnit || previousUnit === currentUnit) {
      previousWeightUnitRef.current = currentUnit
      return
    }

    const previousToKg = WEIGHT_UNIT_TO_KG[previousUnit]
    const currentToKg = WEIGHT_UNIT_TO_KG[currentUnit]
    const priceFactor = currentToKg / previousToKg
    const weightFactor = previousToKg / currentToKg

    const currentPriceUsd = getValues('price_per_weight_usd')
    if (currentPriceUsd !== null && currentPriceUsd !== undefined && !Number.isNaN(currentPriceUsd)) {
      setValue(
        'price_per_weight_usd',
        roundTo(currentPriceUsd * priceFactor, 6),
        { shouldValidate: false },
      )
    }

    const currentPriceBs = getValues('price_per_weight_bs')
    if (currentPriceBs !== null && currentPriceBs !== undefined && !Number.isNaN(currentPriceBs)) {
      setValue(
        'price_per_weight_bs',
        roundTo(currentPriceBs * priceFactor, 6),
        { shouldValidate: false },
      )
    }

    const currentCostUsd = getValues('cost_per_weight_usd')
    if (currentCostUsd !== null && currentCostUsd !== undefined && !Number.isNaN(currentCostUsd)) {
      setValue(
        'cost_per_weight_usd',
        roundTo(currentCostUsd * priceFactor, 6),
        { shouldValidate: false },
      )
    }

    const currentCostBs = getValues('cost_per_weight_bs')
    if (currentCostBs !== null && currentCostBs !== undefined && !Number.isNaN(currentCostBs)) {
      setValue(
        'cost_per_weight_bs',
        roundTo(currentCostBs * priceFactor, 6),
        { shouldValidate: false },
      )
    }

    const currentMinWeight = getValues('min_weight')
    if (currentMinWeight !== null && currentMinWeight !== undefined && !Number.isNaN(currentMinWeight)) {
      setValue(
        'min_weight',
        roundTo(currentMinWeight * weightFactor, 3),
        { shouldValidate: false },
      )
    }

    const currentMaxWeight = getValues('max_weight')
    if (currentMaxWeight !== null && currentMaxWeight !== undefined && !Number.isNaN(currentMaxWeight)) {
      setValue(
        'max_weight',
        roundTo(currentMaxWeight * weightFactor, 3),
        { shouldValidate: false },
      )
    }

    previousWeightUnitRef.current = currentUnit
  }, [getValues, isOpen, isWeightProduct, setValue, weightUnit])

  // Limpiar formulario cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      setSupplierPriceSearch('')
      setSelectedSupplierId('')
      setApplySupplierPriceToSale(false)
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
        cost_per_weight_bs: null,
        cost_per_weight_usd: null,
        min_weight: null,
        max_weight: null,
        scale_plu: null,
        scale_department: null,
      })
      return
    }
  }, [isOpen, reset])

  // Cargar datos del producto si está en modo edición o duplicando
  useEffect(() => {
    if (!isOpen) return

    if (productToUse) {
      reset({
        name: productToUse.name,
        category: productToUse.category || '',
        sku: productToUse.sku || '',
        barcode: productToUse.barcode || '',
        price_bs: Number(productToUse.price_bs),
        price_usd: Number(productToUse.price_usd),
        cost_bs: Number(productToUse.cost_bs),
        cost_usd: Number(productToUse.cost_usd),
        low_stock_threshold: productToUse.low_stock_threshold || 0,
        is_weight_product: productToUse.is_weight_product || false,
        weight_unit: productToUse.weight_unit || null,
        price_per_weight_bs: productToUse.price_per_weight_bs
          ? Number(productToUse.price_per_weight_bs)
          : null,
        price_per_weight_usd: productToUse.price_per_weight_usd
          ? Number(productToUse.price_per_weight_usd)
          : null,
        cost_per_weight_bs: productToUse.cost_per_weight_bs
          ? Number(productToUse.cost_per_weight_bs)
          : null,
        cost_per_weight_usd: productToUse.cost_per_weight_usd
          ? Number(productToUse.cost_per_weight_usd)
          : null,
        min_weight: productToUse.min_weight ? Number(productToUse.min_weight) : null,
        max_weight: productToUse.max_weight ? Number(productToUse.max_weight) : null,
        scale_plu: productToUse.scale_plu || null,
        scale_department: productToUse.scale_department || null,
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
        cost_per_weight_bs: null,
        cost_per_weight_usd: null,
        min_weight: null,
        max_weight: null,
        scale_plu: null,
        scale_department: null,
      })
    }
  }, [isOpen, productToUse, reset])

  useEffect(() => {
    if (!isOpen) return

    previousWeightUnitRef.current = (product?.weight_unit || 'kg') as WeightUnit
    weightUnitInitializedRef.current = false
  }, [isOpen, product?.id])

  // Obtener storeId del usuario autenticado
  const { user } = useAuth()

  // Mutación para crear/actualizar
  const createMutation = useMutation({
    mutationFn: (data: Partial<Product>) => productsService.create(data, user?.store_id, {
      userId: user?.user_id,
      userRole: user?.role
    }),
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
    mutationFn: (data: Partial<Product>) => productsService.update(product!.id, data, user?.store_id, {
      userId: user?.user_id,
      userRole: user?.role
    }),
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
        is_weight_product: data.is_weight_product || false,
        weight_unit: data.is_weight_product ? (data.weight_unit || null) : null,
        price_per_weight_bs: data.is_weight_product
          ? (data.price_per_weight_bs || null)
          : null,
        price_per_weight_usd: data.is_weight_product
          ? (data.price_per_weight_usd || null)
          : null,
        cost_per_weight_bs: data.is_weight_product
          ? (data.cost_per_weight_bs || null)
          : null,
        cost_per_weight_usd: data.is_weight_product
          ? (data.cost_per_weight_usd || null)
          : null,
        min_weight: data.is_weight_product ? (data.min_weight || null) : null,
        max_weight: data.is_weight_product ? (data.max_weight || null) : null,
        scale_plu: data.is_weight_product ? (data.scale_plu || null) : null,
        scale_department: data.is_weight_product ? (data.scale_department || null) : null,
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
        cost_per_weight_bs: data.is_weight_product
          ? (data.cost_per_weight_bs || null)
          : null,
        cost_per_weight_usd: data.is_weight_product
          ? (data.cost_per_weight_usd || null)
          : null,
        min_weight: data.is_weight_product ? (data.min_weight || null) : null,
        max_weight: data.is_weight_product ? (data.max_weight || null) : null,
        scale_plu: data.is_weight_product ? (data.scale_plu || null) : null,
        scale_department: data.is_weight_product ? (data.scale_department || null) : null,
      }
      createMutation.mutate(createData)
    }
  }

  const formatSupplierPrice = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return null
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed.toFixed(4)
  }

  // Función para obtener icono de categoría (similar a POSPage)
  const getCategoryIcon = useCallback((category?: string | null) => {
    if (!category) return Package
    const normalized = category.toLowerCase()

    if (normalized.includes('bebida') || normalized.includes('drink') || normalized.includes('refresco')) {
      return Coffee
    }
    if (normalized.includes('fruta') || normalized.includes('verdura') || normalized.includes('vegetal')) {
      return Apple
    }
    if (normalized.includes('carne') || normalized.includes('pollo') || normalized.includes('proteina')) {
      return Beef
    }
    if (normalized.includes('ropa') || normalized.includes('vestir') || normalized.includes('moda')) {
      return Shirt
    }
    if (normalized.includes('hogar') || normalized.includes('casa')) {
      return Home
    }
    if (normalized.includes('electron') || normalized.includes('tecno') || normalized.includes('gadget')) {
      return Cpu
    }
    if (normalized.includes('farmacia') || normalized.includes('salud') || normalized.includes('medic')) {
      return Pill
    }
    if (normalized.includes('accesorio') || normalized.includes('general')) {
      return ShoppingBag
    }

    return Package
  }, [])

  // Función para obtener decimales de precio por peso
  const getWeightPriceDecimals = useCallback((unit?: string | null) => {
    return unit === 'g' || unit === 'oz' ? 4 : 2
  }, [])

  // Obtener valores del formulario para el preview
  const watchedValues = useWatch({ control })
  const previewProduct = useMemo(() => {
    return {
      name: watchedValues.name || 'Nombre del producto',
      category: watchedValues.category || null,
      barcode: watchedValues.barcode || null,
      is_weight_product: watchedValues.is_weight_product || false,
      weight_unit: watchedValues.weight_unit || 'kg',
      price_usd: Number(watchedValues.price_usd) || 0,
      price_bs: Number(watchedValues.price_bs) || 0,
      price_per_weight_usd: Number(watchedValues.price_per_weight_usd) || 0,
      price_per_weight_bs: Number(watchedValues.price_per_weight_bs) || 0,
    }
  }, [watchedValues])

  const handleApplySupplierPrice = (
    item: SupplierPriceListItem,
    tier: 'A' | 'B'
  ) => {
    const unitPriceRaw = tier === 'A' ? item.unit_price_a : item.unit_price_b
    const unitPrice = unitPriceRaw != null ? Number(unitPriceRaw) : 0

    if (!unitPrice || Number.isNaN(unitPrice)) {
      toast.error('El precio seleccionado no es válido')
      return
    }

    const currency = supplierPriceLookup?.list.currency || 'USD'
    const exchangeRate = bcvRateData?.rate || 36
    const priceUsd = currency === 'USD' ? unitPrice : unitPrice / exchangeRate
    const priceBs = currency === 'USD' ? unitPrice * exchangeRate : unitPrice

    const costUsd = roundTo(priceUsd, 2)
    const costBs = roundTo(priceBs, 2)

    setValue('cost_usd', costUsd, { shouldValidate: true })
    setValue('cost_bs', costBs, { shouldValidate: true })

    if (applySupplierPriceToSale) {
      setValue('price_usd', costUsd, { shouldValidate: true })
      setValue('price_bs', costBs, { shouldValidate: true })
    }

    const currentName = getValues('name')
    if (!currentName || !currentName.trim()) {
      setValue('name', item.product_name, { shouldValidate: true })
    }

    const currentSku = getValues('sku')
    if (!currentSku && item.product_code) {
      setValue('sku', item.product_code, { shouldValidate: false })
    }

    setSupplierPriceSearch('')
    toast.success(`Precio aplicado desde lista (${tier})`)
  }

  if (!isOpen) return null

  const isLoading = createMutation.isPending || updateMutation.isPending
  const supplierCurrencySymbol =
    supplierPriceLookup?.list.currency === 'BS' ? 'Bs.' : '$'

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

            {/* Lista de precios de proveedor */}
            <div className="rounded-lg border border-border p-3 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Lista de precios de proveedor</p>
                  <p className="text-xs text-muted-foreground">
                    Busca en listas importadas para completar los costos automáticamente.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="apply_supplier_price_to_sale"
                    checked={applySupplierPriceToSale}
                    onCheckedChange={setApplySupplierPriceToSale}
                  />
                  <Label htmlFor="apply_supplier_price_to_sale" className="text-xs">
                    Aplicar también como precio de venta
                  </Label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold">Proveedor</Label>
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecciona un proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Buscar en lista</Label>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={supplierPriceSearch}
                      onChange={(event) => setSupplierPriceSearch(event.target.value)}
                      className="pl-9"
                      placeholder="Código o nombre del producto"
                      disabled={!selectedSupplierId}
                    />
                  </div>
                  {!selectedSupplierId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selecciona un proveedor para buscar.
                    </p>
                  )}
                </div>
              </div>

              {selectedSupplierId && supplierPriceSearch.trim().length >= 2 && (
                <div className="rounded-md border border-border max-h-52 overflow-y-auto">
                  {isLoadingSupplierPrices ? (
                    <div className="p-3 text-sm text-muted-foreground">Buscando precios...</div>
                  ) : supplierPriceError ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      No hay listas de precios para este proveedor.
                    </div>
                  ) : supplierPriceLookup?.items.length ? (
                    supplierPriceLookup.items.map((item) => {
                      const priceA = formatSupplierPrice(item.unit_price_a)
                      const priceB = formatSupplierPrice(item.unit_price_b)
                      return (
                        <div key={item.id} className="flex items-start justify-between gap-3 p-3 border-b last:border-b-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground break-words">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">Código: {item.product_code}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              A: {priceA ? `${supplierCurrencySymbol} ${priceA}` : 'N/A'} · B:{' '}
                              {priceB ? `${supplierCurrencySymbol} ${priceB}` : 'N/A'}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            {priceA && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleApplySupplierPrice(item, 'A')}
                              >
                                Aplicar A
                              </Button>
                            )}
                            {priceB && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleApplySupplierPrice(item, 'B')}
                              >
                                Aplicar B
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="p-3 text-sm text-muted-foreground">No se encontraron resultados.</div>
                  )}
                </div>
              )}

              {supplierPriceLookup?.list && (
                <p className="text-xs text-muted-foreground">
                  Lista activa: {supplierPriceLookup.list.name} · Moneda {supplierPriceLookup.list.currency}
                </p>
              )}
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
                  inputMode="decimal"
                  step="0.01"
                  {...register('price_bs', { valueAsNumber: true, onChange: handlePriceBsChange })}
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
                  inputMode="decimal"
                  step="0.01"
                  {...register('price_usd', { valueAsNumber: true, onChange: handlePriceUsdChange })}
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
                  inputMode="decimal"
                  step="0.01"
                  {...register('cost_usd', { valueAsNumber: true, onChange: handleCostUsdChange })}
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
                </Label>
                <Input
                  id="cost_bs"
                  type="number"
                  step="0.01"
                  {...register('cost_bs', { valueAsNumber: true, onChange: handleCostBsChange })}
                  className="mt-2 text-base"
                  placeholder="0.00"
                />
                {errors.cost_bs && (
                  <p className="mt-1 text-xs sm:text-sm text-destructive">{errors.cost_bs.message}</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 sm:p-4 bg-muted/40">
              <p className="text-sm font-semibold text-foreground">Preview de margen de ganancia</p>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Utilidad</span>
                  <div className="flex flex-col items-end">
                    <span className={`font-semibold ${profitUsd >= 0 ? 'text-success' : 'text-destructive'}`}>
                      ${profitUsd.toFixed(2)} USD
                    </span>
                    <span className={`text-[10px] leading-tight ${profitBs >= 0 ? 'text-success/80' : 'text-destructive/80'}`}>
                      {profitBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Rentabilidad</span>
                  <div className="flex flex-col items-end">
                    <span className={`font-semibold ${profitUsd >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {marginPercent.toFixed(1)}% (Margen)
                    </span>
                    <span className={`text-[10px] leading-tight ${profitUsd >= 0 ? 'text-success/80' : 'text-destructive/80'}`}>
                      {markupPercent.toFixed(1)}% (Markup)
                    </span>
                  </div>
                </div>
              </div>
              {isWeightProduct && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Util. por peso</span>
                    <div className="flex flex-col items-end">
                      <span className={`font-semibold ${weightProfitUsd >= 0 ? 'text-success' : 'text-destructive'}`}>
                        ${weightProfitUsd.toFixed(2)} USD
                      </span>
                      <span className={`text-[10px] leading-tight ${weightProfitBs >= 0 ? 'text-success/80' : 'text-destructive/80'}`}>
                        {weightProfitBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Rent. por peso</span>
                    <div className="flex flex-col items-end">
                      <span className={`font-semibold ${weightProfitUsd >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {weightMarginPercent.toFixed(1)}% (M)
                      </span>
                      <span className={`text-[10px] leading-tight ${weightProfitUsd >= 0 ? 'text-success/80' : 'text-destructive/80'}`}>
                        {weightMarkupPercent.toFixed(1)}% (U)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Umbral de stock bajo */}
            <div>
              <Label htmlFor="low_stock_threshold" className="text-sm font-semibold">
                Umbral de Stock Bajo
              </Label>
              <Input
                id="low_stock_threshold"
                type="number"
                inputMode="numeric"
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
                      Precio por Peso USD ({weightUnit || 'kg'})
                      <span className="text-destructive"> *</span>
                    </Label>
                    <Input
                      id="price_per_weight_usd"
                      type="number"
                      inputMode="decimal"
                      step={weightPriceStep}
                      {...register('price_per_weight_usd', { valueAsNumber: true, onChange: handleWeightPriceUsdChange })}
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
                      Precio por Peso Bs ({weightUnit || 'kg'})
                      <span className="text-destructive"> *</span>
                    </Label>
                    <Input
                      id="price_per_weight_bs"
                      type="number"
                      step={weightPriceStep}
                      {...register('price_per_weight_bs', { valueAsNumber: true, onChange: handleWeightPriceBsChange })}
                      className="mt-2 text-base"
                      placeholder="0.00"
                    />
                    {errors.price_per_weight_bs && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.price_per_weight_bs.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Costo por peso */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cost_per_weight_usd" className="text-sm font-semibold">
                      Costo por Peso USD ({weightUnit || 'kg'})
                    </Label>
                    <Input
                      id="cost_per_weight_usd"
                      type="number"
                      inputMode="decimal"
                      step={weightPriceStep}
                      {...register('cost_per_weight_usd', { valueAsNumber: true, onChange: handleWeightCostUsdChange })}
                      className="mt-2 text-base"
                      placeholder="0.00"
                    />
                    {errors.cost_per_weight_usd && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.cost_per_weight_usd.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="cost_per_weight_bs" className="text-sm font-semibold">
                      Costo por Peso Bs ({weightUnit || 'kg'})
                    </Label>
                    <Input
                      id="cost_per_weight_bs"
                      type="number"
                      step={weightPriceStep}
                      {...register('cost_per_weight_bs', { valueAsNumber: true, onChange: handleWeightCostBsChange })}
                      className="mt-2 text-base"
                      placeholder="0.00"
                    />
                    {errors.cost_per_weight_bs && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.cost_per_weight_bs.message}
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
                      inputMode="decimal"
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
                      inputMode="decimal"
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
                      inputMode="numeric"
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

            {/* Preview de cómo se ve en POS */}
            {previewProduct.name && previewProduct.name !== 'Nombre del producto' && (
              <div className="px-3 sm:px-4 md:px-6 pb-4 sm:pb-6">
                <Separator className="my-4" />
                <div className="rounded-lg border border-border p-3 sm:p-4 bg-muted/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Monitor className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Vista Previa en POS</p>
                  </div>
                  <div className="p-3 bg-background rounded-lg border border-border">
                    <div className="flex items-start justify-between gap-3 min-w-0">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base text-foreground break-words leading-snug flex items-center gap-1.5">
                          {previewProduct.is_weight_product && (
                            <Scale className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          )}
                          {previewProduct.category && (() => {
                            const CategoryIcon = getCategoryIcon(previewProduct.category)
                            return <CategoryIcon className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0" />
                          })()}
                          {previewProduct.name}
                        </h3>
                        {previewProduct.category && (
                          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                            {previewProduct.category}
                          </p>
                        )}
                        {previewProduct.barcode && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 truncate font-mono">
                            {previewProduct.barcode}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {previewProduct.is_weight_product && previewProduct.price_per_weight_usd > 0 ? (
                          <>
                            <Badge variant="secondary" className="mb-1 text-[10px] sm:text-xs">
                              Precio por {previewProduct.weight_unit || 'kg'}
                            </Badge>
                            <p className="font-bold text-base sm:text-lg text-foreground">
                              ${previewProduct.price_per_weight_usd.toFixed(getWeightPriceDecimals(previewProduct.weight_unit))}/{previewProduct.weight_unit}
                            </p>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              Bs. {previewProduct.price_per_weight_bs.toFixed(getWeightPriceDecimals(previewProduct.weight_unit))}/{previewProduct.weight_unit}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-bold text-base sm:text-lg text-foreground">
                              ${previewProduct.price_usd.toFixed(2)}
                            </p>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              Bs. {previewProduct.price_bs.toFixed(2)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
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
