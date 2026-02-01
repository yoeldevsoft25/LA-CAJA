import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { accountingEntriesService } from '@/services/accounting.service'
import type { AccountingEntry, EntryType, EntryStatus } from '@/types/accounting.types'
import { CheckCircle2, XCircle } from 'lucide-react'
import toast from '@/lib/toast'

const entryTypeLabels: Record<EntryType, string> = {
  sale: 'Venta',
  purchase: 'Compra',
  fiscal_invoice: 'Factura Fiscal',
  manual: 'Manual',
  adjustment: 'Ajuste',
  closing: 'Cierre',
}

const entryStatusLabels: Record<EntryStatus, string> = {
  draft: 'Borrador',
  posted: 'Contabilizado',
  cancelled: 'Cancelado',
}

const entryStatusColors: Record<EntryStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  posted: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

interface EntryDetailModalProps {
  isOpen: boolean
  onClose: () => void
  entry: AccountingEntry | null
  onSuccess?: () => void
}

export default function EntryDetailModal({
  isOpen,
  onClose,
  entry,
  onSuccess,
}: EntryDetailModalProps) {
  const queryClient = useQueryClient()

  const postMutation = useMutation({
    mutationFn: (id: string) => accountingEntriesService.post(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'entries'] })
      toast.success('Asiento contabilizado exitosamente')
      onSuccess?.()
      onClose()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al contabilizar el asiento'
      toast.error(message)
    },
  })

  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => accountingEntriesService.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting', 'entries'] })
      toast.success('Asiento cancelado exitosamente')
      setShowCancelDialog(false)
      setCancelReason('')
      onSuccess?.()
      onClose()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Error al cancelar el asiento'
      toast.error(message)
    },
  })

  if (!entry) return null

  const canPost = entry.status === 'draft'
  const canCancel = entry.status === 'draft' || entry.status === 'posted'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg sm:text-xl">
              Asiento #{entry.entry_number}
            </DialogTitle>
            <Badge className={entryStatusColors[entry.status]}>
              {entryStatusLabels[entry.status]}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
          <div className="space-y-6">
            {/* Información general */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Fecha</p>
                <p className="font-medium">{format(new Date(entry.entry_date), 'dd/MM/yyyy')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-medium">{entryTypeLabels[entry.entry_type]}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Descripción</p>
                <p className="font-medium">{entry.description}</p>
              </div>
            </div>

            {/* Líneas del asiento */}
            <div>
              <h3 className="font-semibold mb-3">Líneas del Asiento</h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuenta</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Débito BS</TableHead>
                      <TableHead className="text-right">Crédito BS</TableHead>
                      <TableHead className="text-right">Débito USD</TableHead>
                      <TableHead className="text-right">Crédito USD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entry.lines.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono font-semibold">{line.account_code}</TableCell>
                        <TableCell>{line.account_name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(line.debit_amount_bs) > 0 ? Number(line.debit_amount_bs).toFixed(2) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(line.credit_amount_bs) > 0 ? Number(line.credit_amount_bs).toFixed(2) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(line.debit_amount_usd) > 0 ? `$${Number(line.debit_amount_usd).toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(line.credit_amount_usd) > 0 ? `$${Number(line.credit_amount_usd).toFixed(2)}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted font-semibold">
                      <TableCell colSpan={2} className="text-right">Total:</TableCell>
                      <TableCell className="text-right font-mono">{Number(entry.total_debit_bs).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">{Number(entry.total_credit_bs).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">${Number(entry.total_debit_usd).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">${Number(entry.total_credit_usd).toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Metadatos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Creado</p>
                <p>{format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
              {entry.posted_at && (
                <div>
                  <p className="text-muted-foreground">Contabilizado</p>
                  <p>{format(new Date(entry.posted_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
              )}
              {entry.cancelled_at && (
                <div>
                  <p className="text-muted-foreground">Cancelado</p>
                  <p>{format(new Date(entry.cancelled_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
              )}
              {entry.source_type && (
                <div>
                  <p className="text-muted-foreground">Origen</p>
                  <p>{entry.source_type}: {entry.source_id}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex justify-end gap-2 flex-shrink-0">
          {canPost && (
            <Button
              onClick={() => postMutation.mutate(entry.id)}
              disabled={postMutation.isPending}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Contabilizar
            </Button>
          )}
          {canCancel && (
            <Button
              variant="destructive"
              onClick={() => setShowCancelDialog(true)}
              disabled={cancelMutation.isPending}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>

      {/* Dialog para solicitar razón de cancelación */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Asiento</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de cancelar este asiento? Por favor, proporciona una razón para la cancelación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Razón de cancelación *</Label>
              <Input
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej: Error en los datos, transacción revertida, etc."
                autoFocus
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelReason('')}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!cancelReason.trim()) {
                  toast.error('Por favor, proporciona una razón para la cancelación')
                  return
                }
                cancelMutation.mutate({ id: entry.id, reason: cancelReason.trim() })
              }}
              disabled={cancelMutation.isPending || !cancelReason.trim()}
            >
              Confirmar Cancelación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

