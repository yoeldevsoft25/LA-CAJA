import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileText, Save } from 'lucide-react'
import {
  InvoiceSeries,
  CreateInvoiceSeriesRequest,
  UpdateInvoiceSeriesRequest,
} from '@/services/invoice-series.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@la-caja/ui-core'
import { Input } from '@la-caja/ui-core'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'

const seriesSchema = z.object({
  series_code: z
    .string()
    .min(1, 'El código de serie es requerido')
    .max(10, 'Máximo 10 caracteres')
    .regex(/^[A-Z0-9]+$/, 'Solo letras mayúsculas y números'),
  name: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  prefix: z.string().max(20).nullable().optional(),
  start_number: z.number().min(1, 'El número inicial debe ser mayor a 0').optional(),
  is_active: z.boolean().optional(),
  note: z.string().max(1000).nullable().optional(),
})

type SeriesFormData = z.infer<typeof seriesSchema>

interface InvoiceSeriesModalProps {
  isOpen: boolean
  onClose: () => void
  series: InvoiceSeries | null
  onConfirm: (data: CreateInvoiceSeriesRequest | UpdateInvoiceSeriesRequest) => void
  isLoading: boolean
}

export default function InvoiceSeriesModal({
  isOpen,
  onClose,
  series,
  onConfirm,
  isLoading,
}: InvoiceSeriesModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<SeriesFormData>({
    resolver: zodResolver(seriesSchema),
    defaultValues: {
      series_code: '',
      name: '',
      prefix: null,
      start_number: 1,
      is_active: true,
      note: null,
    },
  })

  const isActive = watch('is_active')

  useEffect(() => {
    if (series) {
      reset({
        series_code: series.series_code,
        name: series.name,
        prefix: series.prefix || null,
        start_number: series.start_number,
        is_active: series.is_active,
        note: series.note || null,
      })
    } else {
      reset({
        series_code: '',
        name: '',
        prefix: null,
        start_number: 1,
        is_active: true,
        note: null,
      })
    }
  }, [series, reset])

  const onSubmit = (data: SeriesFormData) => {
    const requestData: CreateInvoiceSeriesRequest | UpdateInvoiceSeriesRequest = {
      name: data.name,
      prefix: data.prefix || null,
      start_number: data.start_number,
      is_active: data.is_active ?? true,
      note: data.note || null,
    }

    if (!series) {
      // Crear nueva serie
      (requestData as CreateInvoiceSeriesRequest).series_code = data.series_code
    }

    onConfirm(requestData)
  }

  const formatExample = () => {
    const code = watch('series_code') || 'A'
    const prefix = watch('prefix') || ''
    const start = watch('start_number') || 1
    const numberStr = String(start).padStart(6, '0')

    if (prefix) {
      return `${prefix}-${code}-${numberStr}`
    }
    return `${code}-${numberStr}`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            {series ? 'Editar Serie de Factura' : 'Crear Serie de Factura'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {series ? 'Edita los datos de la serie' : 'Crea una nueva serie de factura'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
            <div className="space-y-4">
              <Alert className="bg-info/5 border-info/50">
                <AlertDescription className="text-sm text-foreground">
                  Las series permiten gestionar múltiples consecutivos de factura (A, B, C, etc.)
                  con números independientes.
                </AlertDescription>
              </Alert>

              {/* Código de serie */}
              <div>
                <Label htmlFor="series_code">
                  Código de Serie <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="series_code"
                  {...register('series_code')}
                  className="mt-2 font-mono uppercase"
                  placeholder="A, B, C, etc."
                  maxLength={10}
                  disabled={isLoading || !!series}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase()
                    register('series_code').onChange(e)
                  }}
                />
                {errors.series_code && (
                  <p className="mt-1 text-sm text-destructive">{errors.series_code.message}</p>
                )}
                {series && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    El código de serie no se puede modificar
                  </p>
                )}
              </div>

              {/* Nombre */}
              <div>
                <Label htmlFor="name">
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  {...register('name')}
                  className="mt-2"
                  placeholder="Ej: Serie Principal, Serie Especial"
                  maxLength={100}
                  disabled={isLoading}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              {/* Prefijo */}
              <div>
                <Label htmlFor="prefix">Prefijo (Opcional)</Label>
                <Input
                  id="prefix"
                  {...register('prefix')}
                  className="mt-2"
                  placeholder="Ej: FAC, TICK"
                  maxLength={20}
                  disabled={isLoading}
                />
                {errors.prefix && (
                  <p className="mt-1 text-sm text-destructive">{errors.prefix.message}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Si se especifica, se usará en el formato: {formatExample()}
                </p>
              </div>

              {/* Número inicial */}
              <div>
                <Label htmlFor="start_number">Número Inicial</Label>
                <Input
                  id="start_number"
                  type="number"
                  step="1"
                  min="1"
                  {...register('start_number', { valueAsNumber: true })}
                  className="mt-2"
                  placeholder="1"
                  disabled={isLoading || !!series}
                />
                {errors.start_number && (
                  <p className="mt-1 text-sm text-destructive">{errors.start_number.message}</p>
                )}
                {series && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Número actual: {series.current_number} | Inicial: {series.start_number}
                  </p>
                )}
              </div>

              {/* Estado activo */}
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Serie Activa</Label>
                  <p className="text-xs text-muted-foreground">
                    Solo las series activas pueden generar números de factura
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={(checked) => setValue('is_active', checked)}
                  disabled={isLoading}
                />
              </div>

              {/* Nota */}
              <div>
                <Label htmlFor="note">Nota (Opcional)</Label>
                <Textarea
                  id="note"
                  {...register('note')}
                  rows={3}
                  className="mt-2 resize-none"
                  placeholder="Notas adicionales sobre la serie..."
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
                    {series ? 'Actualizar' : 'Crear'} Serie
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
