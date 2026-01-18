import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { accountingValidationService } from '@/services/accounting.service'
import { Calendar as CalendarIcon, ShieldCheck, AlertTriangle, ChevronDown, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Componente para mostrar reporte de validación contable
 */
export default function ValidationReport() {
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())

  const validationMutation = useMutation({
    mutationFn: () =>
      accountingValidationService.validateAccountingIntegrity({
        start_date: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
        end_date: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
      }),
  })

  const handleValidate = () => {
    validationMutation.mutate()
  }

  const toggleErrorExpand = (errorType: string) => {
    const newExpanded = new Set(expandedErrors)
    if (newExpanded.has(errorType)) {
      newExpanded.delete(errorType)
    } else {
      newExpanded.add(errorType)
    }
    setExpandedErrors(newExpanded)
  }

  const result = validationMutation.data

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Validación de Integridad Contable</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Fecha Inicio (Opcional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-[240px] justify-start text-left font-normal', !startDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'dd/MM/yyyy') : 'Seleccionar fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(date) => setStartDate(date)} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Fecha Fin (Opcional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-[240px] justify-start text-left font-normal', !endDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'dd/MM/yyyy') : 'Seleccionar fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={(date) => setEndDate(date)} />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={handleValidate} disabled={validationMutation.isPending}>
              {validationMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validando...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Validar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      {validationMutation.isError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Error al ejecutar la validación: {validationMutation.error instanceof Error ? validationMutation.error.message : 'Error desconocido'}
          </AlertDescription>
        </Alert>
      )}

      {result && (
        <>
          {/* Estado general */}
          <Alert variant={result.is_valid ? 'default' : 'destructive'} className={cn(result.is_valid && 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800')}>
            {result.is_valid ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription className={cn(result.is_valid && 'text-green-800 dark:text-green-200')}>
              {result.is_valid
                ? 'El sistema contable está válido. No se encontraron errores.'
                : `Se encontraron ${result.errors.filter((e) => e.severity === 'error').length} error(es) que requieren atención.`}
            </AlertDescription>
          </Alert>

          {/* Errores */}
          {result.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-destructive">Errores Encontrados ({result.errors.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.errors.map((error, index) => (
                  <Collapsible key={index} open={expandedErrors.has(error.type)} onOpenChange={() => toggleErrorExpand(error.type)}>
                    <div className="border rounded-lg p-4">
                      <CollapsibleTrigger className="w-full flex items-start justify-between text-left">
                        <div className="flex items-start gap-3 flex-1">
                          <Badge variant={error.severity === 'error' ? 'destructive' : 'secondary'} className="mt-0.5">
                            {error.severity === 'error' ? 'Error' : 'Advertencia'}
                          </Badge>
                          <div className="flex-1">
                            <div className="font-semibold">{error.message}</div>
                            <div className="text-sm text-muted-foreground mt-1">Tipo: {error.type}</div>
                          </div>
                        </div>
                        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expandedErrors.has(error.type) && 'transform rotate-180')} />
                      </CollapsibleTrigger>
                      {error.details && (
                        <CollapsibleContent className="mt-4 pt-4 border-t">
                          <div className="text-sm space-y-2">
                            {Array.isArray(error.details) ? (
                              <div className="space-y-2">
                                <div className="font-medium">Detalles:</div>
                                {error.details.map((detail: any, detailIndex: number) => (
                                  <div key={detailIndex} className="pl-4 border-l-2 border-muted">
                                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                      {JSON.stringify(detail, null, 2)}
                                    </pre>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div>
                                <div className="font-medium mb-2">Detalles:</div>
                                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                  {JSON.stringify(error.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      )}
                    </div>
                  </Collapsible>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Advertencias */}
          {result.warnings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-yellow-600 dark:text-yellow-400">Advertencias ({result.warnings.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.warnings.map((warning, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-950/20">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-yellow-800 dark:text-yellow-200">{warning.message}</div>
                        <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">Tipo: {warning.type}</div>
                        {warning.details && (
                          <div className="mt-2">
                            <pre className="text-xs bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded overflow-x-auto">
                              {JSON.stringify(warning.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Sin problemas */}
          {result.errors.length === 0 && result.warnings.length === 0 && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                No se encontraron errores ni advertencias. El sistema contable está en buen estado.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  )
}