import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { productsService, Product } from '@/services/products.service'
import { exchangeService } from '@/services/exchange.service'
import { X, RefreshCw } from 'lucide-react'

interface BulkPriceChangeModalProps {
  isOpen: boolean
  onClose: () => void
  products: Product[]
}

export default function BulkPriceChangeModal({
  isOpen,
  onClose,
  products,
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between rounded-t-lg">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            Cambio Masivo de Precios
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          {/* Selector de modo */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tipo de Cambio
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('percentage')
                  setError('')
                }}
                className={`p-3 border-2 rounded-lg transition-all ${
                  mode === 'percentage'
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-medium">Por Porcentaje</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('bcv')
                  setError('')
                }}
                className={`p-3 border-2 rounded-lg transition-all ${
                  mode === 'bcv'
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-medium">Tasa BCV</p>
              </button>
            </div>
          </div>

          {/* Info según modo */}
          {mode === 'percentage' ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <p className="text-sm text-blue-900">
                Aplica un cambio porcentual a todos los productos activos de una categoría.
                Ejemplo: +10 para aumentar 10%, -5 para reducir 5%
              </p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
              <p className="text-sm text-green-900">
                Actualiza los precios en Bs usando la tasa del Banco Central de Venezuela.
                Los precios en USD se mantienen iguales, los precios en Bs se calculan como: USD × Tasa BCV
              </p>
            </div>
          )}

          {/* Categoría */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Categoría <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setError('')
              }}
              className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecciona una categoría</option>
              <option value="TODAS">
                Todas ({products.filter((p) => p.is_active).length} productos activos)
              </option>
              {categories.map((cat) => {
                const count = products.filter(
                  (p) => p.category === cat && p.is_active
                ).length
                return (
                  <option key={cat} value={cat}>
                    {cat} ({count} productos activos)
                  </option>
                )
              })}
            </select>
          </div>

          {/* Porcentaje de cambio o Tasa BCV */}
          {mode === 'percentage' ? (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Cambio Porcentual (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                value={percentageChange}
                onChange={(e) => {
                  setPercentageChange(e.target.value)
                  setError('')
                }}
                className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej: 10 (aumentar 10%) o -5 (reducir 5%)"
              />
              <p className="mt-1 text-xs text-gray-500">
                Usa valores positivos para aumentar y negativos para reducir
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tasa BCV (Bs/USD) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={bcvRate}
                  onChange={(e) => {
                    setBcvRate(e.target.value)
                    setError('')
                  }}
                  className="w-full px-3 sm:px-4 py-2 pr-10 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={isLoadingBCV ? 'Obteniendo...' : 'Ej: 36.50'}
                  disabled={isLoadingBCV}
                />
                {isLoadingBCV && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                  </div>
                )}
                {!isLoadingBCV && bcvData?.available && bcvData.rate && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <span className="text-xs text-green-600 font-medium">✓ {bcvData.rate}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-500">
                  {isLoadingBCV
                    ? 'Obteniendo tasa del BCV desde DolarAPI...'
                    : bcvData?.available && bcvData.rate
                      ? `✓ Tasa obtenida automáticamente: ${bcvData.rate}`
                      : 'Ingrese la tasa o use el botón para obtenerla automáticamente'}
                </p>
                {!isLoadingBCV && (
                  <button
                    type="button"
                    onClick={() => refetchBCV()}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                    title="Obtener tasa automáticamente"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Actualizar
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Redondeo */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Redondeo (opcional)
            </label>
            <select
              value={rounding}
              onChange={(e) =>
                setRounding(e.target.value as 'none' | '0.1' | '0.5' | '1')
              }
              className="w-full px-3 sm:px-4 py-2 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="none">Sin redondeo</option>
              <option value="0.1">0.1</option>
              <option value="0.5">0.5</option>
              <option value="1">1</option>
            </select>
          </div>

          {/* Preview */}
          {category &&
            ((mode === 'percentage' &&
              percentageChange &&
              !isNaN(parseFloat(percentageChange))) ||
              (mode === 'bcv' && bcvRate && !isNaN(parseFloat(bcvRate)) && parseFloat(bcvRate) > 0)) && (
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  Vista previa:
                </p>
                <p className="text-sm text-gray-700">
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
                      <span className="text-xs text-gray-600 mt-1 block">
                        Ejemplo: Producto con precio USD $1.00 → Nuevo precio Bs:{' '}
                        {(1 * parseFloat(bcvRate)).toFixed(2)}
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
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
              type="button"
              onClick={handleSubmit}
              disabled={
                isLoading ||
                !category ||
                categories.length === 0 ||
                (mode === 'percentage' && !percentageChange) ||
                (mode === 'bcv' && !bcvRate)
              }
              className="flex-1 px-4 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm sm:text-base hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              {isLoading ? 'Actualizando...' : 'Aplicar Cambio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

