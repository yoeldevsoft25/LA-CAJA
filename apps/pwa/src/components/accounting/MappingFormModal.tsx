import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { accountMappingsService, chartOfAccountsService } from '@/services/accounting.service'
import type { AccountMapping, CreateMappingDto, UpdateMappingDto } from '@/types/accounting.types'
import { MappingTransactionType } from '@/types/accounting.types'
import toast from '@/lib/toast'

const mappingSchema = z.object({
  transaction_type: z.enum([
    'sale_revenue',
    'sale_cost',
    'sale_tax',
    'purchase_expense',
    'purchase_tax',
    'inventory_asset',
    'cash_asset',
    'accounts_receivable',
    'accounts_payable',
    'expense',
    'income',
    'transfer',
    'adjustment',
    'fx_gain_realized',
    'fx_loss_realized',
    'fx_gain_unrealized',
    'fx_loss_unrealized',
  ]),
  account_id: z.string().min(1, 'Cuenta requerida'),
  is_default: z.boolean(),
  conditions: z.string().optional(),
})

type MappingFormData = z.infer<typeof mappingSchema>

interface MappingFormModalProps {
  isOpen: boolean
  onClose: () => void
  mapping?: AccountMapping | null
  onSuccess?: () => void
}

const transactionTypeLabels: Record<MappingTransactionType, string> = {
  sale_revenue: 'Venta - Ingresos',
  sale_cost: 'Venta - Costos',
  sale_tax: 'Venta - Impuestos',
  purchase_expense: 'Compra - Gastos',
  purchase_tax: 'Compra - Impuestos',
  inventory_asset: 'Inventario - Activo',
  cash_asset: 'Caja/Banco - Activo',
  accounts_receivable: 'Cuentas por Cobrar',
  accounts_payable: 'Cuentas por Pagar',
  expense: 'Gasto',
  income: 'Ingreso',
  transfer: 'Transferencia',
  adjustment: 'Ajuste',
  fx_gain_realized: 'Diferencial Cambiario - Ganancia Realizada',
  fx_loss_realized: 'Diferencial Cambiario - Pérdida Realizada',
  fx_gain_unrealized: 'Diferencial Cambiario - Ganancia No Realizada',
  fx_loss_unrealized: 'Diferencial Cambiario - Pérdida No Realizada',
}

export default function MappingFormModal({
  isOpen,
  onClose,
  mapping,
  onSuccess,
}: MappingFormModalProps) {
  const isEditing = !!mapping
  const queryClient = useQueryClient()

  const { data: accounts } = useQuery({
    queryKey: ['accounting', 'accounts'],
    queryFn: () => chartOfAccountsService.getAll(),
    enabled: isOpen,
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<MappingFormData>({
    resolver: zodResolver(mappingSchema),
    defaultValues: {
      transaction_type: MappingTransactionType.SALE_REVENUE,
      account_id: '',
      is_default: false,
      conditions: '',
    },
  })

  useEffect(() => {
    if (mapping) {
      reset({
        transaction_type: mapping.transaction_type as any,
        account_id: mapping.account_id,
        is_default: mapping.is_default,
        conditions: mapping.conditions ? JSON.stringify(mapping.conditions, null, 2) : '',
      })
    } else {
      reset({
        transaction_type: 'sale_revenue',
        account_id: '',
        is_default: false,
        conditions: '',
      })
    }
  }, [mapping, reset])

  const createMutation = useMutation({
    mutationFn: (data: CreateMappingDto) => accountMappingsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'mappings'] })
      toast.success('Mapeo creado exitosamente')
      onSuccess?.()
      onClose()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al crear el mapeo'
      toast.error(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMappingDto }) =>
      accountMappingsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'mappings'] })
      toast.success('Mapeo actualizado exitosamente')
      onSuccess?.()
      onClose()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al actualizar el mapeo'
      toast.error(message)
    },
  })

  const onSubmit = (data: MappingFormData) => {
    let conditions = null
    if (data.conditions && data.conditions.trim()) {
      try {
        conditions = JSON.parse(data.conditions)
      } catch {
        toast.error('Las condiciones deben ser un JSON válido')
        return
      }
    }

    if (isEditing) {
      const selectedAccount = accounts?.find((acc) => acc.id === data.account_id)
      if (!selectedAccount) {
        toast.error('Cuenta no encontrada')
        return
      }
      updateMutation.mutate({
        id: mapping!.id,
        data: {
          account_id: selectedAccount.id,
          account_code: selectedAccount.account_code,
          is_default: data.is_default,
          conditions,
        },
      })
    } else {
      const selectedAccount = accounts?.find((acc) => acc.id === data.account_id)
      if (!selectedAccount) {
        toast.error('Cuenta no encontrada')
        return
      }
      createMutation.mutate({
        transaction_type: data.transaction_type as MappingTransactionType,
        account_id: selectedAccount.id,
        account_code: selectedAccount.account_code,
        is_default: data.is_default,
        conditions,
      })
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl">
            {isEditing ? 'Editar Mapeo' : 'Nuevo Mapeo'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing ? 'Modifica el mapeo de cuentas' : 'Crea un nuevo mapeo de cuentas'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
            <div className="space-y-4 sm:space-y-5">
              {/* Tipo de transacción (solo en creación) */}
              {!isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="transaction_type">Tipo de Transacción *</Label>
                  <Select
                    value={watch('transaction_type')}
                    onValueChange={(value) => setValue('transaction_type', value as any)}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="transaction_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(transactionTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.transaction_type && (
                    <p className="text-sm text-destructive">{errors.transaction_type.message}</p>
                  )}
                </div>
              )}

              {/* Cuenta */}
              <div className="space-y-2">
                <Label htmlFor="account_id">Cuenta *</Label>
                <Select
                  value={watch('account_id') || undefined}
                  onValueChange={(value) => setValue('account_id', value)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="account_id">
                    <SelectValue placeholder="Seleccionar cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.account_code} - {account.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.account_id && (
                  <p className="text-sm text-destructive">{errors.account_id.message}</p>
                )}
              </div>

              {/* Por defecto */}
              <div className="flex items-center justify-between">
                <Label htmlFor="is_default">Mapeo por Defecto</Label>
                <Switch
                  id="is_default"
                  checked={watch('is_default')}
                  onCheckedChange={(checked) => setValue('is_default', checked)}
                  disabled={isLoading}
                />
              </div>

              {/* Condiciones (JSON) */}
              <div className="space-y-2">
                <Label htmlFor="conditions">Condiciones (JSON opcional)</Label>
                <Textarea
                  id="conditions"
                  {...register('conditions')}
                  placeholder='{"payment_method": "CASH_BS", "category": "electronics"}'
                  disabled={isLoading}
                  rows={4}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Define condiciones específicas para este mapeo en formato JSON
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex justify-end gap-2 flex-shrink-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
