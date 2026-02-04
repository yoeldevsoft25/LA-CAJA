import { useState, useMemo, useCallback } from 'react'
import { Calculator, RefreshCw, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

// Denominaciones de Bs (Venezuela 2025)
const BS_DENOMINATIONS = [
  { value: 200, label: '200', type: 'bill' },
  { value: 100, label: '100', type: 'bill' },
  { value: 50, label: '50', type: 'bill' },
  { value: 20, label: '20', type: 'bill' },
  { value: 10, label: '10', type: 'bill' },
  { value: 5, label: '5', type: 'bill' },
  { value: 2, label: '2', type: 'bill' },
  { value: 1, label: '1', type: 'bill' },
] as const

// Denominaciones de USD
const USD_DENOMINATIONS = [
  { value: 100, label: '$100', type: 'bill' },
  { value: 50, label: '$50', type: 'bill' },
  { value: 20, label: '$20', type: 'bill' },
  { value: 10, label: '$10', type: 'bill' },
  { value: 5, label: '$5', type: 'bill' },
  { value: 2, label: '$2', type: 'bill' },
  { value: 1, label: '$1', type: 'bill' },
] as const

type DenominationCount = Record<number, number>

interface DenominationCalculatorProps {
  onTotalChange: (currency: 'bs' | 'usd', total: number) => void
  className?: string
}

export default function DenominationCalculator({
  onTotalChange,
  className,
}: DenominationCalculatorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [bsCounts, setBsCounts] = useState<DenominationCount>({})
  const [usdCounts, setUsdCounts] = useState<DenominationCount>({})

  // Calcular totales
  const bsTotal = useMemo(() => {
    return BS_DENOMINATIONS.reduce((sum, denom) => {
      return sum + (bsCounts[denom.value] || 0) * denom.value
    }, 0)
  }, [bsCounts])

  const usdTotal = useMemo(() => {
    return USD_DENOMINATIONS.reduce((sum, denom) => {
      return sum + (usdCounts[denom.value] || 0) * denom.value
    }, 0)
  }, [usdCounts])

  // Handlers
  const handleBsCountChange = useCallback((value: number, count: number) => {
    setBsCounts((prev) => {
      const newCounts = { ...prev, [value]: Math.max(0, count) }
      // Calcular nuevo total y notificar
      const newTotal = BS_DENOMINATIONS.reduce((sum, denom) => {
        return sum + (newCounts[denom.value] || 0) * denom.value
      }, 0)
      setTimeout(() => onTotalChange('bs', newTotal), 0)
      return newCounts
    })
  }, [onTotalChange])

  const handleUsdCountChange = useCallback((value: number, count: number) => {
    setUsdCounts((prev) => {
      const newCounts = { ...prev, [value]: Math.max(0, count) }
      // Calcular nuevo total y notificar
      const newTotal = USD_DENOMINATIONS.reduce((sum, denom) => {
        return sum + (newCounts[denom.value] || 0) * denom.value
      }, 0)
      setTimeout(() => onTotalChange('usd', newTotal), 0)
      return newCounts
    })
  }, [onTotalChange])

  const resetAll = useCallback(() => {
    setBsCounts({})
    setUsdCounts({})
    onTotalChange('bs', 0)
    onTotalChange('usd', 0)
  }, [onTotalChange])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className="w-full justify-between"
        >
          <span className="flex items-center">
            <Calculator className="w-4 h-4 mr-2" />
            Calculadora de Denominaciones
          </span>
          <Badge variant="secondary" className="ml-2">
            {isOpen ? 'Ocultar' : 'Mostrar'}
          </Badge>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-4 space-y-4">
        {/* Totales calculados */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-primary/5 border-primary/30">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Bs</p>
              <p className="text-xl font-bold text-primary">{bsTotal.toFixed(2)} Bs</p>
            </CardContent>
          </Card>
          <Card className="bg-success/5 border-success/30">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total USD</p>
              <p className="text-xl font-bold text-success">${usdTotal.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Reset button */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={resetAll}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Limpiar todo
          </Button>
        </div>

        {/* Calculadora Bs */}
        <Card className="border-border">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center">
              <DollarSign className="w-4 h-4 mr-2 text-primary" />
              Billetes Bs (Venezuela)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-4 gap-2">
              {BS_DENOMINATIONS.map((denom) => (
                <div key={denom.value} className="flex flex-col items-center gap-1">
                  <span className={cn(
                    "text-xs font-medium px-2 py-1 rounded-md w-full text-center",
                    denom.value >= 50 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {denom.label} Bs
                  </span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    className="h-9 text-center text-sm px-1"
                    value={bsCounts[denom.value] || ''}
                    onChange={(e) => handleBsCountChange(denom.value, parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                  {(bsCounts[denom.value] || 0) > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      = {((bsCounts[denom.value] || 0) * denom.value).toFixed(0)} Bs
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Calculadora USD */}
        <Card className="border-border">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center">
              <DollarSign className="w-4 h-4 mr-2 text-success" />
              Billetes USD
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-4 gap-2">
              {USD_DENOMINATIONS.map((denom) => (
                <div key={denom.value} className="flex flex-col items-center gap-1">
                  <span className={cn(
                    "text-xs font-medium px-2 py-1 rounded-md w-full text-center",
                    denom.value >= 20 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                  )}>
                    {denom.label}
                  </span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    className="h-9 text-center text-sm px-1"
                    value={usdCounts[denom.value] || ''}
                    onChange={(e) => handleUsdCountChange(denom.value, parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                  {(usdCounts[denom.value] || 0) > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      = ${((usdCounts[denom.value] || 0) * denom.value).toFixed(0)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Aplicar totales */}
        <div className="flex justify-center">
          <p className="text-xs text-muted-foreground text-center">
            Los totales se actualizan automáticamente en los campos de arriba
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
