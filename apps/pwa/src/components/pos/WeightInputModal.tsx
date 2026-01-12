import { useState, useEffect, useRef } from 'react'
import { Scale, Calculator } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

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

  if (!product) return null

  const weightValue = parseFloat(weightInput) || 0
  const unit = product.weight_unit || 'kg'
  const pricePerWeightUsd = Number(product.price_per_weight_usd) || 0
  const pricePerWeightBs = Number(product.price_per_weight_bs) || 0

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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            Producto por Peso
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nombre del producto */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-medium text-foreground">{product.name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              ${pricePerWeightUsd.toFixed(2)} / {UNIT_SHORT[unit]} • Bs. {pricePerWeightBs.toFixed(2)} / {UNIT_SHORT[unit]}
            </p>
          </div>

          {/* Input de peso */}
          <div className="space-y-2">
            <Label htmlFor="weight-input">
              Peso en {UNIT_LABELS[unit]}
            </Label>
            <div className="relative">
              <Input
                ref={inputRef}
                id="weight-input"
                type="text"
                inputMode="decimal"
                placeholder={`Ej: ${unit === 'g' ? '500' : '1.5'}`}
                value={weightInput}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className={cn(
                  "pr-12 text-lg h-12",
                  error && "border-destructive focus-visible:ring-destructive"
                )}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                {UNIT_SHORT[unit]}
              </span>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {product.min_weight || product.max_weight ? (
              <p className="text-xs text-muted-foreground">
                {product.min_weight && `Mín: ${product.min_weight} ${UNIT_SHORT[unit]}`}
                {product.min_weight && product.max_weight && ' • '}
                {product.max_weight && `Máx: ${product.max_weight} ${UNIT_SHORT[unit]}`}
              </p>
            ) : null}
          </div>

          {/* Botones de peso rápido */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Peso rápido</Label>
            <div className="grid grid-cols-4 gap-2">
              {quickWeights.map((w) => (
                <Button
                  key={w}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleInputChange(w.toString())}
                  className="h-9"
                >
                  {w} {UNIT_SHORT[unit]}
                </Button>
              ))}
            </div>
          </div>

          {/* Resumen de cálculo */}
          {weightValue > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calculator className="w-4 h-4" />
                <span>Cálculo</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  {weightValue} {UNIT_SHORT[unit]} × ${pricePerWeightUsd.toFixed(2)}
                </span>
                <span className="text-xl font-bold text-foreground">
                  ${totalUsd.toFixed(2)}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">
                  {weightValue} {UNIT_SHORT[unit]} × Bs. {pricePerWeightBs.toFixed(2)}
                </span>
                <span className="font-medium text-muted-foreground">
                  Bs. {totalBs.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={weightValue <= 0 || !!error}
          >
            Agregar al Carrito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
