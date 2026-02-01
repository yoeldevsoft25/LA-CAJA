import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { accountingEntriesService, chartOfAccountsService } from '@/services/accounting.service'
import type { AccountingEntry, CreateEntryDto } from '@/types/accounting.types'
import { EntryType } from '@/types/accounting.types'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarIcon, Plus, Trash2, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import toast from '@/lib/toast'

const entryLineSchema = z.object({
  account_code: z.string().min(1, 'Cuenta requerida'),
  account_id: z.string().optional(), // Para enviar al backend
  account_name: z.string().optional(), // Para enviar al backend
  description: z.string().nullable().optional(),
  debit_amount_bs: z.number().min(0),
  credit_amount_bs: z.number().min(0),
  debit_amount_usd: z.number().min(0),
  credit_amount_usd: z.number().min(0),
}).refine(
  (data) => {
    // No puede tener débito y crédito simultáneos en BS
    const hasDebitBs = data.debit_amount_bs > 0
    const hasCreditBs = data.credit_amount_bs > 0
    if (hasDebitBs && hasCreditBs) return false
    
    // No puede tener débito y crédito simultáneos en USD
    const hasDebitUsd = data.debit_amount_usd > 0
    const hasCreditUsd = data.credit_amount_usd > 0
    if (hasDebitUsd && hasCreditUsd) return false
    
    // Debe tener al menos un monto mayor a 0
    return hasDebitBs || hasCreditBs || hasDebitUsd || hasCreditUsd
  },
  { message: 'Cada línea debe tener débito o crédito (pero no ambos), y al menos un monto > 0' }
)

const entrySchema = z.object({
  entry_date: z.date(),
  entry_type: z.enum(['sale', 'purchase', 'fiscal_invoice', 'manual', 'adjustment', 'closing']),
  description: z.string().min(1, 'Descripción requerida'),
  lines: z.array(entryLineSchema).min(2, 'Debe tener al menos 2 líneas'),
}).refine(
  (data) => {
    const totalDebitBs = data.lines.reduce((sum, line) => sum + (line.debit_amount_bs || 0), 0)
    const totalCreditBs = data.lines.reduce((sum, line) => sum + (line.credit_amount_bs || 0), 0)
    return Math.abs(totalDebitBs - totalCreditBs) < 0.01 // Permitir pequeñas diferencias por redondeo
  },
  { message: 'El total de débitos debe ser igual al total de créditos en BS', path: ['lines'] }
).refine(
  (data) => {
    const totalDebitUsd = data.lines.reduce((sum, line) => sum + (line.debit_amount_usd || 0), 0)
    const totalCreditUsd = data.lines.reduce((sum, line) => sum + (line.credit_amount_usd || 0), 0)
    return Math.abs(totalDebitUsd - totalCreditUsd) < 0.01
  },
  { message: 'El total de débitos debe ser igual al total de créditos en USD', path: ['lines'] }
)

type EntryFormData = z.infer<typeof entrySchema>

interface EntryFormModalProps {
  isOpen: boolean
  onClose: () => void
  entry?: AccountingEntry | null
  onSuccess?: () => void
}

const entryTypeLabels: Record<EntryType, string> = {
  sale: 'Venta',
  purchase: 'Compra',
  fiscal_invoice: 'Factura Fiscal',
  manual: 'Manual',
  adjustment: 'Ajuste',
  closing: 'Cierre',
}

