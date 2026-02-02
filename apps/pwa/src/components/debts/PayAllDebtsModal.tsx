import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { DollarSign, AlertTriangle, CheckCircle } from 'lucide-react'
import { Customer } from '@/services/customers.service'
import { debtsService, Debt, calculateDebtTotals, PaymentMethod, CreateDebtPaymentDto } from '@/services/debts.service'
import { exchangeService } from '@/services/exchange.service'
import { useOnline } from '@/hooks/use-online'

const LIVE_BCV_REFETCH_MS = 30_000
const roundCurrency = (value: number) => Math.round(value * 100) / 100
import toast from '@/lib/toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const paymentSchema = z.object({
  amount_usd: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  amount_bs: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  method: z.enum(['CASH_BS', 'CASH_USD', 'PAGO_MOVIL', 'TRANSFER', 'OTHER', 'ROLLOVER']),
  note: z.string().optional(),
})

type PaymentFormData = z.infer<typeof paymentSchema>

interface PayAllDebtsModalProps {
  isOpen: boolean
  onClose: () => void
  customer: Customer | null
  debts: Debt[]
  onSuccess?: () => void
}

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH_BS', label: 'Efectivo Bs' },
  { value: 'CASH_USD', label: 'Efectivo USD' },
  { value: 'PAGO_MOVIL', label: 'Pago Móvil' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' },
]

