import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { customersService, Customer, CreateCustomerDto, UpdateCustomerDto } from '@/services/customers.service'
import { useAuth } from '@/stores/auth.store'
import toast from '@/lib/toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@la-caja/ui-core'
import { Input } from '@la-caja/ui-core'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RIFInput } from '@/components/ui/rif-input'
import { CreditCard, DollarSign, Mail, Phone, User, FileText, StickyNote } from 'lucide-react'

const customerSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  document_id: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  credit_limit: z.number().min(0, 'El límite de crédito no puede ser negativo').nullable(),
  note: z.string().optional(),
})

type CustomerFormData = z.infer<typeof customerSchema>

interface CustomerFormModalProps {
  isOpen: boolean
  onClose: () => void
  customer?: Customer | null
  onSuccess?: () => void
}

export default function CustomerFormModal({
  isOpen,
  onClose,
  customer,
  onSuccess,
}: CustomerFormModalProps) {
  const isEditing = !!customer

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      document_id: '',
      phone: '',
      email: '',
      credit_limit: null,
      note: '',
    },
  })

  // Limpiar formulario cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      reset({
        name: '',
        document_id: '',
        phone: '',
        email: '',
        credit_limit: null,
        note: '',
      })
      return
    }
  }, [isOpen, reset])

  // Cargar datos del cliente si está en modo edición
  useEffect(() => {
    if (!isOpen) return

    if (customer) {
      reset({
        name: customer.name,
        document_id: customer.document_id || '',
        phone: customer.phone || '',
        email: customer.email || '',
        credit_limit: customer.credit_limit,
        note: customer.note || '',
      })
    } else {
      reset({
        name: '',
        document_id: '',
        phone: '',
        email: '',
        credit_limit: null,
        note: '',
      })
    }
  }, [isOpen, customer, reset])

  const { user } = useAuth()
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: customersService.create,
    onMutate: async (newCustomer) => {
      await queryClient.cancelQueries({ queryKey: ['customers'] })
      const previousCustomers = queryClient.getQueryData(['customers', '']) // Asumiendo búsqueda vacía

      queryClient.setQueriesData({ queryKey: ['customers'] }, (old: any) => {
        if (!old) return old
        // Optimistic add (con ID temporal)
        const tempCustomer = {
          ...newCustomer,
          id: `temp-${Date.now()}`,
          store_id: user?.store_id || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          document_id: newCustomer.document_id || null,
          phone: newCustomer.phone || null,
          email: newCustomer.email || null,
          credit_limit: newCustomer.credit_limit || null,
          note: newCustomer.note || null,
        }
        return Array.isArray(old) ? [tempCustomer, ...old] : [tempCustomer]
      })

      return { previousCustomers }
    },
    onSuccess: () => {
      toast.success('Cliente creado exitosamente')
      onSuccess?.()
      onClose()
    },
    onError: async (error: any, variables, context) => {
      // ✅ OFFLINE-FIRST
      if (error.isOffline || error.code === 'ERR_INTERNET_DISCONNECTED' || !navigator.onLine) {
        try {
          const { syncService } = await import('@/services/sync.service')

          await syncService.enqueueEvent({
            event_id: crypto.randomUUID(),
            type: 'customers.created',
            payload: { ...variables, store_id: user?.store_id },
            created_at: Date.now(),
            seq: 0,
            store_id: user?.store_id || '',
            device_id: localStorage.getItem('device_id') || 'unknown',
            version: 1,
            actor: {
              user_id: user?.user_id || 'unknown',
              role: (user?.role as any) || 'cashier',
            },
          })

          toast.success('Guardado localmente (sin conexión)')
          onSuccess?.()
          onClose()
          return
        } catch (queueError) {
          console.error('Error al encolar offline:', queueError)
        }
      }

      if (context?.previousCustomers) {
        queryClient.setQueriesData({ queryKey: ['customers'] }, context.previousCustomers)
      }
      toast.error(error.response?.data?.message || 'Error al crear el cliente')
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ['customers'] })
      }
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCustomerDto) => customersService.update(customer!.id, data),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['customers'] })
      const previousCustomers = queryClient.getQueryData(['customers', '']) // Asumiendo búsqueda vacía

      queryClient.setQueriesData({ queryKey: ['customers'] }, (old: any) => {
        if (!Array.isArray(old)) return old
        return old.map((c: Customer) =>
          c.id === customer!.id ? { ...c, ...variables } : c
        )
      })

      return { previousCustomers }
    },
    onSuccess: () => {
      toast.success('Cliente actualizado exitosamente')
      onSuccess?.()
      onClose()
    },
    onError: async (error: any, variables, context) => {
      // ✅ OFFLINE-FIRST
      if (error.isOffline || error.code === 'ERR_INTERNET_DISCONNECTED' || !navigator.onLine) {
        try {
          const { syncService } = await import('@/services/sync.service')

          await syncService.enqueueEvent({
            event_id: crypto.randomUUID(),
            type: 'customers.updated',
            payload: { id: customer!.id, ...variables },
            created_at: Date.now(),
            seq: 0,
            store_id: user?.store_id || '',
            device_id: localStorage.getItem('device_id') || 'unknown',
            version: 1,
            actor: {
              user_id: user?.user_id || 'unknown',
              role: (user?.role as any) || 'cashier',
            },
          })

          toast.success('Guardado localmente (sin conexión)')
          onSuccess?.()
          onClose()
          return
        } catch (queueError) {
          console.error('Error al encolar offline:', queueError)
        }
      }

      if (context?.previousCustomers) {
        queryClient.setQueriesData({ queryKey: ['customers'] }, context.previousCustomers)
      }
      const message = error.response?.data?.message || 'Error al actualizar el cliente'
      toast.error(message)
    },
    onSettled: () => {
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ['customers'] })
      }
    }
  })

  const onSubmit = (data: CustomerFormData) => {
    // Limpiar datos vacíos
    const cleanData: CreateCustomerDto | UpdateCustomerDto = {
      ...data,
      email: data.email || undefined,
      credit_limit: data.credit_limit ?? undefined,
    }

    if (isEditing) {
      updateMutation.mutate(cleanData as UpdateCustomerDto)
    } else {
      createMutation.mutate(cleanData as CreateCustomerDto)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl">
            {isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing ? 'Modifica la información del cliente' : 'Ingresa la información del nuevo cliente'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
            <div className="space-y-4 sm:space-y-5">
              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  {...register('name')}
                  placeholder="Nombre completo del cliente"
                  autoFocus
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              {/* Cédula / RIF */}
              <div className="space-y-2">
                <Label htmlFor="document_id" className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Cédula / RIF
                </Label>
                <RIFInput
                  id="document_id"
                  value={watch('document_id') || ''}
                  onChange={(value) => {
                    setValue('document_id', value)
                  }}
                  placeholder="V-12345678 o J-12345678-9"
                  showValidation={true}
                  autoFormat={true}
                />
                <p className="text-xs text-muted-foreground">
                  Se valida automáticamente el formato de RIF venezolano
                </p>
              </div>

              {/* Teléfono y Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Teléfono */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-semibold flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Teléfono
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    {...register('phone')}
                    placeholder="0414-1234567"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder="cliente@email.com"
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>
              </div>

              {/* Límite de Crédito */}
              <div className="space-y-2">
                <Label htmlFor="credit_limit" className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  Límite de Crédito (FIAO)
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="credit_limit"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('credit_limit', {
                      setValueAs: (value) => {
                        if (value === '' || value === null || value === undefined) return null
                        const num = Number(value)
                        return isNaN(num) ? null : num
                      },
                    })}
                    placeholder="0.00"
                    className="pl-9"
                  />
                </div>
                {errors.credit_limit && (
                  <p className="text-sm text-destructive">{errors.credit_limit.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Monto máximo que el cliente puede adeudar. Dejar vacío para no permitir crédito.
                </p>
              </div>

              {/* Nota */}
              <div className="space-y-2">
                <Label htmlFor="note" className="text-sm font-semibold flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  Nota
                </Label>
                <Textarea
                  id="note"
                  {...register('note')}
                  rows={3}
                  className="resize-none"
                  placeholder="Información adicional sobre el cliente..."
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
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
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading
                  ? 'Guardando...'
                  : isEditing
                    ? 'Actualizar Cliente'
                    : 'Crear Cliente'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
