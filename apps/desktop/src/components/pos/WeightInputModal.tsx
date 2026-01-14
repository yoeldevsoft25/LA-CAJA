import { useState, useEffect, useRef } from 'react'
import { Scale, Calculator, X } from 'lucide-react'

export interface WeightProduct {
  id: string
  name: string
  weight_unit: 'kg' | 'g' | 'lb' | 'oz'
  price_per_weight_bs: number
  price_per_weight_usd: number
  min_weight?: number | null
  max_weight?: number | null
}

interface WeightInputModalProps {
  isOpen: boolean
  onClose: () => void
  product: WeightProduct | null
  onConfirm: (weightValue: number) => void
}

const UNIT_LABELS: Record<string, string> = {
  kg: 'Kilogramos',
  g: 'Gramos',
  lb: 'Libras',
  oz: 'Onzas',
}

const UNIT_SHORT: Record<string, string> = {
  kg: 'kg',
  g: 'g',
  lb: 'lb',
  oz: 'oz',
}

export default function WeightInputModal({
  isOpen,
  onClose,
  product,
  onConfirm,
}: WeightInputModalProps) {
  const [weightInput, setWeightInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setWeightInput('')
      setError(null)
      // Focus en el input después de que el modal se abra
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  if (!isOpen || !product) return null

  const weightValue = parseFloat(weightInput) || 0
  const unit = product.weight_unit || 'kg'
  const pricePerWeightUsd = Number(product.price_per_weight_usd) || 0
  const pricePerWeightBs = Number(product.price_per_weight_bs) || 0
  const unitPriceDecimals = unit === 'g' || unit === 'oz' ? 4 : 2

  // Calcular totales
  const totalUsd = weightValue * pricePerWeightUsd
  const totalBs = weightValue * pricePerWeightBs

  // Validar peso
  const validateWeight = (value: number): string | null => {
    if (value <= 0) {
      return 'El peso debe ser mayor a 0'
    }
    if (product.min_weight && value < product.min_weight) {
      return `Peso mínimo: ${product.min_weight} ${UNIT_SHORT[unit]}`
    }
    if (product.max_weight && value > product.max_weight) {
      return `Peso máximo: ${product.max_weight} ${UNIT_SHORT[unit]}`
    }
    return null
  }

  const handleInputChange = (value: string) => {
    // Solo permitir números y punto decimal
    const sanitized = value.replace(/[^0-9.]/g, '')
    // Evitar múltiples puntos decimales
    const parts = sanitized.split('.')
    const formatted = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : sanitized
    setWeightInput(formatted)

    const numValue = parseFloat(formatted) || 0
    if (numValue > 0) {
      setError(validateWeight(numValue))
    } else {
      setError(null)
    }
  }

  const handleConfirm = () => {
    const validationError = validateWeight(weightValue)
    if (validationError) {
      setError(validationError)
      return
    }
    onConfirm(weightValue)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && weightValue > 0 && !error) {
      handleConfirm()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  // Botones de acceso rápido para pesos comunes
  const quickWeights = unit === 'g'
    ? [100, 250, 500, 1000]
    : unit === 'kg'
    ? [0.25, 0.5, 1, 2]
    : unit === 'lb'
    ? [0.25, 0.5, 1, 2]
    : [1, 2, 4, 8] // oz

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            Producto por Peso
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Nombre del producto */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="font-medium text-gray-900">{product.name}</p>
            <p className="text-sm text-gray-500 mt-1">
              ${pricePerWeightUsd.toFixed(unitPriceDecimals)} / {UNIT_SHORT[unit]} • Bs. {pricePerWeightBs.toFixed(unitPriceDecimals)} / {UNIT_SHORT[unit]}
            </p>
          </div>

          {/* Input de peso */}
          <div className="space-y-2">
            <label htmlFor="weight-input" className="block text-sm font-medium text-gray-700">
              Peso en {UNIT_LABELS[unit]}
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="weight-input"
                type="text"
                inputMode="decimal"
                placeholder={`Ej: ${unit === 'g' ? '500' : '1.5'}`}
                value={weightInput}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`w-full pr-12 text-lg h-12 px-4 border-2 rounded-lg focus:outline-none focus:ring-2 ${
                  error
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                {UNIT_SHORT[unit]}
              </span>
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            {(product.min_weight || product.max_weight) && (
              <p className="text-xs text-gray-500">
                {product.min_weight && `Mín: ${product.min_weight} ${UNIT_SHORT[unit]}`}
                {product.min_weight && product.max_weight && ' • '}
                {product.max_weight && `Máx: ${product.max_weight} ${UNIT_SHORT[unit]}`}
              </p>
            )}
          </div>

          {/* Botones de peso rápido */}
          <div className="space-y-2">
            <label className="block text-xs text-gray-500">Peso rápido</label>
            <div className="grid grid-cols-4 gap-2">
              {quickWeights.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => handleInputChange(w.toString())}
                  className="h-9 px-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  {w} {UNIT_SHORT[unit]}
                </button>
              ))}
            </div>
          </div>

          {/* Resumen de cálculo */}
          {weightValue > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calculator className="w-4 h-4" />
                <span>Cálculo</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-600">
                  {weightValue} {UNIT_SHORT[unit]} × ${pricePerWeightUsd.toFixed(unitPriceDecimals)}
                </span>
                <span className="text-xl font-bold text-gray-900">
                  ${totalUsd.toFixed(2)}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-gray-500">
                  {weightValue} {UNIT_SHORT[unit]} × Bs. {pricePerWeightBs.toFixed(unitPriceDecimals)}
                </span>
                <span className="font-medium text-gray-600">
                  Bs. {totalBs.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={weightValue <= 0 || !!error}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Agregar al Carrito
          </button>
        </div>
      </div>
    </div>
  )
}
