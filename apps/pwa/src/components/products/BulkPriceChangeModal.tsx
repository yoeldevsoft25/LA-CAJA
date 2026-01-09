import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { productsService, Product } from '@/services/products.service'
import { exchangeService } from '@/services/exchange.service'
import { X, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface BulkPriceChangeModalProps {
  isOpen: boolean
  onClose: () => void
  products: Product[]
  onSuccess?: () => void
}

export default function BulkPriceChangeModal({
  isOpen,
  onClose,
  products,
  onSuccess,
}: BulkPriceChangeModalProps) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'percentage' | 'bcv'>('percentage') // Modo: porcentaje o tasa BCV
  const [category, setCategory] = useState<string>('')
  const [percentageChange, setPercentageChange] = useState<string>('')
  const [bcvRate, setBcvRate] = useState<string>('') // Tasa del BCV
  const [rounding, setRounding] = useState<'none' | '0.1' | '0.5' | '1'>('none')
  const [error, setError] = useState<string>('')

  // Obtener tasa BCV automáticamente
  const {
    data: bcvData,
    isLoading: isLoadingBCV,
    refetch: refetchBCV,
  } = useQuery({
    queryKey: ['bcv-rate'],
    queryFn: () => exchangeService.getBCVRate(),
    enabled: mode === 'bcv', // Solo buscar cuando el modo es BCV
    staleTime: 1000 * 60 * 60, // Cache de 1 hora
  })

  // Cuando se obtiene la tasa automáticamente, prellenar el input
  useEffect(() => {
    if (mode === 'bcv' && bcvData?.available && bcvData.rate) {
      setBcvRate(bcvData.rate.toString())
    }
  }, [bcvData, mode])

  // Obtener categorías únicas de los productos
  const categories = Array.from(
    new Set(products.filter((p) => p.category).map((p) => p.category))
  ).filter((c): c is string => c !== null)

  const bulkPriceChangeMutation = useMutation({
    mutationFn: productsService.bulkPriceChange,
    onSuccess: (data) => {
      toast.success(`Precios actualizados exitosamente: ${data.updated} productos`)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'status'] })
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-status'] })
      onSuccess?.()
      onClose()
      // Reset form
      setCategory('')
      setPercentageChange('')
      setBcvRate('')
      setRounding('none')
      setError('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar precios')
      setError(error.response?.data?.message || 'Error al actualizar precios')
    },
  })

  const handleSubmit = () => {
    setError('')

    if (!category) {
      setError('Debes seleccionar una categoría')
      return
    }

    // Contar productos en la categoría
    const productsInCategory =
      category === 'TODAS'
        ? products.filter((p) => p.is_active)
        : products.filter((p) => p.category === category && p.is_active)

    if (productsInCategory.length === 0) {
      setError('No hay productos activos')
      return
    }

    if (mode === 'percentage') {
      // Modo porcentaje
      if (!percentageChange) {
        setError('Debes ingresar un porcentaje de cambio')
        return
      }

      const percentage = parseFloat(percentageChange)
      if (isNaN(percentage)) {
        setError('El porcentaje debe ser un número válido')
        return
      }

      bulkPriceChangeMutation.mutate({
        category,
        percentage_change: percentage,
        rounding,
      })
    } else {
      // Modo tasa BCV
      if (!bcvRate) {
        setError('Debes ingresar la tasa del BCV')
        return
      }

      const rate = parseFloat(bcvRate)
      if (isNaN(rate) || rate <= 0) {
        setError('La tasa del BCV debe ser un número válido mayor a 0')
        return
      }

      // Calcular nuevos precios en Bs basados en USD * tasa BCV
      const items = productsInCategory.map((product) => {
        let newPriceBs = Number(product.price_usd) * rate
        
        // Aplicar redondeo si es necesario
        if (rounding === '0.1') {
          newPriceBs = Math.round(newPriceBs * 10) / 10
        } else if (rounding === '0.5') {
          newPriceBs = Math.round(newPriceBs * 2) / 2
        } else if (rounding === '1') {
          newPriceBs = Math.round(newPriceBs)
        } else {
          // Redondear a 2 decimales por defecto
          newPriceBs = Math.round(newPriceBs * 100) / 100
        }
        
        return {
          product_id: product.id,
          price_bs: newPriceBs,
          // Mantener el precio en USD igual (redondeado a 2 decimales)
          price_usd: Math.round(Number(product.price_usd) * 100) / 100,
        }
      })

      bulkPriceChangeMutation.mutate({
        items,
        rounding,
      })
    }
  }

  if (!isOpen) return null

  const isLoading = bulkPriceChangeMutation.isPending

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-1 sm:p-4">
      <Card className="max-w-md w-full max-h-[85vh] sm:max-h-[90vh] flex flex-col border border-border">
        {/* Header */}
        <CardHeader className="flex-shrink-0 border-b border-border px-3 sm:px-4 py-2 sm:py-3 flex flex-row items-center justify-between rounded-t-lg">
          <CardTitle className="text-lg sm:text-xl">
            Cambio Masivo de Precios
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

        {/* Content */}
        <CardContent className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 overscroll-contain">
          {/* Selector de modo */}
          <div>
            <Label className="text-sm font-semibold mb-2">
              Tipo de Cambio
            </Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Button
                type="button"
                variant={mode === 'percentage' ? 'default' : 'outline'}
                onClick={() => {
                  setMode('percentage')
                  setError('')
                }}
                className="p-3"
              >
                <p className="text-sm font-medium">Por Porcentaje</p>
              </Button>
              <Button
                type="button"
                variant={mode === 'bcv' ? 'default' : 'outline'}
                onClick={() => {
                  setMode('bcv')
                  setError('')
                }}
                className="p-3"
              >
                <p className="text-sm font-medium">Tasa BCV</p>
              </Button>
            </div>
          </div>

          {/* Info según modo */}
          {mode === 'percentage' ? (
            <Card className="bg-info/5 border border-info/50">
              <CardContent className="p-3 sm:p-4">
                <p className="text-sm text-foreground">
                Aplica un cambio porcentual a todos los productos activos de una categoría.
                Ejemplo: +10 para aumentar 10%, -5 para reducir 5%
              </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-success/5 border border-success/50">
              <CardContent className="p-3 sm:p-4">
                <p className="text-sm text-foreground">
                Actualiza los precios en Bs usando la tasa del Banco Central de Venezuela.
                Los precios en USD se mantienen iguales, los precios en Bs se calculan como: USD × Tasa BCV
              </p>
              </CardContent>
            </Card>
          )}

          {/* Categoría */}
          <div>
            <Label htmlFor="category" className="text-sm font-semibold">
              Categoría <span className="text-destructive">*</span>
            </Label>
            <Select
              value={category}
              onValueChange={(value) => {
                setCategory(value)
                setError('')
              }}
            >
              <SelectTrigger id="category" className="mt-2">
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">
                Todas ({products.filter((p) => p.is_active).length} productos activos)
                </SelectItem>
              {categories.map((cat) => {
                const count = products.filter(
                  (p) => p.category === cat && p.is_active
                ).length
                return (
                    <SelectItem key={cat} value={cat}>
                    {cat} ({count} productos activos)
                    </SelectItem>
                )
              })}
              </SelectContent>
            </Select>
          </div>

          {/* Porcentaje de cambio o Tasa BCV */}
          {mode === 'percentage' ? (
            <div>
              <Label htmlFor="percentageChange" className="text-sm font-semibold">
                Cambio Porcentual (%) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="percentageChange"
                type="number"
                step="0.1"
                value={percentageChange}
                onChange={(e) => {
                  setPercentageChange(e.target.value)
                  setError('')
                }}
                className="mt-2 text-base"
                placeholder="Ej: 10 (aumentar 10%) o -5 (reducir 5%)"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Usa valores positivos para aumentar y negativos para reducir
              </p>
            </div>
          ) : (
            <div>
              <Label htmlFor="bcvRate" className="text-sm font-semibold">
                Tasa BCV (Bs/USD) <span className="text-destructive">*</span>
              </Label>
              <div className="relative mt-2">
                <Input
                  id="bcvRate"
                  type="number"
                  step="0.01"
                  value={bcvRate}
                  onChange={(e) => {
                    setBcvRate(e.target.value)
                    setError('')
                  }}
                  className="pr-10 text-base"
                  placeholder={isLoadingBCV ? 'Obteniendo...' : 'Ej: 36.50'}
                  disabled={isLoadingBCV}
                />
                {isLoadingBCV && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                  </div>
                )}
                {!isLoadingBCV && bcvData?.available && bcvData.rate && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <span className="text-xs text-success font-medium">✓ {bcvData.rate}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  {isLoadingBCV
                    ? 'Obteniendo tasa del BCV desde DolarAPI...'
                    : bcvData?.available && bcvData.rate
                      ? `✓ Tasa obtenida automáticamente: ${bcvData.rate}`
                      : 'Ingrese la tasa o use el botón para obtenerla automáticamente'}
                </p>
                {!isLoadingBCV && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => refetchBCV()}
                    className="h-auto p-1 text-xs"
                    title="Obtener tasa automáticamente"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Actualizar
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Redondeo */}
          <div>
            <Label htmlFor="rounding" className="text-sm font-semibold">
              Redondeo (opcional)
            </Label>
            <Select
              value={rounding}
              onValueChange={(value) => setRounding(value as 'none' | '0.1' | '0.5' | '1')}
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
          </div>

          {/* Preview */}
          {category &&
            ((mode === 'percentage' &&
              percentageChange &&
              !isNaN(parseFloat(percentageChange))) ||
              (mode === 'bcv' && bcvRate && !isNaN(parseFloat(bcvRate)) && parseFloat(bcvRate) > 0)) && (
              <Card className="bg-muted/50 border border-border">
                <CardContent className="p-3 sm:p-4">
                  <p className="text-sm font-semibold text-foreground mb-2">
                  Vista previa:
                </p>
                  <p className="text-sm text-foreground">
                  Se actualizarán{' '}
                  <span className="font-semibold">
                    {
                      category === 'TODAS'
                        ? products.filter((p) => p.is_active).length
                        : products.filter(
                            (p) => p.category === category && p.is_active
                          ).length
                    }{' '}
                    productos
                  </span>{' '}
                  {category === 'TODAS' ? (
                    '(todos los productos activos)'
                  ) : (
                    <>de la categoría "{category}"</>
                  )}
                  {mode === 'percentage' ? (
                    <>
                      {' '}con un cambio del{' '}
                      <span className="font-semibold">{percentageChange}%</span>
                    </>
                  ) : (
                    <>
                      {' '}actualizando precios en Bs usando la tasa BCV:{' '}
                      <span className="font-semibold">{bcvRate}</span>
                      <br />
                        <span className="text-xs text-muted-foreground mt-1 block">
                        Ejemplo: Producto con precio USD $1.00 → Nuevo precio Bs:{' '}
                        {(1 * parseFloat(bcvRate)).toFixed(2)}
                      </span>
                    </>
                  )}
                </p>
                </CardContent>
              </Card>
            )}

          {/* Error */}
          {error && (
            <Card className="border border-destructive/50 bg-destructive/5">
              <CardContent className="p-3">
                <p className="text-sm text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}
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
              type="button"
              onClick={handleSubmit}
              disabled={
                isLoading ||
                !category ||
                categories.length === 0 ||
                (mode === 'percentage' && !percentageChange) ||
                (mode === 'bcv' && !bcvRate)
              }
              className="flex-1"
            >
              {isLoading ? 'Actualizando...' : 'Aplicar Cambio'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

