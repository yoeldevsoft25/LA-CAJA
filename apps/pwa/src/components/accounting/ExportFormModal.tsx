import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { accountingExportsService } from '@/services/accounting.service'
import type { CreateExportDto } from '@/types/accounting.types'
import { ExportFormat, AccountingStandard } from '@/types/accounting.types'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const exportSchema = z.object({
  format: z.enum(['csv', 'excel', 'json', 'viotech']),
  standard: z.enum(['ifrs', 'niif', 'local']).nullable().optional(),
  start_date: z.date(),
  end_date: z.date(),
}).refine(
  (data) => data.end_date >= data.start_date,
  { message: 'La fecha final debe ser mayor o igual a la fecha inicial', path: ['end_date'] }
)

type ExportFormData = z.infer<typeof exportSchema>

interface ExportFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const formatLabels: Record<ExportFormat, string> = {
  csv: 'CSV',
  excel: 'Excel (XLSX)',
  json: 'JSON',
  viotech: 'VioTech',
}

const standardLabels: Record<AccountingStandard, string> = {
  ifrs: 'IFRS',
  niif: 'NIIF',
  local: 'Local',
}

export default function ExportFormModal({
  isOpen,
  onClose,
  onSuccess,
}: ExportFormModalProps) {
  const queryClient = useQueryClient()

  const {
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ExportFormData>({
    resolver: zodResolver(exportSchema),
    defaultValues: {
      format: ExportFormat.EXCEL,
      standard: null,
      start_date: new Date(),
      end_date: new Date(),
    },
  })

  const startDate = watch('start_date')
  const endDate = watch('end_date')
  const selectedFormat = watch('format')

  const createMutation = useMutation({
    mutationFn: (data: CreateExportDto) => accountingExportsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'exports'] })
      toast.success('Exportación iniciada. Estará disponible cuando se complete el procesamiento.')
      onSuccess?.()
      onClose()
      reset()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al crear la exportación'
      toast.error(message)
    },
  })

  const onSubmit = (data: ExportFormData) => {
    const createData: CreateExportDto = {
      format: data.format as ExportFormat,
      standard: (data.standard || null) as AccountingStandard | null,
      start_date: format(data.start_date, 'yyyy-MM-dd'),
      end_date: format(data.end_date, 'yyyy-MM-dd'),
    }

    createMutation.mutate(createData)
  }

  const isLoading = createMutation.isPending

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl">Nueva Exportación</DialogTitle>
          <DialogDescription className="sr-only">
            Crea una nueva exportación contable
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
            <div className="space-y-4 sm:space-y-5">
              {/* Formato */}
              <div className="space-y-2">
                <Label htmlFor="format">Formato *</Label>
                <Select
                  value={selectedFormat}
                  onValueChange={(value) => setValue('format', value as any)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(formatLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.format && (
                  <p className="text-sm text-destructive">{errors.format.message}</p>
                )}
              </div>

              {/* Estándar (opcional) */}
              <div className="space-y-2">
                <Label htmlFor="standard">Estándar Contable (opcional)</Label>
                <Select
                  value={watch('standard') || '__none__'}
                  onValueChange={(value) => setValue('standard', value === '__none__' ? null : (value as any))}
                  disabled={isLoading}
                >
                  <SelectTrigger id="standard">
                    <SelectValue placeholder="Seleccionar estándar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ninguno</SelectItem>
                    {Object.entries(standardLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha inicio */}
              <div className="space-y-2">
                <Label>Fecha Inicio *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('w-full justify-start text-left font-normal', !startDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'dd/MM/yyyy') : 'Seleccionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={(date) => date && setValue('start_date', date)} />
                  </PopoverContent>
                </Popover>
                {errors.start_date && (
                  <p className="text-sm text-destructive">{errors.start_date.message}</p>
                )}
              </div>

              {/* Fecha fin */}
              <div className="space-y-2">
                <Label>Fecha Fin *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('w-full justify-start text-left font-normal', !endDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'dd/MM/yyyy') : 'Seleccionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={(date) => date && setValue('end_date', date)} />
                  </PopoverContent>
                </Popover>
                {errors.end_date && (
                  <p className="text-sm text-destructive">{errors.end_date.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex justify-end gap-2 flex-shrink-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creando...' : 'Crear Exportación'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
