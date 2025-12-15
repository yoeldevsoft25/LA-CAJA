import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { customersService, Customer } from '@/services/customers.service'
import toast from 'react-hot-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const customerSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  document_id: z.string().optional(),
  phone: z.string().optional(),
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
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      document_id: '',
      phone: '',
      note: '',
    },
  })

  useEffect(() => {
    if (customer) {
      reset({
        name: customer.name,
        document_id: customer.document_id || '',
        phone: customer.phone || '',
        note: customer.note || '',
      })
    } else {
      reset({
        name: '',
        document_id: '',
        phone: '',
        note: '',
      })
    }
  }, [customer, reset])

  const createMutation = useMutation({
    mutationFn: customersService.create,
    onSuccess: () => {
      toast.success('Cliente creado exitosamente')
      onSuccess?.()
      onClose()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al crear el cliente'
      toast.error(message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: CustomerFormData) => customersService.update(customer!.id, data),
    onSuccess: () => {
      toast.success('Cliente actualizado exitosamente')
      onSuccess?.()
      onClose()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al actualizar el cliente'
      toast.error(message)
    },
  })

  const onSubmit = (data: CustomerFormData) => {
    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
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
                <Label htmlFor="name" className="text-sm font-semibold">
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

              {/* Cédula */}
              <div className="space-y-2">
                <Label htmlFor="document_id" className="text-sm font-semibold">
                  Cédula de Identidad
                </Label>
                <Input
                  id="document_id"
                  type="text"
                  {...register('document_id')}
                  placeholder="V-12345678 o E-12345678"
                />
                <p className="text-xs text-muted-foreground">
                  Formato: V-12345678 para venezolanos, E-12345678 para extranjeros
                </p>
              </div>

              {/* Teléfono */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-semibold">
                  Teléfono
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  {...register('phone')}
                  placeholder="0414-1234567"
                />
              </div>

              {/* Nota */}
              <div className="space-y-2">
                <Label htmlFor="note" className="text-sm font-semibold">
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
