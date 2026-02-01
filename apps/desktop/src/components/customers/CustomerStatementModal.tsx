import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { customersService, Customer } from '@/services/customers.service'
import { debtsService } from '@/services/debts.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { 
  Printer, 
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface CustomerStatementModalProps {
  isOpen: boolean
  onClose: () => void
  customer: Customer | null
}

export default function CustomerStatementModal({
  isOpen,
  onClose,
  customer,
}: CustomerStatementModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  // Obtener historial de compras
  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['customer-history', customer?.id],
    queryFn: () => customersService.getPurchaseHistory(customer!.id, 50),
    enabled: isOpen && !!customer,
  })

  // Obtener resumen de deudas
  const { data: debtsSummary, isLoading: loadingDebts } = useQuery({
    queryKey: ['debts', 'customer-summary', customer?.id],
    queryFn: () => debtsService.getCustomerSummary(customer!.id),
    enabled: isOpen && !!customer,
  })

  // Obtener deudas individuales para mostrar en la tabla
  const { data: customerDebts } = useQuery({
    queryKey: ['debts', 'customer', customer?.id],
    queryFn: () => debtsService.getByCustomer(customer!.id, false),
    enabled: isOpen && !!customer,
  })

  const isLoading = loadingHistory || loadingDebts

  const handlePrint = () => {
    if (!printRef.current) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes para imprimir')
      return
    }

    const styles = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          padding: 20px;
          color: #1a1a1a;
          line-height: 1.6;
        }
        .print-header { 
          text-align: center; 
          margin-bottom: 24px; 
          border-bottom: 2px solid #333; 
          padding-bottom: 16px; 
        }
        .print-header h1 { 
          font-size: 28px; 
          font-weight: bold; 
          margin-bottom: 8px; 
        }
        .print-header p { 
          font-size: 14px; 
          color: #666; 
        }
        .print-customer-info { 
          background: #f5f5f5; 
          padding: 20px; 
          border-radius: 8px; 
          margin-bottom: 24px; 
        }
        .print-customer-info h2 { 
          font-size: 20px; 
          margin-bottom: 12px; 
          color: #1a1a1a; 
        }
        .print-customer-info p { 
          font-size: 14px; 
          margin: 6px 0; 
          line-height: 1.8;
        }
        .print-customer-info strong { 
          color: #666; 
        }
        .print-stats-grid { 
          display: grid; 
          grid-template-columns: repeat(3, 1fr); 
          gap: 16px; 
          margin-bottom: 24px; 
        }
        .print-stat-card { 
          background: #f5f5f5; 
          padding: 16px; 
          border-radius: 8px; 
          text-align: center; 
          border: 1px solid #ddd;
        }
        .print-stat-card .label { 
          font-size: 11px; 
          color: #666; 
          margin-bottom: 8px; 
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .print-stat-card .value { 
          font-size: 24px; 
          font-weight: bold; 
          color: #1a1a1a; 
        }
        .print-section-title { 
          font-size: 18px; 
          font-weight: bold; 
          margin: 24px 0 16px; 
          padding-bottom: 8px; 
          border-bottom: 2px solid #ddd; 
        }
        .print-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 24px; 
          font-size: 13px; 
        }
        .print-table thead tr {
          background: #f5f5f5;
        }
        .print-table th, .print-table td { 
          padding: 12px 16px; 
          text-align: left; 
          border-bottom: 1px solid #e5e5e5; 
        }
        .print-table th { 
          font-weight: 600; 
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #666;
        }
        .print-table tbody tr:hover {
          background: #f9f9f9;
        }
        .print-table .text-right { text-align: right; }
        .print-table .text-center { text-align: center; }
        .print-table tbody tr:last-child {
          background: #f5f5f5;
          font-weight: bold;
        }
        .print-debt-open { 
          background: #fef2f2; 
          color: #dc2626; 
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          display: inline-block;
        }
        .print-debt-partial { 
          background: #fff7ed; 
          color: #ea580c; 
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          display: inline-block;
        }
        .print-footer { 
          margin-top: 32px; 
          padding-top: 16px; 
          border-top: 1px solid #ddd; 
          text-align: center; 
          font-size: 12px; 
          color: #666;
          line-height: 1.8;
        }
        .print-footer p {
          margin: 4px 0;
        }
        @media print {
          body { 
            padding: 15px; 
          }
          .no-print { 
            display: none; 
          }
          @page {
            margin: 1cm;
          }
        }
      </style>
    `

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Estado de Cuenta - ${customer?.name || 'Cliente'}</title>
          ${styles}
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  if (!customer) return null

  const today = new Date()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 md:px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">Estado de Cuenta</DialogTitle>
              <DialogDescription>
                {customer.name}
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={isLoading}
              className="gap-2"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-muted-foreground">Cargando estado de cuenta...</p>
            </div>
          )}

          {!isLoading && (
            <div ref={printRef} className="print-content">
              {/* Header para impresión */}
              <div className="header print-header">
                <h1 className="text-2xl font-bold mb-2">ESTADO DE CUENTA</h1>
                <p className="text-sm text-muted-foreground">Fecha de emisión: {format(today, "dd 'de' MMMM 'de' yyyy", { locale: es })}</p>
              </div>

              {/* Información del cliente */}
              <div className="customer-info print-customer-info bg-muted/50 rounded-lg p-4 mb-6">
                <h2 className="text-lg font-semibold mb-3 text-foreground">{customer.name}</h2>
                <div className="space-y-1 text-sm">
                  {customer.document_id && (
                    <p><strong className="text-muted-foreground">CI/RIF:</strong> <span className="ml-2">{customer.document_id}</span></p>
                  )}
                  {customer.phone && (
                    <p><strong className="text-muted-foreground">Teléfono:</strong> <span className="ml-2">{customer.phone}</span></p>
                  )}
                  {customer.email && (
                    <p><strong className="text-muted-foreground">Email:</strong> <span className="ml-2">{customer.email}</span></p>
                  )}
                </div>
              </div>

              {/* Estadísticas */}
              <div className="stats-grid print-stats-grid grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="stat-card print-stat-card bg-muted/50 rounded-lg p-4 text-center border border-border">
                  <div className="label text-xs text-muted-foreground mb-2 uppercase tracking-wide">Total Compras</div>
                  <div className="value text-2xl font-bold text-foreground">{history?.total_purchases || 0}</div>
                </div>
                <div className="stat-card print-stat-card bg-muted/50 rounded-lg p-4 text-center border border-border">
                  <div className="label text-xs text-muted-foreground mb-2 uppercase tracking-wide">Total en USD</div>
                  <div className="value text-2xl font-bold text-foreground">${(history?.total_amount_usd || 0).toFixed(2)}</div>
                </div>
                <div className="stat-card print-stat-card bg-muted/50 rounded-lg p-4 text-center border border-border">
                  <div className="label text-xs text-muted-foreground mb-2 uppercase tracking-wide">Saldo Deudor USD</div>
                  <div className={`value text-2xl font-bold ${debtsSummary?.remaining_usd ? 'text-destructive' : 'text-green-600'}`}>
                    ${(debtsSummary?.remaining_usd || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Deudas pendientes */}
              {customerDebts && customerDebts.filter((d) => d.status !== 'paid').length > 0 && (
                <div className="mb-6">
                  <h3 className="section-title print-section-title text-lg font-semibold mb-4 pb-2 border-b border-border">Deudas Pendientes</h3>
                  <div className="overflow-x-auto -mx-4 md:mx-0">
                    <div className="inline-block min-w-full align-middle px-4 md:px-0">
                      <table className="w-full border-collapse print-table">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Fecha</th>
                            <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Factura</th>
                            <th className="px-3 md:px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Monto USD</th>
                            <th className="px-3 md:px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Pendiente USD</th>
                            <th className="px-3 md:px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {customerDebts
                            .filter((d) => d.status !== 'paid')
                            .map((debt) => {
                              const totalPaidUsd = (debt.payments || []).reduce((sum, p) => sum + Number(p.amount_usd), 0)
                              const remainingUsd = Number(debt.amount_usd) - totalPaidUsd
                              return (
                                <tr key={debt.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-3 md:px-4 py-3 text-sm whitespace-nowrap">{format(new Date(debt.created_at), 'dd/MM/yyyy')}</td>
                                  <td className="px-3 md:px-4 py-3 text-sm font-mono text-muted-foreground whitespace-nowrap">{debt.sale?.id || '-'}</td>
                                  <td className="px-3 md:px-4 py-3 text-sm text-right font-medium whitespace-nowrap">${Number(debt.amount_usd).toFixed(2)}</td>
                                  <td className="px-3 md:px-4 py-3 text-sm text-right font-medium whitespace-nowrap">${remainingUsd.toFixed(2)}</td>
                                  <td className="px-3 md:px-4 py-3 text-center whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      debt.status === 'open' 
                                        ? 'bg-red-100 text-red-800 print-debt-open' 
                                        : 'bg-orange-100 text-orange-800 print-debt-partial'
                                    }`}>
                                      {debt.status === 'open' ? 'Pendiente' : 'Parcial'}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          <tr className="bg-muted/50 font-semibold">
                            <td colSpan={3} className="px-3 md:px-4 py-3">Total Pendiente</td>
                            <td className="px-3 md:px-4 py-3 text-right text-base whitespace-nowrap">${(debtsSummary?.remaining_usd || 0).toFixed(2)}</td>
                            <td className="px-3 md:px-4 py-3"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Historial de compras */}
              {history && history.recent_sales && history.recent_sales.length > 0 && (
                <div className="mb-6">
                  <h3 className="section-title print-section-title text-lg font-semibold mb-4 pb-2 border-b border-border">Historial de Compras Recientes</h3>
                  <div className="overflow-x-auto -mx-4 md:mx-0">
                    <div className="inline-block min-w-full align-middle px-4 md:px-0">
                      <table className="w-full border-collapse print-table">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Fecha</th>
                            <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Referencia</th>
                            <th className="px-3 md:px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Método de Pago</th>
                            <th className="px-3 md:px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Total USD</th>
                            <th className="px-3 md:px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Total Bs</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {history.recent_sales.map((sale) => (
                            <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-3 md:px-4 py-3 text-sm whitespace-nowrap">{format(new Date(sale.sold_at), 'dd/MM/yyyy HH:mm')}</td>
                              <td className="px-3 md:px-4 py-3 text-sm font-mono text-muted-foreground whitespace-nowrap">{sale.sale_number || '-'}</td>
                              <td className="px-3 md:px-4 py-3 text-sm whitespace-nowrap">{getPaymentMethodLabel(sale.payment_method)}</td>
                              <td className="px-3 md:px-4 py-3 text-sm text-right font-medium whitespace-nowrap">${sale.total_usd.toFixed(2)}</td>
                              <td className="px-3 md:px-4 py-3 text-sm text-right font-medium whitespace-nowrap">Bs {sale.total_bs.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Resumen de crédito */}
              {customer.credit_limit && Number(customer.credit_limit) > 0 && (
                <div className="mb-6">
                  <h3 className="section-title print-section-title text-lg font-semibold mb-4 pb-2 border-b border-border">Información de Crédito</h3>
                  <div className="customer-info print-customer-info bg-muted/50 rounded-lg p-4">
                    <div className="space-y-2 text-sm">
                      <p><strong className="text-muted-foreground">Límite de Crédito:</strong> <span className="ml-2 font-medium">${Number(customer.credit_limit).toFixed(2)} USD</span></p>
                      <p><strong className="text-muted-foreground">Crédito Utilizado:</strong> <span className="ml-2 font-medium">${(debtsSummary?.remaining_usd || 0).toFixed(2)} USD</span></p>
                      <p><strong className="text-muted-foreground">Crédito Disponible:</strong> <span className={`ml-2 font-medium ${(Number(customer.credit_limit) - (debtsSummary?.remaining_usd || 0)) > 0 ? 'text-green-600' : 'text-destructive'}`}>${Math.max(0, Number(customer.credit_limit) - (debtsSummary?.remaining_usd || 0)).toFixed(2)} USD</span></p>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="footer print-footer mt-8 pt-4 border-t border-border text-center text-xs text-muted-foreground space-y-1">
                <p>Este documento es un estado de cuenta informativo generado el {format(today, "dd/MM/yyyy 'a las' HH:mm", { locale: es })}</p>
                <p>Para cualquier consulta, contacte a su representante de ventas.</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function getPaymentMethodLabel(method: string): string {
  const methods: Record<string, string> = {
    CASH_USD: 'Efectivo USD',
    CASH_BS: 'Efectivo Bs',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
    PAGO_MOVIL: 'Pago Móvil',
    ZELLE: 'Zelle',
    MIXED: 'Mixto',
    CREDIT: 'FIAO',
  }
  return methods[method] || method
}
