import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Percent, Settings } from 'lucide-react'
import {
  DiscountConfig,
  CreateDiscountConfigRequest,
  AuthorizationRole,
} from '@/services/discounts.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

const discountConfigSchema = z.object({
  max_percentage: z.number().min(0).max(100).optional(),
  max_amount_bs: z.number().min(0).nullable().optional(),
  max_amount_usd: z.number().min(0).nullable().optional(),
  requires_authorization: z.boolean().optional(),
  authorization_role: z.enum(['owner', 'admin', 'supervisor', 'cashier']).nullable().optional(),
  auto_approve_below_percentage: z.number().min(0).max(100).nullable().optional(),
  auto_approve_below_amount_bs: z.number().min(0).nullable().optional(),
})

type DiscountConfigFormData = z.infer<typeof discountConfigSchema>

const roleLabels: Record<AuthorizationRole, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  supervisor: 'Supervisor',
  cashier: 'Cajero',
}

interface DiscountConfigModalProps {
  isOpen: boolean
  onClose: () => void
  config: DiscountConfig | null
  onConfirm: (data: CreateDiscountConfigRequest) => void
  isLoading: boolean
}

export default function DiscountConfigModal({
  isOpen,
  onClose,
  config,
  onConfirm,
  isLoading,
}: DiscountConfigModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<DiscountConfigFormData>({
    resolver: zodResolver(discountConfigSchema),
    defaultValues: {
      max_percentage: 0,
      max_amount_bs: null,
      max_amount_usd: null,
      requires_authorization: true,
      authorization_role: 'supervisor',
      auto_approve_below_percentage: null,
      auto_approve_below_amount_bs: null,
    },
  })

  const requiresAuthorization = watch('requires_authorization')

  useEffect(() => {
    if (config) {
      reset({
        max_percentage: Number(config.max_percentage) || 0,
        max_amount_bs: config.max_amount_bs ? Number(config.max_amount_bs) : null,
        max_amount_usd: config.max_amount_usd ? Number(config.max_amount_usd) : null,
        requires_authorization: config.requires_authorization,
        authorization_role: config.authorization_role || 'supervisor',
        auto_approve_below_percentage: config.auto_approve_below_percentage
          ? Number(config.auto_approve_below_percentage)
          : null,
        auto_approve_below_amount_bs: config.auto_approve_below_amount_bs
          ? Number(config.auto_approve_below_amount_bs)
          : null,
      })
    } else {
      reset({
        max_percentage: 0,
        max_amount_bs: null,
        max_amount_usd: null,
        requires_authorization: true,
        authorization_role: 'supervisor',
        auto_approve_below_percentage: null,
        auto_approve_below_amount_bs: null,
      })
    }
  }, [config, reset])

  const onSubmit = (data: DiscountConfigFormData) => {
    const requestData: CreateDiscountConfigRequest = {
      max_percentage: data.max_percentage === 0 ? undefined : data.max_percentage,
      max_amount_bs: data.max_amount_bs === null || data.max_amount_bs === undefined ? null : data.max_amount_bs,
      max_amount_usd: data.max_amount_usd === null || data.max_amount_usd === undefined ? null : data.max_amount_usd,
      requires_authorization: data.requires_authorization ?? true,
      authorization_role: data.authorization_role || null,
      auto_approve_below_percentage: data.auto_approve_below_percentage === null || data.auto_approve_below_percentage === undefined ? null : data.auto_approve_below_percentage,
      auto_approve_below_amount_bs: data.auto_approve_below_amount_bs === null || data.auto_approve_below_amount_bs === undefined ? null : data.auto_approve_below_amount_bs,
    }
    onConfirm(requestData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            <Percent className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            Configurar Descuentos
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configura los límites y reglas para aplicar descuentos
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
            <div className="space-y-6">
              <Alert className="bg-info/5 border-info/50">
                <AlertDescription className="text-sm text-foreground">
                  Configura los límites y reglas para aplicar descuentos. Los descuentos se pueden
                  aplicar por porcentaje o monto fijo.
                </AlertDescription>
              </Alert>

              {/* Porcentaje máximo */}
              <div>
                <Label htmlFor="max_percentage">Porcentaje Máximo de Descuento (%)</Label>
                <Input
                  id="max_percentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  {...register('max_percentage', {
                    valueAsNumber: true,
                    setValueAs: (v) => (v === '' ? 0 : Number(v)),
                  })}
                  className="mt-2"
                  placeholder="0 = Sin límite"
                  disabled={isLoading}
                />
                {errors.max_percentage && (
                  <p className="mt-1 text-sm text-destructive">{errors.max_percentage.message}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Establece 0 para no limitar el porcentaje de descuento
                </p>
              </div>

              {/* Montos máximos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="max_amount_bs">Monto Máximo de Descuento (Bs)</Label>
                  <Input
                    id="max_amount_bs"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('max_amount_bs', {
                      valueAsNumber: true,
                      setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
                    })}
                    className="mt-2"
                    placeholder="Sin límite"
                    disabled={isLoading}
                  />
                  {errors.max_amount_bs && (
                    <p className="mt-1 text-sm text-destructive">{errors.max_amount_bs.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="max_amount_usd">Monto Máximo de Descuento (USD)</Label>
                  <Input
                    id="max_amount_usd"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('max_amount_usd', {
                      valueAsNumber: true,
                      setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
                    })}
                    className="mt-2"
                    placeholder="Sin límite"
                    disabled={isLoading}
                  />
                  {errors.max_amount_usd && (
                    <p className="mt-1 text-sm text-destructive">{errors.max_amount_usd.message}</p>
                  )}
                </div>
              </div>

              {/* Requiere autorización */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="requires_authorization" className="text-base">
                    Requiere Autorización
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Si está activado, se requerirá autorización para aplicar descuentos
                  </p>
                </div>
                <Switch
                  id="requires_authorization"
                  checked={requiresAuthorization}
                  onCheckedChange={(checked) => setValue('requires_authorization', checked)}
                  disabled={isLoading}
                />
              </div>

              {/* Rol de autorización */}
              {requiresAuthorization && (
                <div>
                  <Label htmlFor="authorization_role">Rol Mínimo para Autorizar</Label>
                  <Select
                    value={watch('authorization_role') || 'supervisor'}
                    onValueChange={(value) => setValue('authorization_role', value as AuthorizationRole)}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">{roleLabels.owner}</SelectItem>
                      <SelectItem value="admin">{roleLabels.admin}</SelectItem>
                      <SelectItem value="supervisor">{roleLabels.supervisor}</SelectItem>
                      <SelectItem value="cashier">{roleLabels.cashier}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Solo usuarios con este rol o superior pueden autorizar descuentos
                  </p>
                </div>
              )}

              {/* Auto-aprobación */}
              <div className="space-y-4 border-t border-border pt-4">
                <h3 className="text-base font-semibold text-foreground">Auto-Aprobación</h3>
                <p className="text-sm text-muted-foreground">
                  Los descuentos que cumplan estas condiciones se aprobarán automáticamente sin
                  requerir autorización
                </p>

                <div>
                  <Label htmlFor="auto_approve_below_percentage">
                    Auto-Aprobar si es menor a (%)
                  </Label>
                  <Input
                    id="auto_approve_below_percentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    {...register('auto_approve_below_percentage', {
                      valueAsNumber: true,
                      setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
                    })}
                    className="mt-2"
                    placeholder="Sin auto-aprobación"
                    disabled={isLoading}
                  />
                  {errors.auto_approve_below_percentage && (
                    <p className="mt-1 text-sm text-destructive">
                      {errors.auto_approve_below_percentage.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="auto_approve_below_amount_bs">
                    Auto-Aprobar si es menor a (Bs)
                  </Label>
                  <Input
                    id="auto_approve_below_amount_bs"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('auto_approve_below_amount_bs', {
                      valueAsNumber: true,
                      setValueAs: (v) => (v === '' || v === null ? null : Number(v)),
                    })}
                    className="mt-2"
                    placeholder="Sin auto-aprobación"
                    disabled={isLoading}
                  />
                  {errors.auto_approve_below_amount_bs && (
                    <p className="mt-1 text-sm text-destructive">
                      {errors.auto_approve_below_amount_bs.message}
                    </p>
                  )}
                </div>
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

