import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Scale, Calculator } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@la-caja/ui-core'
import { Input } from '@la-caja/ui-core'
import { Label } from '@/components/ui/label'
import { cn } from '@la-caja/ui-core'

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
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setWeightInput('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const pricePerWeightUsd = useMemo(
    () => (Number.isFinite(Number(product?.price_per_weight_usd)) ? Number(product?.price_per_weight_usd) : 0),
    [product?.price_per_weight_usd]
  )
  const pricePerWeightBs = useMemo(
    () => (Number.isFinite(Number(product?.price_per_weight_bs)) ? Number(product?.price_per_weight_bs) : 0),
    [product?.price_per_weight_bs]
  )

  const sanitize = useCallback((raw: string) => {
    const s = String(raw).replace(/[^0-9.]/g, '')
    const parts = s.split('.')
    return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : s
  }, [])

  const handleInputChange = useCallback((value: string) => {
    setWeightInput(sanitize(value))
  }, [sanitize])

  /** En dispositivos/teléfonos el "input" a veces no dispara al INSERTAR dígitos (sí al borrar).
   * Sincronizar desde el DOM después de tecla o paste asegura que el cálculo se actualice. */
  const syncFromInput = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    const next = sanitize(el.value)
    setWeightInput(next)
  }, [sanitize])

  const handleQuickWeight = useCallback((w: number) => {
    setWeightInput(String(w))
  }, [])

  if (!product) return null

  const nW = parseFloat(weightInput)
  const weightValue = Number.isFinite(nW) ? nW : 0
  const unit = product.weight_unit || 'kg'
  const unitPriceDecimals = unit === 'g' || unit === 'oz' ? 4 : 2

  const totalUsd = weightValue * pricePerWeightUsd
  const totalBs = weightValue * pricePerWeightBs

  const validateWeight = (value: number): string | null => {
    if (value <= 0) return 'El peso debe ser mayor a 0'
    if (product.min_weight != null && value < product.min_weight) return `Peso mínimo: ${product.min_weight} ${UNIT_SHORT[unit]}`
    if (product.max_weight != null && value > product.max_weight) return `Peso máximo: ${product.max_weight} ${UNIT_SHORT[unit]}`
    return null
  }

  const error = weightValue > 0 ? validateWeight(weightValue) : null

  const handleConfirm = () => {
    if (validateWeight(weightValue)) return
    const rounded = Math.round(weightValue * 10000) / 10000
    onConfirm(rounded)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const canSubmit = weightValue > 0 && !error && (pricePerWeightUsd > 0 || pricePerWeightBs > 0)
    if (e.key === 'Enter' && canSubmit) {
      handleConfirm()
      return
    }
    // En tablets/móviles el "input" a veces no dispara al insertar; sincronizar desde el DOM.
    setTimeout(syncFromInput, 0)
  }

  // Pesos rápidos: más opciones en gramos (15,25,50,75) para evitar escribir
  const quickWeightsRow1 = unit === 'g'
    ? [100, 250, 500, 1000]
    : unit === 'kg'
      ? [0.25, 0.5, 1, 2]
      : unit === 'lb'
        ? [0.25, 0.5, 1, 2]
        : [1, 2, 4, 8]
  const quickWeightsRow2 = unit === 'g' ? [15, 25, 50, 75] : null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            Producto por Peso
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Introduce el peso del producto para calcular el precio final.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nombre del producto */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-medium text-foreground">{product.name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              ${pricePerWeightUsd.toFixed(unitPriceDecimals)} / {UNIT_SHORT[unit]} • Bs. {pricePerWeightBs.toFixed(unitPriceDecimals)} / {UNIT_SHORT[unit]}
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
                autoComplete="off"
                placeholder={`Ej: ${unit === 'g' ? '500' : '1.5'}`}
                value={weightInput}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={() => setTimeout(syncFromInput, 0)}
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

          {/* Botones de peso rápido: dos filas en gramos para 15,25,50,75 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Peso rápido</Label>
            <div className="grid grid-cols-4 gap-2">
              {quickWeightsRow1.map((w) => (
                <Button
                  key={w}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickWeight(w)}
                  className="h-9"
                >
                  {w} {UNIT_SHORT[unit]}
                </Button>
              ))}
              {quickWeightsRow2?.map((w) => (
                <Button
                  key={w}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickWeight(w)}
                  className="h-9"
                >
                  {w} {UNIT_SHORT[unit]}
                </Button>
              ))}
            </div>
          </div>

          {/* Resumen de cálculo: se muestra en cuanto hay peso > 0 */}
          {weightValue > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calculator className="w-4 h-4" />
                <span>Cálculo</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  {weightValue} {UNIT_SHORT[unit]} × ${pricePerWeightUsd.toFixed(unitPriceDecimals)}
                </span>
                <span className="text-xl font-bold text-foreground tabular-nums">
                  ${(totalUsd > 0 && totalUsd < 0.01) ? totalUsd.toFixed(4) : totalUsd.toFixed(2)}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">
                  {weightValue} {UNIT_SHORT[unit]} × Bs. {pricePerWeightBs.toFixed(unitPriceDecimals)}
                </span>
                <span className="font-medium text-muted-foreground tabular-nums">
                  Bs. {(totalBs > 0 && totalBs < 0.01) ? totalBs.toFixed(4) : totalBs.toFixed(2)}
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
            disabled={weightValue <= 0 || !!error || (pricePerWeightUsd <= 0 && pricePerWeightBs <= 0)}
          >
            Agregar al Carrito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
