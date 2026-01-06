import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { DollarSign, CreditCard, AlertTriangle } from 'lucide-react'
import { Debt, debtsService, calculateDebtTotals, PaymentMethod } from '@/services/debts.service'
import { exchangeService } from '@/services/exchange.service'
import toast from 'react-hot-toast'
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
    },
  })

  // Obtener tasa BCV (usa cache del prefetch)
  const { data: bcvRateData } = useQuery({
    queryKey: ['exchange', 'bcv'],
    queryFn: () => exchangeService.getBCVRate(),
    staleTime: 1000 * 60 * 60 * 2, // 2 horas
    gcTime: Infinity, // Nunca eliminar
    enabled: isOpen,
  })

  const exchangeRate = bcvRateData?.rate || 0
  const debtId = debt?.id
  const debtWithTotals = useMemo(() => (debt ? calculateDebtTotals(debt) : null), [debt])

  // Observar cambios en amount_usd para calcular amount_bs
  const amountUsd = watch('amount_usd')
  const selectedMethod = watch('method')

  useEffect(() => {
    if (amountUsd > 0 && exchangeRate > 0) {
      // Siempre usar tasa BCV actual para los pagos
      const calculatedBs = Math.round(amountUsd * exchangeRate * 100) / 100
      setValue('amount_bs', calculatedBs, { shouldValidate: false })
    } else if (amountUsd <= 0) {
      setValue('amount_bs', 0, { shouldValidate: false })
    }
  }, [amountUsd, exchangeRate, setValue])

  // Reset form cuando se abre el modal - solo depende de isOpen y debt.id
  useEffect(() => {
    if (isOpen && debtId) {
      reset({
        amount_usd: 0,
        amount_bs: 0,
        method: 'CASH_BS',
        note: '',
      })
    }
  }, [isOpen, debtId, reset])

  const addPaymentMutation = useMutation({
    mutationFn: (data: PaymentFormData) => debtsService.addPayment(debt!.id, {
      amount_bs: data.amount_bs,
      amount_usd: data.amount_usd,
      method: data.method,
      note: data.note,
    }),
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

    // El backend calculará el amount_bs usando la tasa BCV actual
    // Solo enviamos el amount_usd y un amount_bs aproximado (el backend lo recalculará)
    addPaymentMutation.mutate({
      amount_usd: data.amount_usd,
      amount_bs: data.amount_bs, // El backend lo recalculará con la tasa BCV actual
      method: data.method,
      note: data.note,
    })
  }

  const handlePayFull = () => {
    if (!debtWithTotals) return
    setValue('amount_usd', debtWithTotals.remaining_usd, { shouldValidate: true })
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

              {/* Monto Bs (calculado automáticamente) */}
              <div className="space-y-2">
                <Label htmlFor="amount_bs" className="text-sm font-semibold">
                  Equivalente en Bs
                  <span className="text-xs font-normal text-muted-foreground ml-2">(Calculado automáticamente)</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground font-medium">Bs</span>
                  <Input
                    id="amount_bs"
                    type="number"
                    step="0.01"
                    {...register('amount_bs', { valueAsNumber: true })}
                    className="pl-10 pr-4 py-2.5 text-lg bg-muted text-muted-foreground cursor-not-allowed"
                    placeholder="0.00"
                    readOnly
                  />
                </div>
              </div>

              {/* Método de pago */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Método de Pago <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  value={selectedMethod}
                  onValueChange={(value) => setValue('method', value as PaymentMethod)}
                  className="grid grid-cols-2 sm:grid-cols-3 gap-2"
                >
                  {paymentMethods.map((method) => (
                    <div key={method.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={method.value} id={method.value} />
                      <Label
                        htmlFor={method.value}
                        className={cn(
                          'flex-1 flex items-center justify-center px-3 py-2.5 border-2 rounded-lg cursor-pointer transition-all',
                          selectedMethod === method.value
                            ? 'border-success bg-success/10 text-success'
                            : 'border-border hover:border-border/80'
                        )}
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
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
