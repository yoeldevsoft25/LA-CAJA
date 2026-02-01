import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowDownCircle, ArrowUpCircle, DollarSign } from 'lucide-react'
import { CreateCashMovementRequest } from '@/services/payments.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

const cashMovementSchema = z.object({
  movement_type: z.enum(['entry', 'exit']),
  amount_bs: z
    .number({ message: 'El monto en Bs es requerido' })
    .min(0, 'El monto en Bs no puede ser negativo')
    .max(999999999.99, 'El monto en Bs excede el límite máximo'),
  amount_usd: z
    .number({ message: 'El monto en USD es requerido' })
    .min(0, 'El monto en USD no puede ser negativo')
    .max(999999999.99, 'El monto en USD excede el límite máximo'),
  reason: z.string().min(1, 'La razón es requerida').max(100, 'La razón no puede exceder 100 caracteres'),
  note: z.string().optional(),
})

type CashMovementFormData = z.infer<typeof cashMovementSchema>

interface CashMovementModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: CreateCashMovementRequest) => void
  isLoading: boolean
  shiftId?: string | null
  cashSessionId?: string | null
}

export default function CashMovementModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  shiftId,
  cashSessionId,
}: CashMovementModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<CashMovementFormData>({
    resolver: zodResolver(cashMovementSchema),
    defaultValues: {
      movement_type: 'entry',
      amount_bs: 0,
      amount_usd: 0,
      reason: '',
      note: '',
    },
  })

  const movementType = watch('movement_type')

  const onSubmit = (data: CashMovementFormData) => {
    const requestData: CreateCashMovementRequest = {
      movement_type: data.movement_type,
      amount_bs: Math.round(data.amount_bs * 100) / 100,
      amount_usd: Math.round(data.amount_usd * 100) / 100,
      reason: data.reason,
      note: data.note || null,
      shift_id: shiftId || null,
      cash_session_id: cashSessionId || null,
    }
    onConfirm(requestData)
    reset()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            {movementType === 'entry' ? (
              <ArrowDownCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 mr-2" />
            ) : (
              <ArrowUpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 mr-2" />
            )}
            {movementType === 'entry' ? 'Entrada de Efectivo' : 'Salida de Efectivo'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Registra un movimiento de efectivo en la caja
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
            <div className="space-y-4">
              <Alert className="bg-info/5 border-info/50">
                <AlertDescription className="text-sm text-foreground">
                  Registra entradas o salidas de efectivo de la caja. Este registro quedará en la
                  bitácora de movimientos.
                </AlertDescription>
              </Alert>

              {/* Tipo de movimiento */}
              <div>
                <Label className="text-sm font-semibold mb-3 block">Tipo de Movimiento</Label>
                <RadioGroup
                  value={movementType}
                  onValueChange={(value) => {
                    reset({
                      ...watch(),
                      movement_type: value as CashMovementFormData['movement_type'],
                    })
                  }}
                  className="grid grid-cols-2 gap-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="entry" id="entry" />
                    <Label
                      htmlFor="entry"
                      className="flex-1 flex items-center justify-center px-4 py-3 border-2 rounded-lg cursor-pointer transition-all border-green-200 hover:border-green-300"
                    >
                      <ArrowDownCircle className="w-4 h-4 mr-2 text-green-600" />
                      <span className="text-sm font-medium">Entrada</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="exit" id="exit" />
                    <Label
                      htmlFor="exit"
                      className="flex-1 flex items-center justify-center px-4 py-3 border-2 rounded-lg cursor-pointer transition-all border-red-200 hover:border-red-300"
                    >
                      <ArrowUpCircle className="w-4 h-4 mr-2 text-red-600" />
                      <span className="text-sm font-medium">Salida</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Montos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount_bs" className="mb-2">
                    Monto en Bs <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="amount_bs"
                      type="number"
                      step="0.01"
                      min="0"
                      max="999999999.99"
                      {...register('amount_bs', { valueAsNumber: true })}
                      className={`pl-10 ${errors.amount_bs ? 'border-destructive' : ''}`}
                      placeholder="0.00"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.amount_bs && (
                    <p className="mt-1 text-sm text-destructive">{errors.amount_bs.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="amount_usd" className="mb-2">
                    Monto en USD <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="amount_usd"
                      type="number"
                      step="0.01"
                      min="0"
                      max="999999999.99"
                      {...register('amount_usd', { valueAsNumber: true })}
                      className={`pl-10 ${errors.amount_usd ? 'border-destructive' : ''}`}
                      placeholder="0.00"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.amount_usd && (
                    <p className="mt-1 text-sm text-destructive">{errors.amount_usd.message}</p>
                  )}
                </div>
              </div>

              {/* Razón */}
              <div>
                <Label htmlFor="reason" className="mb-2">
                  Razón <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reason"
                  {...register('reason')}
                  className={errors.reason ? 'border-destructive' : ''}
                  placeholder="Ej: Retiro para compra, Entrada de cambio..."
                  maxLength={100}
                  disabled={isLoading}
                />
                {errors.reason && (
                  <p className="mt-1 text-sm text-destructive">{errors.reason.message}</p>
                )}
              </div>

              {/* Nota */}
              <div>
                <Label htmlFor="note">Nota (opcional)</Label>
                <Textarea
                  id="note"
                  {...register('note')}
                  rows={3}
                  className="mt-2 resize-none"
                  placeholder="Observaciones adicionales..."
                  disabled={isLoading}
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
                className="flex-1"
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className={cn(
                  'flex-1',
                  movementType === 'entry'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                )}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Registrando...
                  </>
                ) : (
                  <>
                    {movementType === 'entry' ? (
                      <ArrowDownCircle className="w-5 h-5 mr-2" />
                    ) : (
                      <ArrowUpCircle className="w-5 h-5 mr-2" />
                    )}
                    Registrar Movimiento
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
