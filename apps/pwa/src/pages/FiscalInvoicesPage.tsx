import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, FileText, Eye, CheckCircle2, XCircle } from 'lucide-react'
import { fiscalInvoicesService, FiscalInvoiceStatus } from '@/services/fiscal-invoices.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const statusLabels: Record<FiscalInvoiceStatus, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  cancelled: 'Cancelada',
  rejected: 'Rechazada',
}

const statusColors: Record<FiscalInvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  issued: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  rejected: 'bg-orange-100 text-orange-800',
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

  const cancelMutation = useMutation({
    mutationFn: (id: string) => fiscalInvoicesService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] })
      toast.success('Factura cancelada correctamente')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al cancelar la factura')
    },
  })

  const handleIssue = async (id: string) => {
    if (!confirm('¿Está seguro de emitir esta factura fiscal?')) return
    issueMutation.mutate(id)
  }

  const handleCancel = async (id: string) => {
    if (
      !confirm(
        '¿Está seguro de cancelar esta factura fiscal? Esta acción no se puede deshacer.',
      )
    )
      return
    cancelMutation.mutate(id)
  }

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

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
          Facturas Fiscales
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Gestión de facturas fiscales y tributarias
        </p>
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
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
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
                          >
                            <Eye className="w-4 h-4" />
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
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCancel(invoice.id)}
                                disabled={cancelMutation.isPending}
                                className="h-8 w-8 text-red-600 hover:text-red-700"
                                title="Cancelar"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {invoice.status === 'issued' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCancel(invoice.id)}
                              disabled={cancelMutation.isPending}
                              className="h-8 w-8 text-red-600 hover:text-red-700"
                              title="Cancelar"
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
    </div>
  )
}
