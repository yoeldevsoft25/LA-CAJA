import { useState, useEffect } from 'react'
import { Calendar, DollarSign, CreditCard, FileText, Clock, CheckCircle, AlertCircle, Package, ExternalLink } from 'lucide-react'
import { Debt, DebtPayment, calculateDebtTotals } from '@/services/debts.service'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import SaleDetailModal from '@/components/sales/SaleDetailModal'
import { salesService, Sale } from '@/services/sales.service'
import { useQuery } from '@tanstack/react-query'

interface DebtDetailModalProps {
  isOpen: boolean
  onClose: () => void
  debt: Debt | null
  onAddPayment?: () => void
}

const paymentMethodLabels: Record<string, string> = {
  CASH_BS: 'Efectivo Bs',
  CASH_USD: 'Efectivo USD',
  PAGO_MOVIL: 'Pago Móvil',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
  ROLLOVER: 'Traslado',
}

const statusConfig = {
  open: {
    label: 'Pendiente',
    bgColor: 'bg-warning/10',
    textColor: 'text-warning',
    borderColor: 'border-warning/50',
    icon: AlertCircle,
    badgeVariant: 'default' as const,
    badgeClass: 'bg-warning text-white',
  },
  partial: {
    label: 'Pago Parcial',
    bgColor: 'bg-warning/10',
    textColor: 'text-warning',
    borderColor: 'border-warning/50',
    icon: Clock,
    badgeVariant: 'secondary' as const,
    badgeClass: 'bg-warning/20 text-warning',
  },
  paid: {
    label: 'Pagado',
    bgColor: 'bg-success/10',
    textColor: 'text-success',
    borderColor: 'border-success/50',
    icon: CheckCircle,
    badgeVariant: 'default' as const,
    badgeClass: 'bg-success text-white',
  },
}

