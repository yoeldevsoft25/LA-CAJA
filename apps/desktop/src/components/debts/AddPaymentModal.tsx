import { useEffect, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { DollarSign, CreditCard, AlertTriangle } from 'lucide-react'
import { Debt, debtsService, calculateDebtTotals, PaymentMethod } from '@/services/debts.service'
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
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useAuth } from '@/stores/auth.store'
import { useOnline } from '@/hooks/use-online'

const LIVE_BCV_REFETCH_MS = 30_000

const paymentSchema = z.object({
  amount_usd: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  amount_bs: z.number().min(0, 'El monto en Bs no puede ser negativo'),
  method: z.enum(['CASH_BS', 'CASH_USD', 'PAGO_MOVIL', 'TRANSFER', 'OTHER']),
  note: z.string().optional(),
  rollover_remaining: z.boolean().optional(),
})

type PaymentFormData = z.infer<typeof paymentSchema>

interface AddPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  debt: Debt | null
  onSuccess?: () => void
}

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH_BS', label: 'Efectivo Bs' },
  { value: 'CASH_USD', label: 'Efectivo USD' },
  { value: 'PAGO_MOVIL', label: 'Pago Móvil' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' },
]

export default function AddPaymentModal({
  isOpen,
  onClose,
  debt,
  onSuccess,
}: AddPaymentModalProps) {
  const { user } = useAuth()
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
      method: 'CASH_BS',
      note: '',
      rollover_remaining: false,
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
  const debtId = debt?.id
  const debtWithTotals = useMemo(() => (debt ? calculateDebtTotals(debt) : null), [debt])

  const amountUsd = watch('amount_usd')
  const amountBs = watch('amount_bs')
  const selectedMethod = watch('method')
  const rolloverRemaining = Boolean(watch('rollover_remaining'))
  const inputSourceRef = useRef<'usd' | 'bs' | null>(null)

  // Cálculo bidireccional USD ↔ Bs con la tasa del día: al editar uno se actualiza el otro
  useEffect(() => {
    if (exchangeRate <= 0) {
      if (amountUsd <= 0) return
      setValue('amount_bs', 0, { shouldValidate: false })
      return
    }
    if (inputSourceRef.current === 'usd') {
      const calculatedBs = amountUsd >= 0 ? Math.round(amountUsd * exchangeRate * 100) / 100 : 0
      setValue('amount_bs', calculatedBs, { shouldValidate: false })
    } else if (inputSourceRef.current === 'bs') {
      const calculatedUsd = amountBs >= 0 ? Math.round((amountBs / exchangeRate) * 100) / 100 : 0
      setValue('amount_usd', calculatedUsd, { shouldValidate: false })
    }
  }, [amountUsd, amountBs, exchangeRate, setValue])

  // Reset form cuando se abre el modal
  useEffect(() => {
    if (isOpen && debtId) {
      inputSourceRef.current = null
      reset({
        amount_usd: 0,
        amount_bs: 0,
        method: 'CASH_BS',
        note: '',
        rollover_remaining: false,
      })
    }
  }, [isOpen, debtId, reset])

  const addPaymentMutation = useMutation({
    mutationFn: (data: PaymentFormData) => {
      if (!user) throw new Error('Usuario no autenticado')

      return debtsService.addPayment(debt!.id, {
        amount_bs: data.amount_bs,
        amount_usd: data.amount_usd,
        method: data.method,
        note: data.note,
        rollover_remaining: data.rollover_remaining,
        store_id: user.store_id,
        user_id: user.user_id
      })
    },
    onSuccess: () => {
      toast.success('Pago registrado exitosamente')
      onSuccess?.()
      onClose()
    },
    onError: (error: any) => {
      console.error('Error al registrar pago:', error)
      let message = 'Error al registrar el pago'

      if (error.response?.data) {
        // Si hay un mensaje directo
        if (error.response.data.message) {
          message = error.response.data.message
        }
        // Si hay un array de mensajes de validación
        else if (Array.isArray(error.response.data.message)) {
          message = error.response.data.message.join(', ')
        }
        // Si hay un objeto con mensajes
        else if (typeof error.response.data.message === 'object') {
          const messages = Object.values(error.response.data.message).flat()
          message = messages.join(', ')
        }
      }

      toast.error(message)
    },
  })

  const onSubmit = (data: PaymentFormData) => {
    if (!debt || !debtWithTotals) return

    // Validar que no exceda el saldo pendiente en USD (moneda de referencia)
    if (data.amount_usd > debtWithTotals.remaining_usd + 0.01) {
      toast.error(`El monto excede el saldo pendiente ($${debtWithTotals.remaining_usd.toFixed(2)})`)
      return
    }

    if (data.rollover_remaining) {
      if (!isOnline) {
        toast.error('El traslado de saldo requiere conexión a internet')
        return
      }
      const remainingAfterPayment = debtWithTotals.remaining_usd - data.amount_usd
      if (remainingAfterPayment <= 0.01) {
        toast.error('No hay saldo restante para trasladar a una nueva deuda')
        return
      }
    }

    // El backend calculará el amount_bs usando la tasa BCV actual
    // Solo enviamos el amount_usd y un amount_bs aproximado (el backend lo recalculará)
    addPaymentMutation.mutate({
      amount_usd: data.amount_usd,
      amount_bs: data.amount_bs, // El backend lo recalculará con la tasa BCV actual
      method: data.method,
      note: data.note,
      rollover_remaining: data.rollover_remaining,
    })
  }

  const handlePayFull = () => {
    if (!debtWithTotals) return
    inputSourceRef.current = 'usd'
    setValue('amount_usd', debtWithTotals.remaining_usd, { shouldValidate: true })
    setValue('rollover_remaining', false, { shouldValidate: false })
    if (exchangeRate > 0) {
      setValue('amount_bs', Math.round(debtWithTotals.remaining_usd * exchangeRate * 100) / 100, { shouldValidate: false })
    } else {
      setValue('amount_bs', 0, { shouldValidate: false })
    }
  }

  if (!debt || !debtWithTotals) return null

  const isLoading = addPaymentMutation.isPending

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl">Registrar Abono</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm mt-0.5">
            {debt.customer ? `Cliente: ${debt.customer.name}` : 'Registra un nuevo abono a la deuda'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
            <div className="space-y-4 sm:space-y-5">
              {/* Info de saldo pendiente */}
              <Alert className="bg-warning/5 border-warning/50">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertTitle className="text-warning">Saldo Pendiente</AlertTitle>
                <AlertDescription className="text-warning">
                  <p className="text-2xl font-bold">
                    ${debtWithTotals.remaining_usd.toFixed(2)} USD
                  </p>
                  <p className="text-sm">
                    {debtWithTotals.remaining_bs.toFixed(2)} Bs
                  </p>
                </AlertDescription>
              </Alert>

              {/* Tasa de cambio */}
              {exchangeRate > 0 && (
                <Card className="bg-info/5 border-info/50">
                  <CardContent className="p-3">
                    <p className="text-sm text-info">
                      Tasa BCV: <strong>{exchangeRate.toFixed(2)} Bs/USD</strong>
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Monto USD */}
              <div className="space-y-2">
                <Label htmlFor="amount_usd" className="text-sm font-semibold">
                  Monto a Abonar (USD) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <Input
                    id="amount_usd"
                    type="number"
                    step="0.01"
                    {...register('amount_usd', { valueAsNumber: true })}
                    className="pl-10 pr-4 py-2.5 text-lg"
                    placeholder="0.00"
                    autoFocus
                    onFocus={() => { inputSourceRef.current = 'usd' }}
                  />
                </div>
                {errors.amount_usd && (
                  <p className="text-sm text-destructive">{errors.amount_usd.message}</p>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handlePayFull}
                  className="h-auto p-0 text-sm text-success hover:text-success/90 font-medium"
                >
                  Pagar saldo completo (${debtWithTotals.remaining_usd.toFixed(2)})
                </Button>
              </div>

              {/* Monto Bs: editable; se calcula con la tasa del día al editar USD o Bs */}
              <div className="space-y-2">
                <Label htmlFor="amount_bs" className="text-sm font-semibold">
                  Monto en Bs
                  <span className="text-xs font-normal text-muted-foreground ml-2">(Tasa del día: {exchangeRate > 0 ? `${exchangeRate.toFixed(2)} Bs/USD` : '—'})</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground font-medium">Bs</span>
                  <Input
                    id="amount_bs"
                    type="number"
                    step="0.01"
                    {...register('amount_bs', { valueAsNumber: true })}
                    className="pl-10 pr-4 py-2.5 text-lg"
                    placeholder="0.00"
                    readOnly={exchangeRate <= 0}
                    onFocus={() => { inputSourceRef.current = 'bs' }}
                  />
                </div>
                {exchangeRate <= 0 && (
                  <p className="text-xs text-muted-foreground">Configure la tasa BCV para abonar en Bs.</p>
                )}
              </div>

              {/* Trasladar saldo restante */}
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="rollover_remaining"
                    checked={rolloverRemaining}
                    disabled={!isOnline}
                    onCheckedChange={(checked) => setValue('rollover_remaining', checked === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="rollover_remaining" className="text-sm font-semibold">
                      Cerrar esta deuda y abrir una nueva por el saldo restante
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      El abono se registra aquí y el saldo pendiente se mueve a una nueva deuda.
                    </p>
                    {!isOnline && (
                      <p className="text-xs text-warning">Disponible solo con conexión a internet.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Método de pago */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">
                  Método de Pago <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  value={selectedMethod}
                  onValueChange={(value) => setValue('method', value as any)}
                  className="grid grid-cols-2 gap-x-4 gap-y-3"
                >
                  {paymentMethods.map((method) => (
                    <div key={method.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={method.value} id={method.value} />
                      <Label
                        htmlFor={method.value}
                        className={cn(
                          'flex-1 flex items-center justify-center px-3 py-3 border-2 rounded-lg cursor-pointer transition-all',
                          selectedMethod === method.value
                            ? 'border-success bg-success/10 text-success'
                            : 'border-border hover:border-border/80'
                        )}
                      >
                        <CreditCard className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span className="text-sm font-medium">{method.label}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                {errors.method && (
                  <p className="text-sm text-destructive">{errors.method.message}</p>
                )}
              </div>

              {/* Nota */}
              <div className="space-y-2">
                <Label htmlFor="note" className="text-sm font-semibold">
                  Nota (opcional)
                </Label>
                <Textarea
                  id="note"
                  {...register('note')}
                  rows={2}
                  className="resize-none"
                  placeholder="Información adicional del pago..."
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading || amountUsd <= 0}
                className="flex-1 bg-success hover:bg-success/90 text-white"
              >
                {isLoading ? 'Registrando...' : 'Registrar Abono'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
