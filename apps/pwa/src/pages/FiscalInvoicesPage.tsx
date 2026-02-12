import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, FileText, Eye, CheckCircle2, XCircle, Download } from 'lucide-react'
import { format } from 'date-fns'
import { fiscalInvoicesService, FiscalInvoiceStatus, FiscalInvoice } from '@/services/fiscal-invoices.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNavigate } from 'react-router-dom'
import toast from '@/lib/toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Label } from '@/components/ui/label'
import { exportToCSV } from '@/utils/export-excel'

const statusLabels: Record<FiscalInvoiceStatus, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  cancelled: 'Cancelada',
  rejected: 'Rechazada',
}

const statusColors: Record<FiscalInvoiceStatus, string> = {
  draft: 'bg-card border border-border text-muted-foreground',
  issued: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
  cancelled: 'bg-destructive/10 text-destructive border border-destructive/20',
  rejected: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
}

export default function FiscalInvoicesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<FiscalInvoiceStatus | 'all'>('all')

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['fiscal-invoices', filterStatus],
    queryFn: () => fiscalInvoicesService.findAll(filterStatus === 'all' ? undefined : filterStatus),
    staleTime: 1000 * 60 * 2, // 2 minutos
  })

  const issueMutation = useMutation({
    mutationFn: (id: string) => fiscalInvoicesService.issue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] })
      toast.success('Factura emitida correctamente')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al emitir la factura')
    },
  })

  const [cancelInvoiceId, setCancelInvoiceId] = useState<string | null>(null)
  const [cancelInvoice, setCancelInvoice] = useState<FiscalInvoice | null>(null)
  const [creditNoteReason, setCreditNoteReason] = useState('')

  const cancelMutation = useMutation({
    mutationFn: (id: string) => fiscalInvoicesService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] })
      toast.success('Factura cancelada correctamente.')
      setCancelInvoiceId(null)
      setCancelInvoice(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al cancelar la factura')
    },
  })

  const createCreditNoteMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      fiscalInvoicesService.createCreditNote(id, reason ? { reason } : undefined),
    onSuccess: (creditNote) => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] })
      toast.success('Nota de crédito creada. Revise el borrador y emítala.')
      setCancelInvoiceId(null)
      setCancelInvoice(null)
      setCreditNoteReason('')
      navigate(`/app/fiscal-invoices/${creditNote.id}`)
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || 'Error al crear la nota de crédito',
      )
    },
  })

  const handleIssue = async (id: string) => {
    if (!confirm('¿Está seguro de emitir esta factura fiscal?')) return
    issueMutation.mutate(id)
  }

  const handleCancel = async (id: string) => {
    const invoiceToCancel = invoices.find((inv) => inv.id === id)
    setCancelInvoice(invoiceToCancel || null)
    setCancelInvoiceId(id)
    setCreditNoteReason('')
  }

  const handleConfirmCancel = () => {
    if (!cancelInvoiceId) return
    if (cancelInvoice?.status === 'issued') {
      createCreditNoteMutation.mutate({
        id: cancelInvoiceId,
        reason: creditNoteReason || undefined,
      })
    } else {
      cancelMutation.mutate(cancelInvoiceId)
    }
  }

  const isCancelPending =
    cancelMutation.isPending || createCreditNoteMutation.isPending

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      inv.invoice_number.toLowerCase().includes(term) ||
      inv.customer_name?.toLowerCase().includes(term) ||
      inv.customer_tax_id?.toLowerCase().includes(term) ||
      inv.fiscal_number?.toLowerCase().includes(term)
    )
  })

  // Exportar libro de ventas (facturas fiscales)
  const handleExportSalesBook = () => {
    // Solo exportar facturas emitidas (estas son las que van en el libro de ventas)
    const issuedInvoices = filteredInvoices.filter((inv) => inv.status === 'issued')
    
    if (issuedInvoices.length === 0) {
      toast.error('No hay facturas emitidas para exportar')
      return
    }

    const timestamp = format(new Date(), 'yyyy-MM-dd')

    exportToCSV(
      issuedInvoices,
      [
        {
          header: 'Número Factura',
          accessor: (inv) => inv.invoice_number,
        },
        {
          header: 'Número Fiscal',
          accessor: (inv) => inv.fiscal_number || '-',
        },
        {
          header: 'Fecha Emisión',
          accessor: (inv) => inv.issued_at ? format(new Date(inv.issued_at), 'dd/MM/yyyy') : '-',
        },
        {
          header: 'Tipo',
          accessor: (inv) => {
            switch (inv.invoice_type) {
              case 'invoice': return 'Factura'
              case 'credit_note': return 'Nota de Crédito'
              case 'debit_note': return 'Nota de Débito'
              default: return inv.invoice_type
            }
          },
        },
        {
          header: 'Cliente',
          accessor: (inv) => inv.customer_name || 'Consumidor Final',
        },
        {
          header: 'RIF Cliente',
          accessor: (inv) => inv.customer_tax_id || '-',
        },
        {
          header: 'Subtotal Bs',
          accessor: (inv) => Number(inv.subtotal_bs),
          format: 'currency',
        },
        {
          header: 'Subtotal USD',
          accessor: (inv) => Number(inv.subtotal_usd),
          format: 'currency',
        },
        {
          header: 'Impuesto Bs',
          accessor: (inv) => Number(inv.tax_amount_bs),
          format: 'currency',
        },
        {
          header: 'Impuesto USD',
          accessor: (inv) => Number(inv.tax_amount_usd),
          format: 'currency',
        },
        {
          header: 'Descuento Bs',
          accessor: (inv) => Number(inv.discount_bs || 0),
          format: 'currency',
        },
        {
          header: 'Descuento USD',
          accessor: (inv) => Number(inv.discount_usd || 0),
          format: 'currency',
        },
        {
          header: 'Total Bs',
          accessor: (inv) => Number(inv.total_bs),
          format: 'currency',
        },
        {
          header: 'Total USD',
          accessor: (inv) => Number(inv.total_usd),
          format: 'currency',
        },
        {
          header: 'Tasa Cambio',
          accessor: (inv) => Number(inv.exchange_rate).toFixed(2),
        },
        {
          header: 'Moneda',
          accessor: (inv) => {
            switch (inv.currency) {
              case 'BS': return 'Bolívares'
              case 'USD': return 'Dólares'
              case 'MIXED': return 'Mixto'
              default: return inv.currency
            }
          },
        },
        {
          header: 'Método de Pago',
          accessor: (inv) => inv.payment_method || '-',
        },
      ],
      {
        filename: `Libro_Ventas_Fiscal_${timestamp}`,
      }
    )

    toast.success(`${issuedInvoices.length} facturas emitidas exportadas a Excel`)
  }

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
              Facturas Fiscales
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Gestión de facturas fiscales y tributarias
            </p>
          </div>
          <Button
            onClick={handleExportSalesBook}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar Libro de Ventas</span>
            <span className="sm:hidden">Exportar</span>
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-4 sm:mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5 z-10" />
                <Input
                  type="text"
                  placeholder="Buscar por número, cliente, RIF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5"
                />
              </div>
            </div>
            <Select
              value={filterStatus}
              onValueChange={(value) => setFilterStatus(value as FiscalInvoiceStatus | 'all')}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="issued">Emitidas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
                <SelectItem value="rejected">Rechazadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de facturas */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center justify-center py-8">
                <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground animate-pulse" />
                <p className="text-muted-foreground">Cargando facturas...</p>
              </div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-8 text-center">
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 rounded-full bg-card border border-border/60 flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-foreground mb-1">
                  {searchTerm || filterStatus !== 'all'
                    ? 'No se encontraron facturas'
                    : 'No hay facturas fiscales registradas'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {searchTerm || filterStatus !== 'all'
                    ? 'Intenta con otros filtros'
                    : 'Las facturas fiscales se crearán desde las ventas o manualmente'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha Emisión</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Impuesto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <div className="font-medium">{invoice.invoice_number}</div>
                        {invoice.fiscal_number && (
                          <div className="text-xs text-muted-foreground">
                            Fiscal: {invoice.fiscal_number}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>{invoice.customer_name || 'Consumidor Final'}</div>
                        {invoice.customer_tax_id && (
                          <div className="text-xs text-muted-foreground">
                            {invoice.customer_tax_id}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {invoice.issued_at
                          ? new Date(invoice.issued_at).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-semibold">
                          Bs. {Number(invoice.total_bs).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          USD {Number(invoice.total_usd).toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>Bs. {Number(invoice.tax_amount_bs).toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">
                          USD {Number(invoice.tax_amount_usd).toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusColors[invoice.status]}
                        >
                          {statusLabels[invoice.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/app/fiscal-invoices/${invoice.id}`)}
                            className="h-8 w-8"
                            title="Ver detalle"
                            aria-label="Ver detalle de factura fiscal"
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          </Button>
                          {invoice.status === 'draft' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleIssue(invoice.id)}
                                disabled={issueMutation.isPending}
                                className="h-8 w-8 text-green-600 hover:text-green-700"
                                title="Emitir"
                                aria-label="Emitir factura fiscal"
                              >
                                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCancel(invoice.id)}
                                disabled={isCancelPending}
                                className="h-8 w-8 text-red-600 hover:text-red-700"
                                title="Cancelar"
                                aria-label="Cancelar factura fiscal"
                              >
                                <XCircle className="w-4 h-4" aria-hidden="true" />
                              </Button>
                            </>
                          )}
                          {invoice.status === 'issued' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCancel(invoice.id)}
                              disabled={isCancelPending}
                              className="h-8 w-8 text-red-600 hover:text-red-700"
                              title="Crear nota de crédito"
                              aria-label="Crear nota de crédito"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo: cancelar borrador o crear nota de crédito (factura emitida) */}
      <AlertDialog open={!!cancelInvoiceId} onOpenChange={(open) => {
        if (!open) {
          setCancelInvoiceId(null)
          setCancelInvoice(null)
          setCreditNoteReason('')
        }
      }}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              {cancelInvoice?.status === 'issued'
                ? 'Crear nota de crédito'
                : 'Cancelar Factura Fiscal'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              {cancelInvoice?.status === 'issued' ? (
                <>
                  <p>
                    Se creará una <strong>nota de crédito</strong> con los mismos datos
                    (cliente, ítems, totales) que la factura {cancelInvoice?.invoice_number}.
                    Según normativa SENIAT, las facturas emitidas no pueden cancelarse directamente.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    La nota se creará en borrador. Deberá revisarla y emitirla desde su detalle.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="credit-note-reason-list">Motivo (opcional)</Label>
                    <Input
                      id="credit-note-reason-list"
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
                  {cancelInvoice?.status === 'issued' ? 'Creando...' : 'Cancelando...'}
                </>
              ) : cancelInvoice?.status === 'issued' ? (
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
