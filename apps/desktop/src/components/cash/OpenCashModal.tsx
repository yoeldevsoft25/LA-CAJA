import { DollarSign, Lock } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { OpenCashSessionRequest } from '@/services/cash.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

const openCashSchema = z.object({
  cash_bs: z
    .number({ message: 'El monto en Bs es requerido' })
    .min(0, 'El monto en Bs no puede ser negativo')
    .max(999999999.99, 'El monto en Bs excede el límite máximo'),
  cash_usd: z
    .number({ message: 'El monto en USD es requerido' })
    .min(0, 'El monto en USD no puede ser negativo')
    .max(999999999.99, 'El monto en USD excede el límite máximo'),
  note: z.string().optional(),
})

interface OpenCashModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: OpenCashSessionRequest) => void
  isLoading: boolean
}

export default function OpenCashModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: OpenCashModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OpenCashSessionRequest>({
    resolver: zodResolver(openCashSchema),
    defaultValues: {
      cash_bs: 0,
      cash_usd: 0,
      note: '',
    },
  })

  const onSubmit = (data: OpenCashSessionRequest) => {
    // Redondear a 2 decimales
    const roundedData = {
      ...data,
      cash_bs: Math.round(data.cash_bs * 100) / 100,
      cash_usd: Math.round(data.cash_usd * 100) / 100,
    }
    onConfirm(roundedData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            Abrir Caja
          </DialogTitle>
          <DialogDescription className="sr-only">
            Ingresa los montos de apertura de caja
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
            <div className="space-y-4">
              <Alert className="bg-info/5 border-info/50">
                <AlertDescription className="text-sm text-foreground">
                  Ingresa los montos de apertura de caja. Estos valores deben coincidir con el dinero
                  físico disponible en la caja.
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="cash_bs" className="mb-2">
                  Monto de Apertura en Bs <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="cash_bs"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max="999999999.99"
                    {...register('cash_bs', { valueAsNumber: true })}
                    className={`pl-10 ${errors.cash_bs ? 'border-destructive' : ''}`}
                    placeholder="0.00"
                    disabled={isLoading}
                  />
                </div>
                {errors.cash_bs && (
                  <p className="mt-1 text-sm text-destructive">{errors.cash_bs.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="cash_usd" className="mb-2">
                  Monto de Apertura en USD <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="cash_usd"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max="999999999.99"
                    {...register('cash_usd', { valueAsNumber: true })}
                    className={`pl-10 ${errors.cash_usd ? 'border-destructive' : ''}`}
                    placeholder="0.00"
                    disabled={isLoading}
                  />
                </div>
                {errors.cash_usd && (
                  <p className="mt-1 text-sm text-destructive">{errors.cash_usd.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="note">Nota (opcional)</Label>
                <Textarea
                  id="note"
                  {...register('note')}
                  rows={3}
                  className="mt-2 resize-none"
                  placeholder="Observaciones sobre la apertura..."
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
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Abriendo...
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5 mr-2" />
                    Abrir Caja
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

