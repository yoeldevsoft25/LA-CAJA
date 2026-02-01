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
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            Pago Parcial (Recibo Parcial)
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
              <div className="p-4 border border-border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Total de la Orden:</span>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">
                      ${orderTotal.usd.toFixed(2)} USD
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {orderTotal.bs.toFixed(2)} Bs
                    </p>
                  </div>
                </div>
              </div>

              {/* Monto en Bs */}
              <div>
                <Label htmlFor="amount_bs">
                  Monto en Bolívares <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="amount_bs"
                  type="number"
                  step="0.01"
                  min="0"
                  max={orderTotal.bs}
                  {...register('amount_bs', { valueAsNumber: true })}
                  className="mt-2"
                  placeholder="0.00"
                  disabled={isLoading}
                />
                {errors.amount_bs && (
                  <p className="mt-1 text-sm text-destructive">{errors.amount_bs.message}</p>
                )}
                {amountBs > orderTotal.bs && (
                  <p className="mt-1 text-sm text-warning">
                    El monto excede el total de la orden
                  </p>
                )}
              </div>

              {/* Monto en USD */}
              <div>
                <Label htmlFor="amount_usd">
                  Monto en Dólares <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="amount_usd"
                  type="number"
                  step="0.01"
                  min="0"
                  max={orderTotal.usd}
                  {...register('amount_usd', { valueAsNumber: true })}
                  className="mt-2"
                  placeholder="0.00"
                  disabled={isLoading}
                />
                {errors.amount_usd && (
                  <p className="mt-1 text-sm text-destructive">{errors.amount_usd.message}</p>
                )}
                {amountUsd > orderTotal.usd && (
                  <p className="mt-1 text-sm text-warning">
                    El monto excede el total de la orden
                  </p>
                )}
              </div>

              {/* Método de pago */}
              <div>
                <Label htmlFor="payment_method">Método de Pago</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) =>
                    setValue('payment_method', value as CreatePartialPaymentRequest['payment_method'])
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger className="mt-2">
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
              <div>
                <Label htmlFor="note">Nota (Opcional)</Label>
                <Textarea
                  id="note"
                  {...register('note')}
                  rows={2}
                  className="mt-2 resize-none"
                  placeholder="Notas sobre el pago parcial..."
                  maxLength={500}
                  disabled={isLoading}
                />
              </div>

              {/* Resumen */}
              {(amountBs > 0 || amountUsd > 0) && (
                <div className="p-4 border border-primary/50 rounded-lg bg-primary/5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pago Parcial:</span>
                      <span className="font-semibold text-foreground">
                        ${amountUsd.toFixed(2)} USD / {amountBs.toFixed(2)} Bs
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Restante:</span>
                      <span className="font-semibold text-primary">
                        ${(orderTotal.usd - amountUsd).toFixed(2)} USD /{' '}
                        {(orderTotal.bs - amountBs).toFixed(2)} Bs
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isLoading || amountBs <= 0 || amountUsd <= 0}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <DollarSign className="w-5 h-5 mr-2" />
                    Registrar Pago Parcial
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

