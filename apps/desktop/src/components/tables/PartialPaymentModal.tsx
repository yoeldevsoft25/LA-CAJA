import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DollarSign } from 'lucide-react'
import { CreatePartialPaymentRequest } from '@/services/orders.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

const paymentSchema = z.object({
  amount_bs: z.number().min(0, 'El monto debe ser mayor o igual a 0'),
  amount_usd: z.number().min(0, 'El monto debe ser mayor o igual a 0'),
  payment_method: z.enum(['CASH_BS', 'CASH_USD', 'PAGO_MOVIL', 'TRANSFER', 'OTHER', 'SPLIT']),
  note: z.string().max(500).nullable().optional(),
})

type PaymentFormData = z.infer<typeof paymentSchema>

const paymentMethodLabels: Record<string, string> = {
  CASH_BS: 'Efectivo Bs',
  CASH_USD: 'Efectivo USD',
  PAGO_MOVIL: 'Pago Móvil',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
  SPLIT: 'Mixto',
}

interface PartialPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  orderTotal: { bs: number; usd: number }
  onConfirm: (data: CreatePartialPaymentRequest) => void
  isLoading: boolean
}

export default function PartialPaymentModal({
  isOpen,
  onClose,
  orderTotal,
  onConfirm,
  isLoading,
}: PartialPaymentModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount_bs: 0,
      amount_usd: 0,
      payment_method: 'CASH_USD',
      note: null,
    },
  })

  const amountBs = watch('amount_bs')
  const amountUsd = watch('amount_usd')
  const paymentMethod = watch('payment_method')

  useEffect(() => {
    if (!isOpen) {
      reset({
        amount_bs: 0,
        amount_usd: 0,
        payment_method: 'CASH_USD',
        note: null,
      })
    }
  }, [isOpen, reset])

  const onSubmit = (data: PaymentFormData) => {
    const requestData: CreatePartialPaymentRequest = {
      amount_bs: data.amount_bs,
      amount_usd: data.amount_usd,
      payment_method: data.payment_method,
      note: data.note || null,
    }
    onConfirm(requestData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0 pr-12">
          <DialogTitle className="text-base sm:text-lg md:text-xl flex items-center">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            Pago Parcial (Recibo)
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
            <div className="space-y-4">
              <Alert className="bg-info/5 border-info/50">
                <AlertDescription className="text-sm text-foreground">
                  Registra un pago parcial sobre la orden. El monto restante quedará pendiente.
                </AlertDescription>
              </Alert>

              {/* Total de la orden */}
              <div className="p-4 border border-primary/20 rounded-2xl bg-primary/5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Pendiente</span>
                  <div className="text-right">
                    <p className="text-lg font-black text-primary tabular-nums leading-none">
                      ${orderTotal.usd.toFixed(2)}
                    </p>
                    <p className="text-xs font-bold text-muted-foreground tabular-nums mt-1">
                      {orderTotal.bs.toFixed(2)} Bs
                    </p>
                  </div>
                </div>
              </div>

              {/* Monto en Bs */}
              <div className="space-y-2">
                <Label htmlFor="amount_bs" className="text-sm sm:text-base font-bold text-muted-foreground uppercase tracking-wider ml-1">
                  Monto en Bolívares
                </Label>
                <Input
                  id="amount_bs"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max={orderTotal.bs}
                  {...register('amount_bs', { valueAsNumber: true })}
                  className="h-12 text-base border-muted/40 bg-white/60 focus:bg-white shadow-sm font-bold"
                  placeholder="0.00"
                  disabled={isLoading}
                />
                {errors.amount_bs && (
                  <p className="mt-1 text-sm text-destructive font-bold">{errors.amount_bs.message}</p>
                )}
                {amountBs > orderTotal.bs && (
                  <p className="mt-1 text-sm text-warning font-bold">
                    El monto excede el total de la orden
                  </p>
                )}
              </div>

              {/* Monto en USD */}
              <div className="space-y-2">
                <Label htmlFor="amount_usd" className="text-sm sm:text-base font-bold text-muted-foreground uppercase tracking-wider ml-1">
                  Monto en Dólares
                </Label>
                <Input
                  id="amount_usd"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max={orderTotal.usd}
                  {...register('amount_usd', { valueAsNumber: true })}
                  className="h-12 text-base border-muted/40 bg-white/60 focus:bg-white shadow-sm font-bold"
                  placeholder="0.00"
                  disabled={isLoading}
                />
                {errors.amount_usd && (
                  <p className="mt-1 text-sm text-destructive font-bold">{errors.amount_usd.message}</p>
                )}
                {amountUsd > orderTotal.usd && (
                  <p className="mt-1 text-sm text-warning font-bold">
                    El monto excede el total de la orden
                  </p>
                )}
              </div>

              {/* Método de pago */}
              <div className="space-y-2">
                <Label htmlFor="payment_method" className="text-sm sm:text-base font-bold text-muted-foreground uppercase tracking-wider ml-1">
                  Método de Pago
                </Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) =>
                    setValue('payment_method', value as CreatePartialPaymentRequest['payment_method'])
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger className="h-12 text-base border-muted/40 bg-white/60 shadow-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH_BS">{paymentMethodLabels.CASH_BS}</SelectItem>
                    <SelectItem value="CASH_USD">{paymentMethodLabels.CASH_USD}</SelectItem>
                    <SelectItem value="PAGO_MOVIL">{paymentMethodLabels.PAGO_MOVIL}</SelectItem>
                    <SelectItem value="TRANSFER">{paymentMethodLabels.TRANSFER}</SelectItem>
                    <SelectItem value="OTHER">{paymentMethodLabels.OTHER}</SelectItem>
                    <SelectItem value="SPLIT">{paymentMethodLabels.SPLIT}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Nota */}
              <div className="space-y-2">
                <Label htmlFor="note" className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Nota (Opcional)</Label>
                <Textarea
                  id="note"
                  {...register('note')}
                  rows={2}
                  className="text-base border-muted/40 bg-white/60 focus:bg-white shadow-sm resize-none"
                  placeholder="Notas sobre el pago parcial..."
                  maxLength={500}
                  disabled={isLoading}
                />
              </div>

              {/* Resumen */}
              {(amountBs > 0 || amountUsd > 0) && (
                <div className="p-4 border-2 border-primary/20 rounded-2xl bg-primary/5 shadow-inner">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pago Actual</span>
                      <span className="font-black text-foreground tabular-nums">
                        ${amountUsd.toFixed(2)} / {amountBs.toFixed(2)} Bs
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                      <span className="text-xs font-bold text-primary/70 uppercase tracking-widest">Nuevo Saldo</span>
                      <span className="font-black text-primary tabular-nums">
                        ${Math.max(0, orderTotal.usd - amountUsd).toFixed(2)} /{' '}
                        {Math.max(0, orderTotal.bs - amountBs).toFixed(2)} Bs
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-card">
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-12 flex-1 font-semibold btn-glass-neutral transition-all px-6"
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="h-12 flex-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 px-8 transition-all"
                disabled={isLoading || (amountBs <= 0 && amountUsd <= 0)}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <DollarSign className="w-5 h-5 mr-2" />
                    Registrar Pago
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