export default function DebtDetailModal({
  isOpen,
  onClose,
  debt,
  onAddPayment,
}: DebtDetailModalProps) {
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [saleData, setSaleData] = useState<Sale | null>(null)
  const saleId = debt?.sale_id ?? null

  // Obtener la venta completa cuando se abre el modal de venta
  const { data: fullSale } = useQuery({
    queryKey: ['sale', saleId ?? 'none'],
    queryFn: () => salesService.getById(saleId!),
    enabled: Boolean(saleId) && showSaleModal,
  })

  useEffect(() => {
    if (fullSale) {
      setSaleData(fullSale)
    }
  }, [fullSale])

  if (!debt) return null

  const debtWithTotals = calculateDebtTotals(debt)
  const status = statusConfig[debt.status] || statusConfig.open
  const StatusIcon = status.icon
  const hasPayments = debt.payments && debt.payments.length > 0
  const canAddPayment = debt.status !== 'paid'
  const hasSale = debt.sale && debt.sale_id
  const hasSaleItems = debt.sale?.items && debt.sale.items.length > 0

  const handleViewSale = () => {
    if (debt.sale_id) {
      setShowSaleModal(true)
    }
  }

  const formatWeightValue = (value: number | null | undefined, unit?: string | null) => {
    if (!value) return ''
    const safeUnit = unit || 'kg'
    const decimals = safeUnit === 'g' || safeUnit === 'oz' ? 0 : 3
    const safeValue = Number.isFinite(value) ? value : 0
    const fixed = safeValue.toFixed(decimals)
    const trimmed = fixed.replace(/\.?0+$/, '')
    return `${trimmed} ${safeUnit}`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl">Detalle de Deuda</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm mt-0.5">
            ID: {debt.id.substring(0, 8)}...
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          <div className="space-y-4 sm:space-y-6">
            {/* Estado y Fecha */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card className={cn('border', status.borderColor, status.bgColor)}>
                <CardContent className="p-4">
                  <div className="flex items-center mb-2">
                    <StatusIcon className={cn('w-5 h-5 mr-2', status.textColor)} />
                    <span className={cn('text-sm font-semibold', status.textColor)}>Estado</span>
                  </div>
                  <p className={cn('text-lg font-bold', status.textColor)}>{status.label}</p>
                </CardContent>
              </Card>

              <Card className="bg-muted/50 border-border">
                <CardContent className="p-4">
                  <div className="flex items-center mb-2">
                    <Calendar className="w-5 h-5 text-muted-foreground mr-2" />
                    <span className="text-sm font-semibold text-foreground">Fecha de Creación</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {format(new Date(debt.created_at), "dd 'de' MMMM, yyyy", { locale: es })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(debt.created_at), 'HH:mm', { locale: es })} hrs
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Cliente */}
            {debt.customer && (
              <Card className="bg-info/5 border-info/50">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-info mb-2">Cliente</h3>
                  <p className="text-lg font-bold text-info">{debt.customer.name}</p>
                  {debt.customer.document_id && (
                    <p className="text-sm text-info/80 mt-1">CI: {debt.customer.document_id}</p>
                  )}
                  {debt.customer.phone && (
                    <p className="text-sm text-info/80">Tel: {debt.customer.phone}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Montos */}
            <Card className="border-border">
              <CardHeader className="bg-muted/50">
                <CardTitle className="text-sm flex items-center">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Resumen de Montos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Monto Original:</span>
                  <span className="font-semibold text-foreground">
                    ${Number(debt.amount_usd).toFixed(2)} / {Number(debt.amount_bs).toFixed(2)} Bs
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Pagado:</span>
                  <span className="font-semibold text-success">
                    ${debtWithTotals.total_paid_usd.toFixed(2)} / {debtWithTotals.total_paid_bs.toFixed(2)} Bs
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-border">
                  <span className="font-bold text-foreground">Saldo Pendiente:</span>
                  <span className={cn(
                    'text-lg font-bold',
                    debtWithTotals.remaining_bs > 0 ? 'text-warning' : 'text-success'
                  )}>
                    ${debtWithTotals.remaining_usd.toFixed(2)} / {debtWithTotals.remaining_bs.toFixed(2)} Bs
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Historial de Pagos */}
            <Card className="border-border">
              <CardHeader className="bg-muted/50">
                <CardTitle className="text-sm flex items-center">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Historial de Pagos ({debt.payments?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {hasPayments ? (
                  <div className="divide-y divide-border">
                    {debt.payments
                      .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
                      .map((payment: DebtPayment) => (
                        <div key={payment.id} className="p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center mb-1 gap-2">
                                <Badge variant="secondary">
                                  {paymentMethodLabels[payment.method] || payment.method}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(payment.paid_at), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                                </span>
                              </div>
                              {payment.note && (
                                <p className="text-sm text-muted-foreground mt-1 flex items-start">
                                  <FileText className="w-3.5 h-3.5 mr-1.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                                  {payment.note}
                                </p>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <p className="font-bold text-success">
                                +${Number(payment.amount_usd).toFixed(2)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                +{Number(payment.amount_bs).toFixed(2)} Bs
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                      <CreditCard className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm">No hay pagos registrados</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Venta Asociada y Artículos */}
            {hasSale && (
              <>
                <Card className="bg-muted/50 border-border">
                  <CardHeader className="bg-muted/50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center">
                        <Package className="w-4 h-4 mr-2" />
                        Venta Asociada
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleViewSale}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Ver Venta Completa
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        ID: {debt.sale?.id?.substring(0, 8)}... •{' '}
                        {debt.sale?.sold_at && format(new Date(debt.sale.sold_at), "dd/MM/yyyy HH:mm", { locale: es })}
                      </p>
                      {debt.sale?.totals && (
                        <p className="text-sm font-semibold text-foreground">
                          Total: ${Number(debt.sale.totals.total_usd).toFixed(2)} / {Number(debt.sale.totals.total_bs).toFixed(2)} Bs
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Artículos de la Venta */}
                {hasSaleItems && debt.sale && (
                  <Card className="border-border">
                    <CardHeader className="bg-muted/50">
                      <CardTitle className="text-sm flex items-center">
                        <Package className="w-4 h-4 mr-2" />
                        Artículos de la Venta ({debt.sale.items?.length || 0})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50%]">Producto</TableHead>
                              <TableHead className="text-right">Cantidad</TableHead>
                              <TableHead className="text-right">Precio Unit.</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {debt.sale.items?.map((item) => {
                              const productName = item.product?.name || 'Producto sin nombre'
                              const variantName = item.variant?.name
                              const displayName = variantName ? `${productName} - ${variantName}` : productName
                              const qty = item.is_weight_product && item.weight_value
                                ? formatWeightValue(item.weight_value, item.weight_unit)
                                : Number(item.qty).toFixed(0)
                              const unitPriceUsd = Number(item.unit_price_usd)
                              const unitPriceBs = Number(item.unit_price_bs)
                              const discountUsd = Number(item.discount_usd || 0)
                              const discountBs = Number(item.discount_bs || 0)
                              // Para productos por peso, usar weight_value; para otros, usar qty
                              const quantity = item.is_weight_product && item.weight_value
                                ? Number(item.weight_value)
                                : Number(item.qty)
                              const totalUsd = (unitPriceUsd * quantity) - discountUsd
                              const totalBs = (unitPriceBs * quantity) - discountBs

                              return (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-medium text-foreground">{displayName}</span>
                                      {item.product?.sku && (
                                        <span className="text-xs text-muted-foreground">SKU: {item.product.sku}</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <span className="font-medium">{qty}</span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex flex-col">
                                      <span className="text-sm">${unitPriceUsd.toFixed(2)}</span>
                                      <span className="text-xs text-muted-foreground">{unitPriceBs.toFixed(2)} Bs</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex flex-col">
                                      <span className="font-semibold">${totalUsd.toFixed(2)}</span>
                                      <span className="text-xs text-muted-foreground">{totalBs.toFixed(2)} Bs</span>
                                      {discountUsd > 0 && (
                                        <span className="text-xs text-success">-${discountUsd.toFixed(2)} desc.</span>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cerrar
            </Button>
            {canAddPayment && onAddPayment && (
              <Button
                onClick={onAddPayment}
                className="flex-1 bg-success hover:bg-success/90 text-white"
              >
                Registrar Abono
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Modal de Venta Completa */}
      {saleData && (
        <SaleDetailModal
          isOpen={showSaleModal}
          onClose={() => {
            setShowSaleModal(false)
            setSaleData(null)
          }}
          sale={saleData}
        />
      )}
    </Dialog>
  )
}
