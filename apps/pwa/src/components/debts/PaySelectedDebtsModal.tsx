import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { DollarSign, AlertTriangle, CheckCircle, ListChecks } from 'lucide-react'
import { Customer } from '@/services/customers.service'
import { debtsService, Debt, calculateDebtTotals, PaymentMethod, CreateDebtPaymentDto } from '@/services/debts.service'
import { exchangeService } from '@/services/exchange.service'
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
  method: z.enum(['CASH_BS', 'CASH_USD', 'PAGO_MOVIL', 'TRANSFER', 'OTHER']),
  note: z.string().optional(),
})

type PaymentFormData = z.infer<typeof paymentSchema>

interface PaySelectedDebtsModalProps {
  isOpen: boolean
  onClose: () => void
  customer: Customer | null
  openDebts: Debt[]
  selectedDebtIds: string[]
  onSuccess?: () => void
}

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH_BS', label: 'Efectivo Bs' },
  { value: 'CASH_USD', label: 'Efectivo USD' },
  { value: 'PAGO_MOVIL', label: 'Pago Móvil' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' },
]

export default function PaySelectedDebtsModal({
  isOpen,
  onClose,
  customer,
  openDebts,
  selectedDebtIds,
  onSuccess,
}: PaySelectedDebtsModalProps) {
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

  const isOnline = navigator.onLine

  const { data: bcvRateData } = useQuery({
    queryKey: ['exchange', 'bcv'],
    queryFn: () => exchangeService.getBCVRate(),
    staleTime: 1000 * 60 * 60 * 2,
    enabled: isOpen,
  })

  const exchangeRate = bcvRateData?.rate || 0

  const selectedDebts = useMemo(
    () => openDebts.filter((d) => selectedDebtIds.includes(d.id)),
    [openDebts, selectedDebtIds]
  )

  const totals = useMemo(() => {
    let totalRemainingUsd = 0
    let totalRemainingBs = 0

    selectedDebts.forEach((debt) => {
      const calc = calculateDebtTotals(debt)
      totalRemainingUsd += calc.remaining_usd
      totalRemainingBs += calc.remaining_bs
    })

    return {
      totalRemainingUsd,
      totalRemainingBs,
      selectedCount: selectedDebts.length,
    }
  }, [selectedDebts])

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

  useEffect(() => {
    if (isOpen) {
      reset({
        amount_usd: totals.totalRemainingUsd,
        amount_bs: totals.totalRemainingBs,
        method: 'CASH_USD',
        note: totals.selectedCount > 0 ? `Pago de deudas seleccionadas (${totals.selectedCount})` : '',
      })
    }
  }, [isOpen, totals, reset])

  const paySelectedMutation = useMutation({
    mutationFn: (data: CreateDebtPaymentDto) => {
      if (!customer) throw new Error('Cliente no seleccionado')
      return debtsService.paySelectedDebts(customer.id, selectedDebtIds, data)
    },
    onSuccess: () => {
      toast.success('Deudas seleccionadas pagadas exitosamente')
      onSuccess?.()
      onClose()
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || 'Error al procesar el pago de deudas seleccionadas'
      )
    },
  })

  const onSubmit = (data: PaymentFormData) => {
    if (!isOnline) {
      toast.error('Esta operación requiere conexión a internet')
      return
    }
    if (totals.selectedCount === 0) {
      toast.error('Seleccione al menos una deuda')
      return
    }
    if (data.amount_usd > totals.totalRemainingUsd + 0.01) {
      toast.error(
        `El monto excede el total seleccionado ($${totals.totalRemainingUsd.toFixed(2)})`
      )
      return
    }

    paySelectedMutation.mutate(data)
  }

  if (!customer) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-success" />
            Pagar/Abonar Deudas Seleccionadas
          </DialogTitle>
          <DialogDescription>
            Cliente: {customer.name}
            {customer.document_id && ` • CI: ${customer.document_id}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="bg-muted/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Resumen de selección</Label>
                <span className="text-xs text-muted-foreground">{totals.selectedCount} deudas</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Total seleccionado:</span>
                <span className="text-lg font-bold text-warning">
                  ${totals.totalRemainingUsd.toFixed(2)} USD
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Alerta si el monto es mayor */}
          {amountUsd > 0 && amountUsd > totals.totalRemainingUsd && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atención</AlertTitle>
              <AlertDescription>
                El monto ingresado (${amountUsd.toFixed(2)}) excede el total seleccionado (
                ${totals.totalRemainingUsd.toFixed(2)}).
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
                  })}
                />
              </div>
              {errors.amount_usd && (
                <p className="text-sm text-destructive">{errors.amount_usd.message}</p>
              )}
            </div>

            {/* Monto Bs (calculado) */}
            <div className="space-y-2">
              <Label htmlFor="amount_bs">Monto en Bs</Label>
              <Input
                id="amount_bs"
                type="number"
                step="0.01"
                readOnly
                className={cn(errors.amount_bs && 'border-destructive')}
                {...register('amount_bs', { valueAsNumber: true })}
              />
              {errors.amount_bs && (
                <p className="text-sm text-destructive">{errors.amount_bs.message}</p>
              )}
            </div>

            {/* Método de pago */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">
                Método de Pago <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={selectedMethod}
                onValueChange={(value) => setValue('method', value as PaymentMethod)}
                className="grid grid-cols-2 gap-x-4 gap-y-3"
              >
                {paymentMethods.map((method) => (
                  <div key={method.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={method.value} id={`selected-${method.value}`} />
                    <Label
                      htmlFor={`selected-${method.value}`}
                      className={cn(
                        'flex-1 flex items-center justify-center px-3 py-3 border-2 rounded-lg cursor-pointer transition-all',
                        selectedMethod === method.value
                          ? 'border-success bg-success/10 text-success'
                          : 'border-border hover:border-border/80'
                      )}
                    >
                      <span className="text-sm font-medium">{method.label}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Nota */}
            <div className="space-y-2">
              <Label htmlFor="note">Nota (opcional)</Label>
              <Textarea
                id="note"
                {...register('note')}
                rows={2}
                className="resize-none"
                placeholder="Información adicional del pago..."
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!isOnline || paySelectedMutation.isPending || totals.selectedCount === 0}
                className="bg-success text-white hover:bg-success/90"
              >
                {paySelectedMutation.isPending ? (
                  'Procesando...'
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Pagar/Abonar Seleccionadas
                  </span>
                )}
              </Button>
            </div>

            {!isOnline && (
              <p className="text-xs text-warning">Disponible solo con conexión a internet.</p>
            )}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
