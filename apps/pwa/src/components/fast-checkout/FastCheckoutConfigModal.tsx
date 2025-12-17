import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Zap, Settings } from 'lucide-react'
import {
  FastCheckoutConfig,
  CreateFastCheckoutConfigRequest,
  PaymentMethod,
} from '@/services/fast-checkout.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

const fastCheckoutConfigSchema = z.object({
  max_items: z.number().min(1).max(50),
  enabled: z.boolean().optional(),
  allow_discounts: z.boolean().optional(),
  allow_customer_selection: z.boolean().optional(),
  default_payment_method: z.enum(['CASH_BS', 'CASH_USD', 'PAGO_MOVIL', 'TRANSFER', 'OTHER']).nullable().optional(),
})

type FastCheckoutConfigFormData = z.infer<typeof fastCheckoutConfigSchema>

const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH_BS: 'Efectivo Bs',
  CASH_USD: 'Efectivo USD',
  PAGO_MOVIL: 'Pago Móvil',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
}

interface FastCheckoutConfigModalProps {
  isOpen: boolean
  onClose: () => void
  config: FastCheckoutConfig | null
  onConfirm: (data: CreateFastCheckoutConfigRequest) => void
  isLoading: boolean
}

export default function FastCheckoutConfigModal({
  isOpen,
  onClose,
  config,
  onConfirm,
  isLoading,
}: FastCheckoutConfigModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<FastCheckoutConfigFormData>({
    resolver: zodResolver(fastCheckoutConfigSchema),
    defaultValues: {
      max_items: 10,
      enabled: true,
      allow_discounts: false,
      allow_customer_selection: false,
      default_payment_method: null,
    },
  })

  const enabled = watch('enabled')
  const allowDiscounts = watch('allow_discounts')
  const allowCustomerSelection = watch('allow_customer_selection')

  useEffect(() => {
    if (config) {
      reset({
        max_items: config.max_items,
        enabled: config.enabled,
        allow_discounts: config.allow_discounts,
        allow_customer_selection: config.allow_customer_selection,
        default_payment_method: config.default_payment_method,
      })
    } else {
      reset({
        max_items: 10,
        enabled: true,
        allow_discounts: false,
        allow_customer_selection: false,
        default_payment_method: null,
      })
    }
  }, [config, reset])

  const onSubmit = (data: FastCheckoutConfigFormData) => {
    const requestData: CreateFastCheckoutConfigRequest = {
      max_items: data.max_items,
      enabled: data.enabled ?? true,
      allow_discounts: data.allow_discounts ?? false,
      allow_customer_selection: data.allow_customer_selection ?? false,
      default_payment_method: data.default_payment_method || null,
    }
    onConfirm(requestData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            Configurar Modo Caja Rápida
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configura las reglas y opciones para el modo caja rápida
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
            <div className="space-y-6">
              <Alert className="bg-info/5 border-info/50">
                <AlertDescription className="text-sm text-foreground">
                  El modo caja rápida permite ventas rápidas con productos pre-configurados y teclas
                  de acceso rápido. Configura los límites y restricciones aquí.
                </AlertDescription>
              </Alert>

              {/* Habilitar modo */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enabled" className="text-base">
                    Habilitar Modo Caja Rápida
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Activa o desactiva el modo caja rápida
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={enabled}
                  onCheckedChange={(checked) => setValue('enabled', checked)}
                  disabled={isLoading}
                />
              </div>

              {/* Límite de items */}
              <div>
                <Label htmlFor="max_items">
                  Límite Máximo de Items <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="max_items"
                  type="number"
                  step="1"
                  min="1"
                  max="50"
                  {...register('max_items', { valueAsNumber: true })}
                  className="mt-2"
                  placeholder="10"
                  disabled={isLoading}
                />
                {errors.max_items && (
                  <p className="mt-1 text-sm text-destructive">{errors.max_items.message}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Número máximo de items permitidos en una venta rápida (1-50)
                </p>
              </div>

              {/* Permitir descuentos */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allow_discounts" className="text-base">
                    Permitir Descuentos
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Si está activado, se permitirán descuentos en modo rápido
                  </p>
                </div>
                <Switch
                  id="allow_discounts"
                  checked={allowDiscounts}
                  onCheckedChange={(checked) => setValue('allow_discounts', checked)}
                  disabled={isLoading}
                />
              </div>

              {/* Permitir selección de cliente */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allow_customer_selection" className="text-base">
                    Permitir Selección de Cliente
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Si está activado, se permitirá seleccionar cliente en modo rápido
                  </p>
                </div>
                <Switch
                  id="allow_customer_selection"
                  checked={allowCustomerSelection}
                  onCheckedChange={(checked) => setValue('allow_customer_selection', checked)}
                  disabled={isLoading}
                />
              </div>

              {/* Método de pago por defecto */}
              <div>
                <Label htmlFor="default_payment_method">Método de Pago por Defecto</Label>
                <Select
                  value={watch('default_payment_method') || 'none'}
                  onValueChange={(value) =>
                    setValue('default_payment_method', value === 'none' ? null : (value as PaymentMethod))
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Sin método por defecto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin método por defecto</SelectItem>
                    <SelectItem value="CASH_BS">{paymentMethodLabels.CASH_BS}</SelectItem>
                    <SelectItem value="CASH_USD">{paymentMethodLabels.CASH_USD}</SelectItem>
                    <SelectItem value="PAGO_MOVIL">{paymentMethodLabels.PAGO_MOVIL}</SelectItem>
                    <SelectItem value="TRANSFER">{paymentMethodLabels.TRANSFER}</SelectItem>
                    <SelectItem value="OTHER">{paymentMethodLabels.OTHER}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Método de pago que se seleccionará automáticamente en modo rápido
                </p>
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
                    Guardando...
                  </>
                ) : (
                  <>
                    <Settings className="w-5 h-5 mr-2" />
                    Guardar Configuración
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

