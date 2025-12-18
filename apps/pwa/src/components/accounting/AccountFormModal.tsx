import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { chartOfAccountsService } from '@/services/accounting.service'
import type { ChartOfAccount, CreateAccountDto, UpdateAccountDto, AccountType } from '@/types/accounting.types'
import toast from 'react-hot-toast'

const accountSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  name: z.string().min(1, 'El nombre es requerido'),
  account_type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  parent_id: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
})

type AccountFormData = z.infer<typeof accountSchema>

interface AccountFormModalProps {
  isOpen: boolean
  onClose: () => void
  account?: ChartOfAccount | null
  onSuccess?: () => void
}

const accountTypeLabels: Record<AccountType, string> = {
  asset: 'Activo',
  liability: 'Pasivo',
  equity: 'Patrimonio',
  revenue: 'Ingreso',
  expense: 'Gasto',
}

export default function AccountFormModal({
  isOpen,
  onClose,
  account,
  onSuccess,
}: AccountFormModalProps) {
  const isEditing = !!account
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
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      code: '',
      name: '',
      account_type: 'asset',
      parent_id: null,
      description: null,
    },
  })

  const selectedAccountType = watch('account_type')

  useEffect(() => {
    if (account) {
      reset({
        code: account.code,
        name: account.name,
        account_type: account.account_type,
        parent_id: account.parent_id,
        description: account.description || null,
      })
    } else {
      reset({
        code: '',
        name: '',
        account_type: 'asset',
        parent_id: null,
        description: null,
      })
    }
  }, [account, reset])

  const createMutation = useMutation({
    mutationFn: (data: CreateAccountDto) => chartOfAccountsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'accounts'] })
      toast.success('Cuenta creada exitosamente')
      onSuccess?.()
      onClose()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al crear la cuenta'
      toast.error(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAccountDto }) =>
      chartOfAccountsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'accounts'] })
      toast.success('Cuenta actualizada exitosamente')
      onSuccess?.()
      onClose()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al actualizar la cuenta'
      toast.error(message)
    },
  })

  const onSubmit = (data: AccountFormData) => {
    if (isEditing) {
      updateMutation.mutate({
        id: account!.id,
        data: {
          name: data.name,
          description: data.description || null,
        },
      })
    } else {
      createMutation.mutate({
        code: data.code,
        name: data.name,
        account_type: data.account_type as AccountType,
        parent_id: data.parent_id || null,
        description: data.description || null,
      })
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  // Filtrar cuentas que pueden ser padre (mismo tipo y nivel menor)
  const availableParents = accounts?.filter(
    (acc) =>
      acc.account_type === selectedAccountType &&
      acc.id !== account?.id &&
      (!account || acc.level < account.level)
  ) || []

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl">
            {isEditing ? 'Editar Cuenta' : 'Nueva Cuenta'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing ? 'Modifica la información de la cuenta' : 'Ingresa la información de la nueva cuenta'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
            <div className="space-y-4 sm:space-y-5">
              {/* Código (solo en creación) */}
              {!isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="code">Código *</Label>
                  <Input
                    id="code"
                    {...register('code')}
                    placeholder="Ej: 1.01.01"
                    disabled={isLoading}
                  />
                  {errors.code && (
                    <p className="text-sm text-destructive">{errors.code.message}</p>
                  )}
                </div>
              )}

              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="Nombre de la cuenta"
                  disabled={isLoading}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              {/* Tipo de cuenta (solo en creación) */}
              {!isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="account_type">Tipo de Cuenta *</Label>
                  <Select
                    value={selectedAccountType}
                    onValueChange={(value) => {
                      const accountType = value as AccountType
                      setValue('account_type', accountType)
                    }}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="account_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(accountTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.account_type && (
                    <p className="text-sm text-destructive">{errors.account_type.message}</p>
                  )}
                </div>
              )}

              {/* Cuenta padre (solo en creación) */}
              {!isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="parent_id">Cuenta Padre (opcional)</Label>
                  <Select
                    value={watch('parent_id') || '__none__'}
                    onValueChange={(value) => setValue('parent_id', value === '__none__' ? null : value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="parent_id">
                      <SelectValue placeholder="Selecciona una cuenta padre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Ninguna</SelectItem>
                      {availableParents.map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          {parent.code} - {parent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción (opcional)</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="Descripción de la cuenta"
                  disabled={isLoading}
                  rows={3}
                />
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
