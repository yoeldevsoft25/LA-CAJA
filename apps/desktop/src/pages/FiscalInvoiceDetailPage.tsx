import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Printer,
  FileText,
} from 'lucide-react'
import { fiscalInvoicesService } from '@/services/fiscal-invoices.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import toast from '@/lib/toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import FiscalInvoicePrintView from '@/components/fiscal/FiscalInvoicePrintView'

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  cancelled: 'Cancelada',
  rejected: 'Rechazada',
}

const statusColors: Record<string, string> = {
  draft: 'bg-card text-foreground border border-border',
  issued: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  rejected: 'bg-orange-100 text-orange-800',
}

export default function FiscalInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['fiscal-invoices', id],
    queryFn: () => fiscalInvoicesService.findOne(id!),
    enabled: !!id,
  })

  const issueMutation = useMutation({
    mutationFn: () => fiscalInvoicesService.issue(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices', id] })
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] })
      toast.success('Factura emitida correctamente')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al emitir la factura')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => fiscalInvoicesService.cancel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices', id] })
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] })
      toast.success('Factura cancelada correctamente.')
      setShowCancelDialog(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al cancelar la factura')
    },
  })

  const createCreditNoteMutation = useMutation({
    mutationFn: (reason?: string) =>
      fiscalInvoicesService.createCreditNote(id!, reason ? { reason } : undefined),
    onSuccess: (creditNote) => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices', id] })
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] })
      toast.success('Nota de crédito creada correctamente. Revise el borrador y emítala.')
      setShowCancelDialog(false)
      setCreditNoteReason('')
      navigate(`/app/fiscal-invoices/${creditNote.id}`)
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || 'Error al crear la nota de crédito',
      )
    },
  })

  const [creditNoteReason, setCreditNoteReason] = useState('')

  const handleIssue = () => {
    if (!confirm('¿Está seguro de emitir esta factura fiscal?')) return
    issueMutation.mutate()
  }

  const handleCancel = () => {
    setShowCancelDialog(true)
  }

  const handleConfirmCancel = () => {
    if (invoice?.status === 'issued') {
      createCreditNoteMutation.mutate(creditNoteReason || undefined)
    } else {
      cancelMutation.mutate()
    }
  }

  const isCancelPending =
    cancelMutation.isPending || createCreditNoteMutation.isPending

  const handlePrint = () => {
    setShowPrintPreview(true)
  }

  const handleActualPrint = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="h-full max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Cargando factura...</p>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="h-full max-w-4xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertTitle>Factura no encontrada</AlertTitle>
          <AlertDescription>
            La factura fiscal solicitada no existe o fue eliminada.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/app/fiscal-invoices')} className="mt-4">
          Volver a Facturas
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full max-w-4xl mx-auto">
      {/* Header - Oculto en impresión */}
      <div className="mb-6 flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/fiscal-invoices')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
              Factura Fiscal: {invoice.invoice_number}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {invoice.fiscal_number && `Fiscal: ${invoice.fiscal_number}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {invoice.status === 'draft' && (
            <>
              <Button
                onClick={handleIssue}
                disabled={issueMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Emitir Factura
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={isCancelPending}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </>
          )}
          {invoice.status === 'issued' && (
            <>
              <Button onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={isCancelPending}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Crear nota de crédito
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Estado - Oculto en impresión */}
      <Card className="mb-6 no-print">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Badge className={statusColors[invoice.status]} variant="secondary">
              {statusLabels[invoice.status]}
            </Badge>
            {invoice.issued_at && (
              <span className="text-sm text-muted-foreground">
                Emitida el: {new Date(invoice.issued_at).toLocaleString()}
              </span>
            )}
            {invoice.cancelled_at && (
              <span className="text-sm text-muted-foreground">
                Cancelada el: {new Date(invoice.cancelled_at).toLocaleString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vista de factura fiscal (formato para impresión) */}
      <div className="invoice-print-container">
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-8">
          {/* Encabezado */}
          <div className="border-b-2 border-gray-800 pb-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-2xl font-bold mb-2">{invoice.issuer_name}</h2>
                <p className="text-sm">RIF: {invoice.issuer_tax_id}</p>
                {invoice.issuer_address && (
                  <p className="text-sm">{invoice.issuer_address}</p>
                )}
                {invoice.issuer_phone && (
                  <p className="text-sm">Tel: {invoice.issuer_phone}</p>
                )}
                {invoice.issuer_email && (
                  <p className="text-sm">Email: {invoice.issuer_email}</p>
                )}
              </div>
              <div className="text-right">
                <h3 className="text-xl font-bold mb-2">FACTURA FISCAL</h3>
                <p className="text-sm">Número: {invoice.invoice_number}</p>
                {invoice.fiscal_number && (
                  <p className="text-sm">Fiscal: {invoice.fiscal_number}</p>
                )}
                {invoice.fiscal_authorization_number && (
                  <p className="text-sm">
                    Autorización: {invoice.fiscal_authorization_number}
                  </p>
                )}
                {invoice.issued_at && (
                  <p className="text-sm">
                    Fecha: {new Date(invoice.issued_at).toLocaleDateString('es-VE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Información del Cliente */}
          <div className="mb-4">
            <h3 className="font-semibold mb-1">Cliente:</h3>
            <p className="text-sm">{invoice.customer_name || 'Consumidor Final'}</p>
            {invoice.customer_tax_id && (
              <p className="text-sm">RIF/Cédula: {invoice.customer_tax_id}</p>
            )}
          </div>

          {/* Items */}
          <div className="mb-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  <TableHead className="text-right">Descuento</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Impuesto</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>{item.product_name}</div>
                      {item.product_code && (
                        <div className="text-xs text-muted-foreground">
                          Código: {item.product_code}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      Bs. {Number(item.unit_price_bs).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      Bs. {Number(item.discount_bs).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      Bs. {Number(item.subtotal_bs).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      Bs. {Number(item.tax_amount_bs).toFixed(2)} ({item.tax_rate}%)
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      Bs. {Number(item.total_bs).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totales */}
          <div className="border-t-2 border-gray-800 pt-4">
            <div className="flex justify-end">
              <div className="w-64">
                <div className="flex justify-between mb-2">
                  <span>Subtotal:</span>
                  <span>Bs. {Number(invoice.subtotal_bs).toFixed(2)}</span>
                </div>
                {Number(invoice.discount_bs) > 0 && (
                  <div className="flex justify-between mb-2">
                    <span>Descuento:</span>
                    <span>- Bs. {Number(invoice.discount_bs).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between mb-2">
                  <span>Impuesto ({Number(invoice.tax_rate).toFixed(2)}%):</span>
                  <span>Bs. {Number(invoice.tax_amount_bs).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                  <span>TOTAL:</span>
                  <span>Bs. {Number(invoice.total_bs).toFixed(2)}</span>
                </div>
                <div className="text-right text-sm text-muted-foreground mt-1">
                  USD {Number(invoice.total_usd).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Código QR Fiscal y Código de Control */}
          <div className="mt-6 text-center">
            {invoice.fiscal_qr_code && (
              <div className="inline-block p-4 bg-card border border-border rounded">
                <img
                  src={invoice.fiscal_qr_code}
                  alt="Código QR Fiscal"
                  className="w-32 h-32"
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Código QR Fiscal
            </p>
            {invoice.fiscal_control_code && (
              <p className="text-xs text-muted-foreground mt-1">
                Código de Control Fiscal: {invoice.fiscal_control_code}
              </p>
            )}
          </div>

          {/* Notas */}
          {invoice.note && (
            <div className="mt-6 border-t pt-4">
              <p className="text-sm">
                <strong>Nota:</strong> {invoice.note}
              </p>
            </div>
          )}

          {/* Información de Venta Asociada */}
          {invoice.sale && (
            <div className="mt-6 border-t pt-4 text-sm text-muted-foreground">
              <p>
                Venta asociada:{' '}
                {invoice.sale.invoice_full_number || invoice.sale.id}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Dialog de vista previa e impresión */}
      <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center justify-between">
              <span>Vista Previa de Impresión</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowPrintPreview(false)}>
                  Cerrar
                </Button>
                <Button onClick={handleActualPrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <FiscalInvoicePrintView ref={printRef} invoice={invoice} />
        </DialogContent>
      </Dialog>

      {/* Diálogo: cancelar borrador o crear nota de crédito (factura emitida) */}
      <AlertDialog open={showCancelDialog} onOpenChange={(open) => {
        setShowCancelDialog(open)
        if (!open) setCreditNoteReason('')
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              {invoice?.status === 'issued'
                ? 'Crear nota de crédito'
                : 'Cancelar Factura Fiscal'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              {invoice?.status === 'issued' ? (
                <>
                  <p>
                    Se creará una <strong>nota de crédito</strong> con los mismos datos
                    (cliente, ítems, totales) que esta factura. Según normativa SENIAT,
                    las facturas emitidas no pueden cancelarse directamente.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    La nota se creará en borrador. Deberá revisarla y emitirla desde el
                    detalle de la nueva factura.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="credit-note-reason">
                      Motivo (opcional)
                    </Label>
                    <Input
                      id="credit-note-reason"
                      value={creditNoteReason}
                      onChange={(e) => setCreditNoteReason(e.target.value)}
                      placeholder="Ej. Venta duplicada por error"
                    />
                  </div>
                </>
              ) : (
                <p>
                  ¿Está seguro de cancelar esta factura en borrador? Esta acción no se
                  puede deshacer.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelPending}>
              No, mantener factura
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={isCancelPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isCancelPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  {invoice?.status === 'issued' ? 'Creando...' : 'Cancelando...'}
                </>
              ) : invoice?.status === 'issued' ? (
                'Sí, crear nota de crédito'
              ) : (
                'Sí, cancelar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