export default function EntryFormModal({
  isOpen,
  onClose,
  entry,
  onSuccess,
}: EntryFormModalProps) {
  const isEditing = !!entry
  const queryClient = useQueryClient()
  const [balanceError, setBalanceError] = useState<string | null>(null)

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
    control,
    setValue,
    watch,
  } = useForm<EntryFormData>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      entry_date: new Date(),
      entry_type: EntryType.MANUAL,
      description: '',
      lines: [
        { account_code: '', description: null, debit_amount_bs: 0, credit_amount_bs: 0, debit_amount_usd: 0, credit_amount_usd: 0 },
        { account_code: '', description: null, debit_amount_bs: 0, credit_amount_bs: 0, debit_amount_usd: 0, credit_amount_usd: 0 },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  })

  const watchedLines = watch('lines')
  const entryDate = watch('entry_date')

  // Limpiar formulario y estado cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      reset({
        entry_date: new Date(),
        entry_type: 'manual',
        description: '',
        lines: [
          { account_code: '', description: null, debit_amount_bs: 0, credit_amount_bs: 0, debit_amount_usd: 0, credit_amount_usd: 0 },
          { account_code: '', description: null, debit_amount_bs: 0, credit_amount_bs: 0, debit_amount_usd: 0, credit_amount_usd: 0 },
        ],
      })
      setBalanceError(null)
      return
    }
  }, [isOpen, reset])

  // Cargar datos del asiento si está en modo edición
  useEffect(() => {
    if (!isOpen) return

    if (entry) {
      reset({
        entry_date: new Date(entry.entry_date),
        entry_type: entry.entry_type as any,
        description: entry.description,
        lines: entry.lines.map((line) => ({
          account_code: line.account_code,
          description: line.description || null,
          debit_amount_bs: Number(line.debit_amount_bs) || 0,
          credit_amount_bs: Number(line.credit_amount_bs) || 0,
          debit_amount_usd: Number(line.debit_amount_usd) || 0,
          credit_amount_usd: Number(line.credit_amount_usd) || 0,
        })),
      })
      setBalanceError(null)
    } else {
      reset({
        entry_date: new Date(),
        entry_type: 'manual',
        description: '',
        lines: [
          { account_code: '', description: null, debit_amount_bs: 0, credit_amount_bs: 0, debit_amount_usd: 0, credit_amount_usd: 0 },
          { account_code: '', description: null, debit_amount_bs: 0, credit_amount_bs: 0, debit_amount_usd: 0, credit_amount_usd: 0 },
        ],
      })
      setBalanceError(null)
    }
  }, [isOpen, entry, reset])

  // Calcular balance en tiempo real
  useEffect(() => {
    const totalDebitBs = watchedLines.reduce((sum, line) => sum + (line.debit_amount_bs || 0), 0)
    const totalCreditBs = watchedLines.reduce((sum, line) => sum + (line.credit_amount_bs || 0), 0)
    const totalDebitUsd = watchedLines.reduce((sum, line) => sum + (line.debit_amount_usd || 0), 0)
    const totalCreditUsd = watchedLines.reduce((sum, line) => sum + (line.credit_amount_usd || 0), 0)

    const diffBs = Math.abs(totalDebitBs - totalCreditBs)
    const diffUsd = Math.abs(totalDebitUsd - totalCreditUsd)

    if (diffBs > 0.01 || diffUsd > 0.01) {
      setBalanceError(`Desequilibrio: BS ${diffBs.toFixed(2)}, USD ${diffUsd.toFixed(2)}`)
    } else {
      setBalanceError(null)
    }
  }, [watchedLines])

  const createMutation = useMutation({
    mutationFn: (data: CreateEntryDto) => accountingEntriesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'entries'] })
      toast.success('Asiento creado exitosamente')
      onSuccess?.()
      onClose()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al crear el asiento'
      toast.error(message)
    },
  })

  const onSubmit = (data: EntryFormData) => {
    const totalDebitBs = data.lines.reduce((sum, line) => sum + (line.debit_amount_bs || 0), 0)
    const totalCreditBs = data.lines.reduce((sum, line) => sum + (line.credit_amount_bs || 0), 0)
    const totalDebitUsd = data.lines.reduce((sum, line) => sum + (line.debit_amount_usd || 0), 0)
    const totalCreditUsd = data.lines.reduce((sum, line) => sum + (line.credit_amount_usd || 0), 0)

    if (Math.abs(totalDebitBs - totalCreditBs) > 0.01 || Math.abs(totalDebitUsd - totalCreditUsd) > 0.01) {
      toast.error('El asiento debe estar balanceado')
      return
    }

    const createData: CreateEntryDto = {
      entry_date: format(data.entry_date, 'yyyy-MM-dd'),
      entry_type: data.entry_type as EntryType,
      description: data.description,
      lines: data.lines.map((line) => {
        const account = accounts?.find(acc => acc.account_code === line.account_code)
        if (!account) {
          throw new Error(`Cuenta ${line.account_code} no encontrada`)
        }
        return {
          account_id: account.id,
          account_code: line.account_code,
          account_name: account.account_name,
          description: line.description || null,
          debit_amount_bs: line.debit_amount_bs || 0,
          credit_amount_bs: line.credit_amount_bs || 0,
          debit_amount_usd: line.debit_amount_usd || 0,
          credit_amount_usd: line.credit_amount_usd || 0,
        }
      }),
    }

    createMutation.mutate(createData)
  }

  const isLoading = createMutation.isPending

  // Calcular totales
  const totalDebitBs = watchedLines.reduce((sum, line) => sum + (line.debit_amount_bs || 0), 0)
  const totalCreditBs = watchedLines.reduce((sum, line) => sum + (line.credit_amount_bs || 0), 0)
  const totalDebitUsd = watchedLines.reduce((sum, line) => sum + (line.debit_amount_usd || 0), 0)
  const totalCreditUsd = watchedLines.reduce((sum, line) => sum + (line.credit_amount_usd || 0), 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl">
            {isEditing ? 'Editar Asiento' : 'Nuevo Asiento Contable'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing ? 'Modifica el asiento contable' : 'Crea un nuevo asiento contable'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
            <div className="space-y-4">
              {/* Campos generales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Fecha *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn('w-full justify-start text-left font-normal', !entryDate && 'text-muted-foreground')}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {entryDate ? format(entryDate, 'dd/MM/yyyy') : 'Seleccionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={entryDate} onSelect={(date) => date && setValue('entry_date', date)} />
                    </PopoverContent>
                  </Popover>
                  {errors.entry_date && (
                    <p className="text-sm text-destructive">{errors.entry_date.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select
                    value={watch('entry_type')}
                    onValueChange={(value) => setValue('entry_type', value as any)}
                    disabled={isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(entryTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Descripción *</Label>
                  <Input
                    {...register('description')}
                    placeholder="Descripción del asiento"
                    disabled={isLoading}
                  />
                  {errors.description && (
                    <p className="text-sm text-destructive">{errors.description.message}</p>
                  )}
                </div>
              </div>

              {/* Alerta de balance */}
              {balanceError && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{balanceError}</span>
                </div>
              )}

              {/* Líneas del asiento */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Líneas del Asiento *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ account_code: '', description: null, debit_amount_bs: 0, credit_amount_bs: 0, debit_amount_usd: 0, credit_amount_usd: 0 })}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar Línea
                  </Button>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Cuenta</th>
                        <th className="p-2 text-left">Descripción</th>
                        <th className="p-2 text-right">Débito BS</th>
                        <th className="p-2 text-right">Crédito BS</th>
                        <th className="p-2 text-right">Débito USD</th>
                        <th className="p-2 text-right">Crédito USD</th>
                        <th className="p-2 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, index) => (
                        <tr key={field.id} className="border-t">
                          <td className="p-2">
                            <Select
                              value={watch(`lines.${index}.account_code`) || undefined}
                              onValueChange={(value) => {
                                const selectedAccount = accounts?.find(acc => acc.account_code === value)
                                if (selectedAccount) {
                                  setValue(`lines.${index}.account_code`, selectedAccount.account_code)
                                  setValue(`lines.${index}.account_id`, selectedAccount.id, { shouldValidate: false })
                                  setValue(`lines.${index}.account_name`, selectedAccount.account_name, { shouldValidate: false })
                                }
                              }}
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts?.map((account) => (
                                  <SelectItem key={account.id} value={account.account_code}>
                                    {account.account_code} - {account.account_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {errors.lines?.[index]?.account_code && (
                              <p className="text-xs text-destructive mt-1">
                                {errors.lines[index]?.account_code?.message}
                              </p>
                            )}
                          </td>
                          <td className="p-2">
                            <Input
                              {...register(`lines.${index}.description`)}
                              placeholder="Descripción"
                              className="w-full"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              {...register(`lines.${index}.debit_amount_bs`, { valueAsNumber: true })}
                              className="w-[120px] text-right"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              {...register(`lines.${index}.credit_amount_bs`, { valueAsNumber: true })}
                              className="w-[120px] text-right"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              {...register(`lines.${index}.debit_amount_usd`, { valueAsNumber: true })}
                              className="w-[120px] text-right"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              {...register(`lines.${index}.credit_amount_usd`, { valueAsNumber: true })}
                              className="w-[120px] text-right"
                            />
                          </td>
                          <td className="p-2">
                            {fields.length > 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted font-semibold">
                      <tr>
                        <td colSpan={2} className="p-2 text-right">Total:</td>
                        <td className="p-2 text-right font-mono">{totalDebitBs.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono">{totalCreditBs.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono">${totalDebitUsd.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono">${totalCreditUsd.toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {errors.lines && typeof errors.lines.message === 'string' && (
                  <p className="text-sm text-destructive">{errors.lines.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex justify-end gap-2 flex-shrink-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !!balanceError}>
              {isLoading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