export default function PayAllDebtsModal({
  isOpen,
  onClose,
  customer,
  debts,
  onSuccess,
}: PayAllDebtsModalProps) {
  const { isOnline } = useOnline()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount_usd: 0,
      amount_bs: 0,
      method: 'CASH_USD',
      note: '',
    },
  })

  // Obtener tasa BCV (siempre fresca mientras el modal esté abierto)
  const { data: bcvRateData } = useQuery({
    queryKey: ['exchange', 'bcv'],
    queryFn: () => exchangeService.getBCVRate(true),
    staleTime: 0,
    gcTime: 1000 * 60 * 10,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: isOpen && isOnline ? LIVE_BCV_REFETCH_MS : false,
    enabled: isOpen,
  })

  const exchangeRate = bcvRateData?.rate || 0

  // Calcular totales pendientes
  const totals = useMemo(() => {
    const openDebts = debts.filter((d) => d.status !== 'paid')
    let totalRemainingUsd = 0
    let totalRemainingBsLegacy = 0

    openDebts.forEach((debt) => {
      const calc = calculateDebtTotals(debt)
      totalRemainingUsd += calc.remaining_usd
      totalRemainingBsLegacy += calc.remaining_bs
    })

    return {
      totalRemainingUsd: roundCurrency(totalRemainingUsd),
      totalRemainingBsLegacy: roundCurrency(totalRemainingBsLegacy),
      openDebtsCount: openDebts.length,
    }
  }, [debts])

  const totalRemainingBs =
    exchangeRate > 0
      ? roundCurrency(totals.totalRemainingUsd * exchangeRate)
      : totals.totalRemainingBsLegacy

  // Observar cambios en amount_usd para calcular amount_bs
  const amountUsd = watch('amount_usd')
  const selectedMethod = watch('method')

  useEffect(() => {
    if (amountUsd > 0 && exchangeRate > 0) {
      const calculatedBs = Math.round(amountUsd * exchangeRate * 100) / 100
      setValue('amount_bs', calculatedBs, { shouldValidate: false })
    } else if (amountUsd <= 0) {
      setValue('amount_bs', 0, { shouldValidate: false })
    }
  }, [amountUsd, exchangeRate, setValue])

  // Reset form cuando se abre el modal
  useEffect(() => {
    if (isOpen && totals.totalRemainingUsd > 0) {
      const initialAmountBs =
        exchangeRate > 0
          ? roundCurrency(totals.totalRemainingUsd * exchangeRate)
          : totals.totalRemainingBsLegacy
      reset({
        amount_usd: totals.totalRemainingUsd,
        amount_bs: initialAmountBs,
        method: 'CASH_USD',
        note: `Pago completo de todas las deudas pendientes`,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, totals.totalRemainingUsd, totals.totalRemainingBsLegacy, reset])

  const payAllMutation = useMutation({
    mutationFn: (data: CreateDebtPaymentDto) => {
      if (!customer) throw new Error('Cliente no seleccionado')
      return debtsService.payAllDebts(customer.id, data)
    },
    onSuccess: () => {
      toast.success('Todas las deudas han sido pagadas exitosamente')
      onSuccess?.()
      onClose()
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || 'Error al procesar el pago de todas las deudas'
      )
    },
  })

  const onSubmit = (data: PaymentFormData) => {
    // Permitir pagos parciales
    // if (data.amount_usd < totals.totalRemainingUsd) {
    //   toast.error(
    //     `El monto debe ser al menos $${totals.totalRemainingUsd.toFixed(2)} USD (total pendiente)`
    //   )
    //   return
    // }

    payAllMutation.mutate(data)
  }

  if (!customer) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pago Completo de Deudas</DialogTitle>
          <DialogDescription>
            Cliente: {customer.name}
            {customer.document_id && ` • CI: ${customer.document_id}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumen de deudas */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Pendiente:</span>
                  <div className="text-right">
                    <p className="text-lg font-bold text-warning">
                      ${totals.totalRemainingUsd.toFixed(2)} USD
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {totalRemainingBs.toFixed(2)} Bs
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-sm text-muted-foreground">Deudas Pendientes:</span>
                  <span className="font-semibold">{totals.openDebtsCount}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Alerta si el monto es menor */}
          {amountUsd > 0 && amountUsd < totals.totalRemainingUsd && (
            <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertTitle>Atención</AlertTitle>
              <AlertDescription>
                Se realizará un abono parcial de ${amountUsd.toFixed(2)} al total pendiente.
                Se aplicará a las deudas más antiguas primero.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Monto USD */}
            <div className="space-y-2">
              <Label htmlFor="amount_usd">
                Monto en USD <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="amount_usd"
                  type="number"
                  step="0.01"
                  min="0"
                  className={cn('pl-9', errors.amount_usd && 'border-destructive')}
                  {...register('amount_usd', {
                    valueAsNumber: true,
                    min: {
                      value: 0.01,
                      message: 'El monto debe ser mayor a 0',
                    },
                  })}
                />
              </div>
              {errors.amount_usd && (
                <p className="text-sm text-destructive">{errors.amount_usd.message}</p>
              )}
            </div>

            {/* Monto Bs */}
            <div className="space-y-2">
              <Label htmlFor="amount_bs">
                Monto en Bs <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="amount_bs"
                  type="number"
                  step="0.01"
                  min="0"
                  className={cn('pl-9', errors.amount_bs && 'border-destructive')}
                  {...register('amount_bs', {
                    valueAsNumber: true,
                  })}
                />
              </div>
              {errors.amount_bs && (
                <p className="text-sm text-destructive">{errors.amount_bs.message}</p>
              )}
              {exchangeRate > 0 && (
                <p className="text-xs text-muted-foreground">
                  Tasa BCV: {exchangeRate.toFixed(2)} Bs/USD
                </p>
              )}
            </div>

            {/* Método de pago */}
            <div className="space-y-2">
              <Label>
                Método de Pago <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={selectedMethod}
                onValueChange={(value) => setValue('method', value as PaymentFormData['method'])}
              >
                <div className="grid grid-cols-2 gap-3">
                  {paymentMethods.map((method) => (
                    <div key={method.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={method.value} id={method.value} />
                      <Label
                        htmlFor={method.value}
                        className="flex-1 cursor-pointer font-normal"
                      >
                        {method.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
              {errors.method && (
                <p className="text-sm text-destructive">{errors.method.message}</p>
              )}
            </div>

            {/* Nota */}
            <div className="space-y-2">
              <Label htmlFor="note">Nota (opcional)</Label>
              <Textarea
                id="note"
                placeholder="Nota sobre el pago..."
                className="resize-none"
                rows={3}
                {...register('note')}
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={payAllMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-success hover:bg-success/90 text-white"
                disabled={payAllMutation.isPending || amountUsd <= 0}
              >
                {payAllMutation.isPending ? (
                  'Procesando...'
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {amountUsd < totals.totalRemainingUsd ? 'Abonar a Deuda Total' : 'Pagar Todas las Deudas'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
