import { useState, useEffect, forwardRef } from 'react'
import { Input } from '@la-caja/ui-core'
import { Badge } from '@/components/ui/badge'
import { validateRIF, RIF_TYPES } from '@/utils/rif-validator'
import { cn } from '@la-caja/ui-core'
import { Check, AlertCircle, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface RIFInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string
  onChange?: (value: string, isValid: boolean) => void
  onValidChange?: (isValid: boolean, formatted: string | null) => void
  showValidation?: boolean
  autoFormat?: boolean
  className?: string
}

const RIFInput = forwardRef<HTMLInputElement, RIFInputProps>(
  (
    {
      value = '',
      onChange,
      onValidChange,
      showValidation = true,
      autoFormat = true,
      className,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState(value)
    const [validation, setValidation] = useState(() => validateRIF(value))

    // Sincronizar valor externo
    useEffect(() => {
      if (value !== internalValue) {
        setInternalValue(value)
        const result = validateRIF(value)
        setValidation(result)
      }
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value.toUpperCase()
      
      // Auto-formatear mientras escribe
      if (autoFormat && newValue.length > 0) {
        // Quitar caracteres no válidos excepto guiones
        newValue = newValue.replace(/[^A-Z0-9-]/g, '')
        
        // Auto-agregar guión después del tipo
        if (newValue.length === 1 && /[JVEPGC]/.test(newValue)) {
          newValue = newValue + '-'
        }
        
        // Auto-agregar guión antes del dígito verificador
        if (newValue.length === 10 && !newValue.includes('-', 2)) {
          newValue = newValue.slice(0, 9) + '-' + newValue.slice(9)
        }
      }

      setInternalValue(newValue)
      
      const result = validateRIF(newValue)
      setValidation(result)
      
      onChange?.(newValue, result.isValid)
      onValidChange?.(result.isValid, result.formatted)
    }

    const handleBlur = () => {
      // Auto-formatear al salir si es válido
      if (autoFormat && validation.isValid && validation.formatted) {
        setInternalValue(validation.formatted)
        onChange?.(validation.formatted, true)
      }
    }

    const showValidState = showValidation && internalValue.length >= 9

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="text"
          value={internalValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="J-12345678-9"
          maxLength={12}
          className={cn(
            'pr-10 uppercase',
            showValidState && validation.isValid && 'border-green-500 focus-visible:ring-green-500',
            showValidState && !validation.isValid && 'border-red-500 focus-visible:ring-red-500',
            className
          )}
          {...props}
        />

        {/* Indicador de validación */}
        {showValidation && internalValue.length > 0 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {validation.isValid ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      <Check className="w-4 h-4 text-green-500" />
                      {validation.type && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-green-500 text-green-600">
                          {validation.type}
                        </Badge>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {validation.type && RIF_TYPES[validation.type]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      RIF válido: {validation.formatted}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : internalValue.length >= 2 ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs text-red-500">{validation.error}</p>
                    {validation.formatted && (
                      <p className="text-xs text-muted-foreground">
                        Formato correcto: {validation.formatted}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Formato: J-12345678-9</p>
                    <p className="text-xs text-muted-foreground">
                      Tipos: J (Jurídico), V (Natural), E (Extranjero)
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
      </div>
    )
  }
)

RIFInput.displayName = 'RIFInput'

export { RIFInput }
