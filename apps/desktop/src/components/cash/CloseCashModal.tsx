import { useState, useEffect, useCallback } from 'react'
import { DollarSign, AlertTriangle, CheckCircle2, Calculator, ChevronRight, Printer } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CashSession, CashSessionSummary, CloseCashSessionRequest } from '@/services/cash.service'
import { printService } from '@/services/print.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@la-caja/ui-core'
import { Input } from '@la-caja/ui-core'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@la-caja/ui-core'
import DenominationCalculator from '@/components/cash/DenominationCalculator'

const closeCashSchema = z.object({
  counted_bs: z
    .number({ message: 'El monto contado en Bs es requerido' })
    .min(0, 'El monto contado en Bs no puede ser negativo')
    .max(999999999.99, 'El monto contado en Bs excede el límite máximo'),
  counted_usd: z
    .number({ message: 'El monto contado en USD es requerido' })
    .min(0, 'El monto contado en USD no puede ser negativo')
    .max(999999999.99, 'El monto contado en USD excede el límite máximo'),
  note: z.string().optional(),
})

interface CloseCashModalProps {
  isOpen: boolean
  onClose: () => void
  session: CashSession
  sessionSummary: CashSessionSummary
  onConfirm: (data: CloseCashSessionRequest) => void
  isLoading: boolean
}

