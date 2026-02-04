import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Package, Save, Calendar } from 'lucide-react'
import {
  ProductLot,
  CreateProductLotRequest,
} from '@/services/product-lots.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

const lotSchema = z.object({
  lot_number: z.string().min(1, 'El número de lote es requerido').max(100, 'Máximo 100 caracteres'),
  initial_quantity: z.number().min(1, 'La cantidad debe ser mayor a 0'),
  unit_cost_bs: z.number().min(0, 'El costo debe ser mayor o igual a 0'),
  unit_cost_usd: z.number().min(0, 'El costo debe ser mayor o igual a 0'),
  expiration_date: z.string().nullable().optional(),
  received_at: z.string().min(1, 'La fecha de recepción es requerida'),
  supplier: z.string().max(500).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
})

type LotFormData = z.infer<typeof lotSchema>

interface ProductLotModalProps {
  isOpen: boolean
  onClose: () => void
  productId: string
  lot: ProductLot | null
  onConfirm: (data: CreateProductLotRequest) => void
  isLoading: boolean
}

export default function ProductLotModal({
  isOpen,
  onClose,
  productId,
  lot,
  onConfirm,
  isLoading,
}: ProductLotModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LotFormData>({
    resolver: zodResolver(lotSchema),
    defaultValues: {
      lot_number: '',
      initial_quantity: 1,
      unit_cost_bs: 0,
      unit_cost_usd: 0,
      expiration_date: null,
      received_at: new Date().toISOString().slice(0, 16),
      supplier: null,
      note: null,
    },
  })

  useEffect(() => {
    if (lot) {
      reset({
        lot_number: lot.lot_number,
        initial_quantity: lot.initial_quantity,
        unit_cost_bs: Number(lot.unit_cost_bs),
        unit_cost_usd: Number(lot.unit_cost_usd),
        expiration_date: lot.expiration_date || null,
        received_at: new Date(lot.received_at).toISOString().slice(0, 16),
        supplier: lot.supplier || null,
        note: lot.note || null,
      })
    } else {
      reset({
        lot_number: '',
        initial_quantity: 1,
        unit_cost_bs: 0,
        unit_cost_usd: 0,
        expiration_date: null,
        received_at: new Date().toISOString().slice(0, 16),
        supplier: null,
        note: null,
      })
    }
  }, [lot, reset])

  const onSubmit = (data: LotFormData) => {
    const requestData: CreateProductLotRequest = {
      product_id: productId,
      lot_number: data.lot_number,
      initial_quantity: data.initial_quantity,
      unit_cost_bs: data.unit_cost_bs,
      unit_cost_usd: data.unit_cost_usd,
      expiration_date: data.expiration_date || null,
      received_at: new Date(data.received_at).toISOString(),
      supplier: data.supplier || null,
      note: data.note || null,
    }
    onConfirm(requestData)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            <Package className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            {lot ? 'Editar Lote' : 'Crear Lote'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {lot ? 'Edita los datos del lote' : 'Crea un nuevo lote para el producto'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
            <div className="space-y-4">
              <Alert className="bg-info/5 border-info/50">
                <AlertDescription className="text-sm text-foreground">
                  Los lotes permiten rastrear productos con fechas de vencimiento y aplicar lógica
                  FIFO (primero en entrar, primero en salir) automáticamente.
                </AlertDescription>
              </Alert>

              {/* Número de lote */}
              <div>
                <Label htmlFor="lot_number">
                  Número de Lote <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lot_number"
                  {...register('lot_number')}
                  className="mt-2"
                  placeholder="Ej: LOT-2024-001"
                  maxLength={100}
                  disabled={isLoading || !!lot}
                />
                {errors.lot_number && (
                  <p className="mt-1 text-sm text-destructive">{errors.lot_number.message}</p>
                )}
                {lot && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    El número de lote no se puede modificar
                  </p>
                )}
              </div>

              {/* Cantidad inicial */}
              <div>
                <Label htmlFor="initial_quantity">
                  Cantidad Inicial <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="initial_quantity"
                  type="number"
                  step="1"
                  min="1"
                  {...register('initial_quantity', { valueAsNumber: true })}
                  className="mt-2"
                  placeholder="100"
                  disabled={isLoading || !!lot}
                />
                {errors.initial_quantity && (
                  <p className="mt-1 text-sm text-destructive">{errors.initial_quantity.message}</p>
                )}
                {lot && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cantidad inicial: {lot.initial_quantity} | Restante: {lot.remaining_quantity}
                  </p>
                )}
              </div>

              {/* Costos unitarios */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="unit_cost_bs">
                    Costo Unitario Bs <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="unit_cost_bs"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('unit_cost_bs', { valueAsNumber: true })}
                    className="mt-2"
                    placeholder="0.00"
                    disabled={isLoading}
                  />
                  {errors.unit_cost_bs && (
                    <p className="mt-1 text-sm text-destructive">{errors.unit_cost_bs.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="unit_cost_usd">
                    Costo Unitario USD <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="unit_cost_usd"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('unit_cost_usd', { valueAsNumber: true })}
                    className="mt-2"
                    placeholder="0.00"
                    disabled={isLoading}
                  />
                  {errors.unit_cost_usd && (
                    <p className="mt-1 text-sm text-destructive">{errors.unit_cost_usd.message}</p>
                  )}
                </div>
              </div>

              {/* Fecha de recepción */}
              <div>
                <Label htmlFor="received_at">
                  Fecha de Recepción <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="received_at"
                  type="datetime-local"
                  {...register('received_at')}
                  className="mt-2"
                  disabled={isLoading}
                />
                {errors.received_at && (
                  <p className="mt-1 text-sm text-destructive">{errors.received_at.message}</p>
                )}
              </div>

              {/* Fecha de vencimiento */}
              <div>
                <Label htmlFor="expiration_date">Fecha de Vencimiento (Opcional)</Label>
                <div className="relative mt-2">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="expiration_date"
                    type="date"
                    {...register('expiration_date')}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
                {errors.expiration_date && (
                  <p className="mt-1 text-sm text-destructive">{errors.expiration_date.message}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Si se especifica, el sistema alertará cuando el lote esté próximo a vencer
                </p>
              </div>

              {/* Proveedor */}
              <div>
                <Label htmlFor="supplier">Proveedor (Opcional)</Label>
                <Input
                  id="supplier"
                  {...register('supplier')}
                  className="mt-2"
                  placeholder="Nombre del proveedor"
                  maxLength={500}
                  disabled={isLoading}
                />
                {errors.supplier && (
                  <p className="mt-1 text-sm text-destructive">{errors.supplier.message}</p>
                )}
              </div>

              {/* Nota */}
              <div>
                <Label htmlFor="note">Nota (Opcional)</Label>
                <Textarea
                  id="note"
                  {...register('note')}
                  rows={3}
                  className="mt-2 resize-none"
                  placeholder="Notas adicionales sobre el lote..."
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
                    {lot ? 'Actualizar' : 'Crear'} Lote
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

