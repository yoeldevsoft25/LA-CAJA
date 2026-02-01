import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Square, Save } from 'lucide-react'
import {
  Table,
  CreateTableRequest,
  UpdateTableRequest,
  TableStatus,
} from '@/services/tables.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
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
import TableQRCodeModal from './TableQRCodeModal'

const tableSchema = z.object({
  table_number: z.string().min(1, 'El número de mesa es requerido').max(20, 'Máximo 20 caracteres'),
  name: z.string().max(100).nullable().optional(),
  capacity: z.number().min(1).nullable().optional(),
  status: z.enum(['available', 'occupied', 'reserved', 'cleaning', 'out_of_service']).optional(),
  note: z.string().max(1000).nullable().optional(),
})

type TableFormData = z.infer<typeof tableSchema>

const statusLabels: Record<TableStatus, string> = {
  available: 'Disponible',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  cleaning: 'Limpieza',
  out_of_service: 'Fuera de Servicio',
}

interface TableModalProps {
  isOpen: boolean
  onClose: () => void
  table: Table | null
  onConfirm: (data: CreateTableRequest | UpdateTableRequest) => void
  isLoading: boolean
}

export default function TableModal({
  isOpen,
  onClose,
  table,
  onConfirm,
  isLoading,
}: TableModalProps) {
  const [showQRModal, setShowQRModal] = useState(false)
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<TableFormData>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      table_number: '',
      name: null,
      capacity: null,
      status: 'available',
      note: null,
    },
  })

  const status = watch('status')

  useEffect(() => {
    if (table) {
      reset({
        table_number: table.table_number,
        name: table.name || null,
        capacity: table.capacity || null,
        status: table.status,
        note: table.note || null,
      })
    } else {
      reset({
        table_number: '',
        name: null,
        capacity: null,
        status: 'available',
        note: null,
      })
    }
  }, [table, reset])

  const onSubmit = (data: TableFormData) => {
    const requestData: CreateTableRequest | UpdateTableRequest = {
      table_number: data.table_number,
      name: data.name || null,
      capacity: data.capacity || null,
      status: data.status,
      note: data.note || null,
    }
    onConfirm(requestData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            <Square className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            {table ? 'Editar Mesa' : 'Crear Mesa'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {table ? 'Edita los datos de la mesa' : 'Crea una nueva mesa'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
            <div className="space-y-4">
              <Alert className="bg-info/5 border-info/50">
                <AlertDescription className="text-sm text-foreground">
                  Las mesas permiten gestionar órdenes y cuentas abiertas en restaurantes, talleres
                  y otros establecimientos.
                </AlertDescription>
              </Alert>

              {/* Número de mesa */}
              <div>
                <Label htmlFor="table_number">
                  Número de Mesa <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="table_number"
                  {...register('table_number')}
                  className="mt-2"
                  placeholder="Ej: 1, A, Barra 1"
                  maxLength={20}
                  disabled={isLoading}
                />
                {errors.table_number && (
                  <p className="mt-1 text-sm text-destructive">{errors.table_number.message}</p>
                )}
              </div>

              {/* Nombre */}
              <div>
                <Label htmlFor="name">Nombre (Opcional)</Label>
                <Input
                  id="name"
                  {...register('name')}
                  className="mt-2"
                  placeholder="Ej: Mesa VIP, Barra Principal"
                  maxLength={100}
                  disabled={isLoading}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              {/* Capacidad */}
              <div>
                <Label htmlFor="capacity">Capacidad (Opcional)</Label>
                <Input
                  id="capacity"
                  type="number"
                  step="1"
                  min="1"
                  {...register('capacity', { valueAsNumber: true })}
                  className="mt-2"
                  placeholder="Ej: 4"
                  disabled={isLoading}
                />
                {errors.capacity && (
                  <p className="mt-1 text-sm text-destructive">{errors.capacity.message}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Número de personas que puede acomodar la mesa
                </p>
              </div>

              {/* Estado */}
              <div>
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={status || 'available'}
                  onValueChange={(value) => setValue('status', value as TableStatus)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">{statusLabels.available}</SelectItem>
                    <SelectItem value="occupied">{statusLabels.occupied}</SelectItem>
                    <SelectItem value="reserved">{statusLabels.reserved}</SelectItem>
                    <SelectItem value="cleaning">{statusLabels.cleaning}</SelectItem>
                    <SelectItem value="out_of_service">{statusLabels.out_of_service}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Nota */}
              <div>
                <Label htmlFor="note">Nota (Opcional)</Label>
                <Textarea
                  id="note"
                  {...register('note')}
                  rows={3}
                  className="mt-2 resize-none"
                  placeholder="Notas adicionales sobre la mesa..."
                  maxLength={1000}
                  disabled={isLoading}
                />
                {errors.note && (
                  <p className="mt-1 text-sm text-destructive">{errors.note.message}</p>
                )}
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
                    <Save className="w-5 h-5 mr-2" />
                    {table ? 'Actualizar' : 'Crear'} Mesa
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>

        {/* Modal de código QR */}
        {table && (
          <TableQRCodeModal
            isOpen={showQRModal}
            onClose={() => setShowQRModal(false)}
            table={table}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