export default function CloseCashModal({
  isOpen,
  onClose,
  session,
  sessionSummary,
  onConfirm,
  isLoading,
}: CloseCashModalProps) {
  const [confirmStep, setConfirmStep] = useState(1) // 1: datos, 2: revisión, 3: confirmación final
  const [requiresFinalConfirm, setRequiresFinalConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CloseCashSessionRequest>({
    resolver: zodResolver(closeCashSchema),
    defaultValues: {
      counted_bs: Number(sessionSummary.cash_flow.expected_bs) || 0,
      counted_usd: Number(sessionSummary.cash_flow.expected_usd) || 0,
      note: '',
    },
  })

  // Handler para la calculadora de denominaciones
  const handleDenominationTotalChange = useCallback((currency: 'bs' | 'usd', total: number) => {
    if (currency === 'bs') {
      setValue('counted_bs', total, { shouldValidate: true })
    } else {
      setValue('counted_usd', total, { shouldValidate: true })
    }
  }, [setValue])

  const countedBs = watch('counted_bs')
  const countedUsd = watch('counted_usd')

  const expectedBs = Number(sessionSummary.cash_flow.expected_bs) || 0
  const expectedUsd = Number(sessionSummary.cash_flow.expected_usd) || 0

  const differenceBs = countedBs && !isNaN(countedBs) ? countedBs - expectedBs : 0
  const differenceUsd = countedUsd && !isNaN(countedUsd) ? countedUsd - expectedUsd : 0

  const hasDifference = Math.abs(differenceBs) > 0.01 || Math.abs(differenceUsd) > 0.01
  const hasLargeDifference = Math.abs(differenceBs) > 10 || Math.abs(differenceUsd) > 10

  useEffect(() => {
    if (hasLargeDifference) {
      setRequiresFinalConfirm(true)
    }
  }, [hasLargeDifference])

  const onSubmit = (data: CloseCashSessionRequest) => {
    if (confirmStep === 1) {
      // Redondear a 2 decimales
      const roundedData = {
        ...data,
        counted_bs: Math.round(data.counted_bs * 100) / 100,
        counted_usd: Math.round(data.counted_usd * 100) / 100,
      }

      // Si hay diferencias grandes, pedir confirmación adicional
      const diffBs = roundedData.counted_bs - expectedBs
      const diffUsd = roundedData.counted_usd - expectedUsd

      if (Math.abs(diffBs) > 10 || Math.abs(diffUsd) > 10) {
        setConfirmStep(2)
        return
      }

      // Si no hay diferencias grandes, ir directamente a confirmación final
      setConfirmStep(3)
      return
    }

    if (confirmStep === 2) {
      // Revisión con diferencias, ir a confirmación final
      setConfirmStep(3)
      return
    }

    // Confirmación final - enviar
    const roundedData = {
      ...data,
      counted_bs: Math.round(data.counted_bs * 100) / 100,
      counted_usd: Math.round(data.counted_usd * 100) / 100,
    }
    onConfirm(roundedData)
  }

  const handleBack = () => {
    if (confirmStep > 1) {
      setConfirmStep(confirmStep - 1)
    } else {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            <AlertTriangle
              className={cn(
                'w-5 h-5 sm:w-6 sm:h-6 mr-2',
                hasLargeDifference ? 'text-destructive' : 'text-warning'
              )}
            />
            <div>
              {confirmStep === 1 && 'Cerrar Caja'}
              {confirmStep === 2 && 'Revisar Diferencias'}
              {confirmStep === 3 && 'Confirmación Final'}
            </div>
          </DialogTitle>
          <DialogDescription className="text-xs mt-0.5">
            Paso {confirmStep} de {requiresFinalConfirm ? 3 : 2}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
            {confirmStep === 1 && (
              <div className="space-y-4 sm:space-y-6">
                  {/* Advertencia de seguridad */}
                  <Alert className="bg-warning/10 border-warning/50">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                    <AlertDescription>
                      <p className="text-sm font-medium text-warning mb-1">
                        Importante: Verifica los montos cuidadosamente
                      </p>
                      <p className="text-xs text-foreground">
                        Asegúrate de contar físicamente el dinero en la caja antes de ingresar los
                        valores. Este proceso es irreversible.
                      </p>
                    </AlertDescription>
                  </Alert>

                  {/* Montos esperados */}
                  <Card className="bg-info/5 border-info/50">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center text-info">
                        <Calculator className="w-4 h-4 mr-2" />
                        Montos Esperados (Calculados)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-info mb-1">Efectivo Esperado en Bs</p>
                          <p className="text-xl font-bold text-foreground">{expectedBs.toFixed(2)} Bs</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Apertura: {Number(session.opening_amount_bs).toFixed(2)} Bs + Ventas:{' '}
                            {Number(sessionSummary.cash_flow.sales_bs).toFixed(2)} Bs + Movimientos:{' '}
                            {Number(sessionSummary.cash_flow.movements_bs).toFixed(2)} Bs
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-info mb-1">Efectivo Esperado en USD</p>
                          <p className="text-xl font-bold text-foreground">
                            ${expectedUsd.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Apertura: ${Number(session.opening_amount_usd).toFixed(2)} + Ventas:{' '}
                            ${Number(sessionSummary.cash_flow.sales_usd).toFixed(2)} + Movimientos:{' '}
                            ${Number(sessionSummary.cash_flow.movements_usd).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Montos contados */}
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-4">
                      Montos Contados Físicamente
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="counted_bs" className="mb-2">
                          Monto Contado en Bs <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            id="counted_bs"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            max="999999999.99"
                            {...register('counted_bs', { valueAsNumber: true })}
                            className={cn(
                              'pl-10 text-lg font-semibold',
                              errors.counted_bs && 'border-destructive'
                            )}
                            placeholder="0.00"
                            disabled={isLoading}
                          />
                        </div>
                        {errors.counted_bs && (
                          <p className="mt-1 text-sm text-destructive">{errors.counted_bs.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="counted_usd" className="mb-2">
                          Monto Contado en USD <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          <Input
                            id="counted_usd"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            max="999999999.99"
                            {...register('counted_usd', { valueAsNumber: true })}
                            className={cn(
                              'pl-10 text-lg font-semibold',
                              errors.counted_usd && 'border-destructive'
                            )}
                            placeholder="0.00"
                            disabled={isLoading}
                          />
                        </div>
                        {errors.counted_usd && (
                          <p className="mt-1 text-sm text-destructive">{errors.counted_usd.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Calculadora de Denominaciones */}
                    <div className="mt-6 pt-4 border-t border-border">
                      <DenominationCalculator
                        onTotalChange={handleDenominationTotalChange}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Usa la calculadora para contar billetes y el total se aplicará automáticamente
                      </p>
                    </div>
                  </div>

                  {/* Diferencias en tiempo real */}
                  {countedBs !== undefined &&
                    countedUsd !== undefined &&
                    !isNaN(countedBs) &&
                    !isNaN(countedUsd) && (
                      <Alert className={cn(
                        'border',
                        hasLargeDifference
                          ? 'bg-destructive/10 border-destructive/50'
                          : hasDifference
                          ? 'bg-warning/10 border-warning/50'
                          : 'bg-success/10 border-success/50'
                      )}>
                        {hasDifference ? (
                          <AlertTriangle className={cn(
                            'w-4 h-4',
                            hasLargeDifference ? 'text-destructive' : 'text-warning'
                          )} />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-success" />
                        )}
                        <AlertDescription>
                          <p className={cn(
                            'text-sm font-semibold mb-3',
                            hasLargeDifference ? 'text-destructive' : hasDifference ? 'text-warning' : 'text-success'
                          )}>
                            Diferencias
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Diferencia en Bs</p>
                              <p className={cn(
                                'text-xl font-bold',
                                hasLargeDifference ? 'text-destructive' : hasDifference ? 'text-warning' : 'text-success'
                              )}>
                                {differenceBs >= 0 ? '+' : ''}
                                {differenceBs.toFixed(2)} Bs
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Diferencia en USD</p>
                              <p className={cn(
                                'text-xl font-bold',
                                hasLargeDifference ? 'text-destructive' : hasDifference ? 'text-warning' : 'text-success'
                              )}>
                                {differenceUsd >= 0 ? '+' : ''}
                                {differenceUsd.toFixed(2)}
                              </p>
                            </div>
                          </div>
                          {hasLargeDifference && (
                            <p className="text-xs text-destructive mt-3 font-medium">
                              ⚠️ Advertencia: Diferencias significativas detectadas. Se requerirá
                              confirmación adicional.
                            </p>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                  {/* Nota */}
                  <div>
                    <Label htmlFor="note">Nota (Opcional)</Label>
                    <Textarea
                      id="note"
                      {...register('note')}
                      rows={3}
                      className="mt-2 resize-none"
                      placeholder="Observaciones sobre el cierre, diferencias, etc..."
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              {confirmStep === 2 && (
                <div className="space-y-4 sm:space-y-6">
                  <Alert className="bg-destructive/10 border-destructive/50">
                    <AlertTriangle className="w-6 h-6 text-destructive" />
                    <AlertDescription>
                      <h3 className="text-lg font-bold text-destructive mb-2">
                        Diferencias Significativas Detectadas
                      </h3>
                      <p className="text-sm text-foreground mb-4">
                        Has ingresado montos que difieren significativamente de los montos esperados.
                        Por favor, revisa cuidadosamente:
                      </p>

                      <Card className="bg-background border-border mt-4">
                        <CardContent className="p-4 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Esperado vs Contado (Bs)</p>
                              <div className="flex items-baseline justify-between">
                                <span className="text-base text-foreground">{expectedBs.toFixed(2)} Bs</span>
                                <span className="text-2xl font-bold text-destructive">
                                  {differenceBs >= 0 ? '+' : ''}
                                  {differenceBs.toFixed(2)} Bs
                                </span>
                              </div>
                              <p className="text-lg font-semibold text-foreground mt-2">
                                {countedBs.toFixed(2)} Bs
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Esperado vs Contado (USD)</p>
                              <div className="flex items-baseline justify-between">
                                <span className="text-base text-foreground">
                                  ${expectedUsd.toFixed(2)}
                                </span>
                                <span className="text-2xl font-bold text-destructive">
                                  {differenceUsd >= 0 ? '+' : ''}
                                  {differenceUsd.toFixed(2)}
                                </span>
                              </div>
                              <p className="text-lg font-semibold text-foreground mt-2">
                                ${countedUsd.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Alert className="mt-4 bg-warning/10 border-warning/50">
                        <AlertDescription>
                          <p className="text-sm text-warning font-medium">
                            ¿Estás seguro de que estos montos son correctos? Verifica físicamente el dinero
                            antes de continuar.
                          </p>
                        </AlertDescription>
                      </Alert>
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {confirmStep === 3 && (
                <div className="space-y-4 sm:space-y-6">
                  <Alert className="bg-info/10 border-info/50">
                    <CheckCircle2 className="w-6 h-6 text-info" />
                    <AlertDescription>
                      <h3 className="text-lg font-bold text-info mb-2">
                        Confirmación Final Requerida
                      </h3>
                      <p className="text-sm text-foreground mb-4">
                        Estás a punto de cerrar la caja. Este proceso es{' '}
                        <strong>IRREVERSIBLE</strong>. Por favor, confirma que todos los datos son
                        correctos:
                      </p>

                      <Card className="bg-background border-border mt-4">
                        <CardContent className="p-4 space-y-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Apertura</p>
                            <p className="text-sm text-foreground">
                              {Number(session.opening_amount_bs).toFixed(2)} Bs / $
                              {Number(session.opening_amount_usd).toFixed(2)} USD
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Ventas en Efectivo</p>
                            <p className="text-sm text-foreground">
                              {Number(sessionSummary.cash_flow.sales_bs).toFixed(2)} Bs / $
                              {Number(sessionSummary.cash_flow.sales_usd).toFixed(2)} USD
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Movimientos Netos</p>
                            <p className="text-sm text-foreground">
                              {Number(sessionSummary.cash_flow.movements_bs).toFixed(2)} Bs / $
                              {Number(sessionSummary.cash_flow.movements_usd).toFixed(2)} USD
                            </p>
                          </div>
                          <div className="border-t border-border pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Esperado</p>
                            <p className="text-lg font-bold text-foreground">
                              {expectedBs.toFixed(2)} Bs / ${expectedUsd.toFixed(2)} USD
                            </p>
                          </div>
                          <div className="border-t border-border pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Contado</p>
                            <p className="text-lg font-bold text-primary">
                              {countedBs.toFixed(2)} Bs / ${countedUsd.toFixed(2)} USD
                            </p>
                          </div>
                          {hasDifference && (
                            <Alert className={cn(
                              'border-t mt-4',
                              hasLargeDifference ? 'bg-destructive/10 border-destructive/50' : 'bg-warning/10 border-warning/50'
                            )}>
                              <AlertDescription>
                                <p className="text-xs text-muted-foreground mb-1">Diferencia</p>
                                <p className={cn(
                                  'text-lg font-bold',
                                  hasLargeDifference ? 'text-destructive' : 'text-warning'
                                )}>
                                  {differenceBs >= 0 ? '+' : ''}
                                  {differenceBs.toFixed(2)} Bs / {differenceUsd >= 0 ? '+' : ''}
                                  {differenceUsd.toFixed(2)} USD
                                </p>
                              </AlertDescription>
                            </Alert>
                          )}
                        </CardContent>
                      </Card>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="flex-1"
                disabled={isLoading}
              >
                {confirmStep === 1 ? 'Cancelar' : 'Atrás'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => printService.printCashSessionSummary(sessionSummary)}
                className="flex items-center justify-center gap-2"
                disabled={isLoading}
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Imprimir</span>
              </Button>
              <Button
                type="submit"
                className={cn(
                  'flex-1 flex items-center justify-center',
                  confirmStep === 3
                    ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                    : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                )}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Cerrando...
                  </>
                ) : confirmStep === 3 ? (
                  <>
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    Confirmar y Cerrar Caja
                  </>
                ) : (
                  <>
                    Continuar
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
