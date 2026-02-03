import { useState, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { FileText, Package, DollarSign, Calendar, User, CreditCard, UserCircle, Receipt, ReceiptText, ExternalLink, Printer, Ban, Undo2, MessageCircle } from 'lucide-react'
import { Sale, salesService } from '@/services/sales.service'
import { fiscalInvoicesService, FiscalInvoice } from '@/services/fiscal-invoices.service'
import { printService } from '@/services/print.service'
import { useAuth } from '@/stores/auth.store'
import toast from '@/lib/toast'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@la-caja/ui-core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@la-caja/ui-core'
import CreateFiscalInvoiceFromSaleModal from '@/components/fiscal/CreateFiscalInvoiceFromSaleModal'
import ReturnItemsModal from '@/components/sales/ReturnItemsModal'
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
import { useNavigate } from 'react-router-dom'
import { useMobileDetection } from '@/hooks/use-mobile-detection'
import { encodeWhatsAppText, formatSaleForWhatsApp } from '@/utils/whatsapp'

interface SaleDetailModalProps {
  isOpen: boolean
  onClose: () => void
  sale: Sale | null
}

const paymentMethodLabels: Record<string, string> = {
  CASH_BS: 'Efectivo Bs',
  CASH_USD: 'Efectivo USD',
  PAGO_MOVIL: 'Pago Móvil',
  TRANSFER: 'Tarjeta',
  OTHER: 'Biopago',
  SPLIT: 'Mixto',
  FIAO: 'Fiado',
}

const currencyLabels: Record<string, string> = {
  BS: 'Bolívares',
  USD: 'Dólares',
  MIXED: 'Mixto',
}

const formatWeightValue = (value: number, unit?: string | null) => {
  const safeUnit = unit || 'kg'
  const decimals = safeUnit === 'g' || safeUnit === 'oz' ? 0 : 3
  const safeValue = Number.isFinite(value) ? value : 0
  const fixed = safeValue.toFixed(decimals)
  const trimmed = fixed.replace(/\.?0+$/, '')
  return `${trimmed} ${safeUnit}`
}


export default function SaleDetailModal({
  isOpen,
  onClose,
  sale,
}: SaleDetailModalProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isMobile = useMobileDetection()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [fiscalInvoice, setFiscalInvoice] = useState<FiscalInvoice | null>(null)
  const [fiscalInvoices, setFiscalInvoices] = useState<FiscalInvoice[]>([])
  const [showVoidDialog, setShowVoidDialog] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voidedAt, setVoidedAt] = useState<string | null>(sale?.voided_at || null)
  const [voidedReason, setVoidedReason] = useState<string | null>(sale?.void_reason || null)

  // Obtener todas las facturas fiscales asociadas a la venta
  const { data: fiscalInvoicesData, refetch: refetchFiscalInvoice } = useQuery({
    queryKey: ['fiscal-invoices', 'all-by-sale', sale?.id],
    queryFn: () => fiscalInvoicesService.findAllBySale(sale!.id),
    enabled: !!sale?.id && isOpen,
    staleTime: 1000 * 60 * 2, // 2 minutos
  })

  useEffect(() => {
    if (fiscalInvoicesData) {
      setFiscalInvoices(fiscalInvoicesData)
      // Mantener compatibilidad: usar la primera factura (original) si existe
      const originalInvoice = fiscalInvoicesData.find(
        (inv) => inv.invoice_type === 'invoice',
      )
      setFiscalInvoice(originalInvoice || fiscalInvoicesData[0] || null)
    } else {
      setFiscalInvoices([])
      setFiscalInvoice(null)
    }
  }, [fiscalInvoicesData])

  useEffect(() => {
    setVoidedAt(sale?.voided_at || null)
    setVoidedReason(sale?.void_reason || null)
  }, [sale?.voided_at, sale?.void_reason])

  const voidSaleMutation = useMutation({
    mutationFn: ({ saleId, reason }: { saleId: string; reason?: string }) =>
      salesService.voidSale(saleId, reason),
    onSuccess: (updatedSale) => {
      toast.success('Venta anulada correctamente')
      setVoidedAt(updatedSale.voided_at || new Date().toISOString())
      setVoidedReason(updatedSale.void_reason || voidReason.trim() || null)
      setVoidReason('')
      setShowVoidDialog(false)
      queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'No se pudo anular la venta')
    },
  })

  if (!sale) return null

  const isOwner = user?.role === 'owner'
  const isVoided = Boolean(voidedAt)

  // Verificar si hay factura emitida (no nota de crédito)
  const issuedInvoice = fiscalInvoices.find(
    (inv) => inv.invoice_type === 'invoice' && inv.status === 'issued',
  )

  // Verificar si hay nota de crédito emitida
  const issuedCreditNote = fiscalInvoices.find(
    (inv) => inv.invoice_type === 'credit_note' && inv.status === 'issued',
  )

  // Solo bloquear si hay factura emitida PERO NO hay nota de crédito emitida
  const hasIssuedFiscalWithoutCreditNote = Boolean(issuedInvoice && !issuedCreditNote)

  const hasDebtPayments =
    sale.debt &&
    ((sale.debt.total_paid_bs || 0) > 0 || (sale.debt.total_paid_usd || 0) > 0)
  const voidBlockReason = hasIssuedFiscalWithoutCreditNote
    ? 'Esta venta tiene una factura fiscal emitida. Debe crear y emitir una nota de crédito antes de anular la venta.'
    : hasDebtPayments
      ? 'Esta venta tiene pagos asociados.'
      : null
  const canVoid = isOwner && !isVoided && !voidBlockReason
  const saleItems = sale.items || []
  const canReturn = isOwner && !isVoided && saleItems.length > 0

  const totalItems = saleItems.reduce((sum, item) => sum + item.qty, 0)

  const handleCreateSuccess = () => {
    // Invalidar queries y refrescar la factura fiscal
    queryClient.invalidateQueries({ queryKey: ['fiscal-invoices', 'by-sale', sale.id] })
    queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] })
    refetchFiscalInvoice()
    setShowCreateModal(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "flex flex-col p-0 gap-0 overflow-hidden",
        isMobile
          ? "max-w-full max-h-[95vh] rounded-t-2xl rounded-b-none top-auto bottom-0 translate-y-0"
          : "max-w-3xl max-h-[90vh]"
      )}>
        <DialogHeader className={cn(
          "border-b border-border flex-shrink-0",
          isMobile ? "px-4 py-3" : "px-4 md:px-6 py-4"
        )}>
          <DialogTitle className={cn(
            "flex items-center gap-2 flex-wrap",
            isMobile ? "text-lg" : "text-xl"
          )}>
            Detalle de Venta
            {sale.invoice_full_number && (
              <Badge variant="default" className={cn(
                "font-mono",
                isMobile ? "text-xs" : "text-sm"
              )}>
                <Receipt className={cn("mr-1", isMobile ? "w-3 h-3" : "w-4 h-4")} />
                {sale.invoice_full_number}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className={cn(
            "mt-0.5",
            isMobile ? "text-xs" : "text-sm"
          )}>
            ID: {sale.id.substring(0, 8)}...
          </DialogDescription>
        </DialogHeader>

        <div className={cn(
          "flex-1 min-h-0 overflow-y-auto overscroll-contain",
          isMobile ? "px-4 py-4" : "px-4 md:px-6 py-6"
        )}>
          <div className="space-y-4 sm:space-y-6">
            {isVoided && (
              <Card className="bg-destructive/10 border-destructive/30">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-destructive/20 p-2">
                      <Ban className="w-4 h-4 text-destructive" />
                    </div>
                    <div>
                      <p className="font-semibold text-destructive">Venta anulada</p>
                      <p className="text-xs text-muted-foreground">
                        Anulada el {voidedAt ? format(new Date(voidedAt), 'dd/MM/yyyy HH:mm') : '-'}
                      </p>
                      {voidedReason && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Motivo: {voidedReason}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Sección: Información de la Venta */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-foreground mb-3 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Información de la Venta
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card className="bg-muted/50 border-border">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center mb-2">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mr-2" />
                      <span className="text-xs sm:text-sm font-semibold text-foreground">Fecha y Hora</span>
                    </div>
                    <p className="text-sm sm:text-base font-semibold text-foreground">
                      {format(new Date(sale.sold_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </CardContent>
                </Card>

                {sale.invoice_full_number && (
                  <Card className="bg-primary/5 border-primary/50">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center mb-2">
                        <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-primary mr-2" />
                        <span className="text-xs sm:text-sm font-semibold text-primary">Número de Factura</span>
                      </div>
                      <p className="text-sm sm:text-base font-semibold font-mono text-primary">
                        {sale.invoice_full_number}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-muted/50 border-border">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center mb-2">
                      <Package className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mr-2" />
                      <span className="text-xs sm:text-sm font-semibold text-foreground">Productos</span>
                    </div>
                    <p className="text-sm sm:text-base font-semibold text-foreground">
                      {saleItems.length} producto{saleItems.length !== 1 ? 's' : ''} - {totalItems}{' '}
                      unidad{totalItems !== 1 ? 'es' : ''}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Sección: Responsable y Cliente */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-foreground mb-3 flex items-center">
                <UserCircle className="w-4 h-4 mr-2" />
                Responsable y Cliente
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card className="bg-info/5 border-info/50">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center mb-2">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-info mr-2" />
                      <span className="text-xs sm:text-sm font-semibold text-info">Responsable</span>
                    </div>
                    {sale.sold_by_user ? (
                      <>
                        <p className="text-sm sm:text-base font-semibold text-foreground">
                          {sale.sold_by_user.full_name || 'Sin nombre'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ID: {sale.sold_by_user_id?.substring(0, 8)}...
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No disponible</p>
                    )}
                  </CardContent>
                </Card>

                {sale.customer ? (
                  <Card className={cn(
                    'border',
                    sale.payment.method === 'FIAO'
                      ? 'bg-warning/5 border-warning/50'
                      : 'bg-success/5 border-success/50'
                  )}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center mb-2">
                        <UserCircle className={cn('w-4 h-4 sm:w-5 sm:h-5 mr-2', sale.payment.method === 'FIAO' ? 'text-warning' : 'text-success')} />
                        <span className={cn('text-xs sm:text-sm font-semibold', sale.payment.method === 'FIAO' ? 'text-warning' : 'text-success')}>
                          Cliente {sale.payment.method === 'FIAO' && '(Fiado)'}
                        </span>
                      </div>
                      <p className={cn('text-sm sm:text-base font-semibold', sale.payment.method === 'FIAO' ? 'text-warning' : 'text-success')}>
                        {sale.customer.name}
                      </p>
                      {sale.customer.document_id && (
                        <p className={cn('text-xs mt-1', sale.payment.method === 'FIAO' ? 'text-warning/80' : 'text-success/80')}>
                          CI: {sale.customer.document_id}
                        </p>
                      )}
                      {sale.customer.phone && (
                        <p className={cn('text-xs mt-1', sale.payment.method === 'FIAO' ? 'text-warning/80' : 'text-success/80')}>
                          Tel: {sale.customer.phone}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-muted/50 border-border">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center mb-2">
                        <UserCircle className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mr-2" />
                        <span className="text-xs sm:text-sm font-semibold text-foreground">Cliente</span>
                      </div>
                      <p className="text-sm text-muted-foreground">No registrado</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Sección: Información de Pago */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-foreground mb-3 flex items-center">
                <CreditCard className="w-4 h-4 mr-2" />
                Información de Pago
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card className="bg-muted/50 border-border">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center mb-2">
                      <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mr-2" />
                      <span className="text-xs sm:text-sm font-semibold text-foreground">
                        Método de Pago
                      </span>
                    </div>
                    <p className="text-sm sm:text-base font-semibold text-foreground">
                      {paymentMethodLabels[sale.payment.method] || sale.payment.method}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-muted/50 border-border">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center mb-2">
                      <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mr-2" />
                      <span className="text-xs sm:text-sm font-semibold text-foreground">Moneda</span>
                    </div>
                    <p className="text-sm sm:text-base font-semibold text-foreground">
                      {currencyLabels[sale.currency] || sale.currency}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tasa: {Number(sale.exchange_rate).toFixed(2)} Bs/USD
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Sección: Estado de Deuda (FIAO) */}
            {sale.payment.method === 'FIAO' && sale.debt && (
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground mb-3 flex items-center">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Estado de Deuda
                </h3>
                <Card className={cn(
                  'border',
                  sale.debt.status === 'paid'
                    ? 'bg-success/5 border-success/50'
                    : sale.debt.status === 'partial'
                      ? 'bg-warning/5 border-warning/50'
                      : 'bg-warning/5 border-warning/50'
                )}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-foreground mb-1">Estado</p>
                        <Badge
                          variant="secondary"
                          className={cn(
                            sale.debt.status === 'paid'
                              ? 'bg-success text-white'
                              : sale.debt.status === 'partial'
                                ? 'bg-warning text-white'
                                : 'bg-warning text-white'
                          )}
                        >
                          {sale.debt.status === 'paid'
                            ? 'Pagado Completamente'
                            : sale.debt.status === 'partial'
                              ? 'Pago Parcial'
                              : 'Pendiente por Pagar'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-foreground mb-1">Monto Original</p>
                        <p className="text-sm sm:text-base font-semibold text-foreground">
                          {Number(sale.debt.amount_bs).toFixed(2)} Bs / ${Number(sale.debt.amount_usd).toFixed(2)} USD
                        </p>
                      </div>
                      {sale.debt.total_paid_bs !== undefined && sale.debt.total_paid_bs > 0 && (
                        <>
                          <div>
                            <p className="text-xs sm:text-sm font-semibold text-foreground mb-1">Total Pagado</p>
                            <p className="text-sm sm:text-base font-semibold text-success">
                              {Number(sale.debt.total_paid_bs).toFixed(2)} Bs / ${Number(sale.debt.total_paid_usd || 0).toFixed(2)} USD
                            </p>
                          </div>
                          {sale.debt.remaining_bs !== undefined && sale.debt.remaining_bs > 0 && (
                            <div>
                              <p className="text-xs sm:text-sm font-semibold text-foreground mb-1">Pendiente</p>
                              <p className="text-sm sm:text-base font-semibold text-warning">
                                {Number(sale.debt.remaining_bs).toFixed(2)} Bs / ${Number(sale.debt.remaining_usd || 0).toFixed(2)} USD
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {sale.debt.id && (
                      <p className="text-xs text-muted-foreground mt-3">
                        ID de Deuda: {sale.debt.id.substring(0, 8)}...
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Detalle de pago mixto */}
            {(() => {
              // #region agent log
              // Log para debug: verificar datos de pago
              // ⚡ FIX: Solo ejecutar en desarrollo local (no en producción)
              if (import.meta.env.DEV && window.location.hostname === 'localhost' &&
                (sale.currency === 'MIXED' || sale.payment.method === 'SPLIT')) {
                fetch('http://127.0.0.1:7242/ingest/e5054227-0ba5-4d49-832d-470c860ff731', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    location: 'SaleDetailModal.tsx:492',
                    message: 'Mixed payment data check',
                    data: {
                      currency: sale.currency,
                      paymentMethod: sale.payment.method,
                      hasSplit: !!sale.payment.split,
                      splitData: sale.payment.split,
                      hasSplitPayments: !!sale.payment.split_payments,
                      splitPaymentsLength: sale.payment.split_payments?.length || 0,
                      splitPayments: sale.payment.split_payments,
                      fullPayment: sale.payment,
                    },
                    timestamp: Date.now(),
                    sessionId: 'debug-session',
                    runId: 'mixed-payment-check',
                    hypothesisId: 'C',
                  }),
                }).catch(() => { });
              }
              // #endregion

              // Construir desglose desde split si existe, o desde split_payments
              let splitBreakdown: {
                cash_bs?: number
                cash_usd?: number
                pago_movil_bs?: number
                transfer_bs?: number
                other_bs?: number
              } | null = null

              // Si hay split directo, usarlo
              if (sale.payment.split) {
                splitBreakdown = sale.payment.split
              }
              // Si no hay split pero hay split_payments, construir el desglose
              else if (sale.payment.split_payments && sale.payment.split_payments.length > 0) {
                const exchangeRate = Number(sale.exchange_rate) || 1
                splitBreakdown = {}

                for (const payment of sale.payment.split_payments) {
                  const amountUsd = Number(payment.amount_usd ?? 0)
                  const amountBs = Number(payment.amount_bs ?? 0)

                  if (amountUsd <= 0 && amountBs <= 0) continue

                  switch (payment.method) {
                    case 'CASH_BS':
                      splitBreakdown.cash_bs = (splitBreakdown.cash_bs || 0) + (amountBs || amountUsd * exchangeRate)
                      break
                    case 'CASH_USD':
                      splitBreakdown.cash_usd = (splitBreakdown.cash_usd || 0) + (amountUsd || amountBs / exchangeRate)
                      break
                    case 'PAGO_MOVIL':
                      splitBreakdown.pago_movil_bs = (splitBreakdown.pago_movil_bs || 0) + (amountBs || amountUsd * exchangeRate)
                      break
                    case 'TRANSFER':
                      splitBreakdown.transfer_bs = (splitBreakdown.transfer_bs || 0) + (amountBs || amountUsd * exchangeRate)
                      break
                    case 'OTHER':
                      splitBreakdown.other_bs = (splitBreakdown.other_bs || 0) + (amountBs || amountUsd * exchangeRate)
                      break
                  }
                }
              }

              // Mostrar si currency es MIXED o método es SPLIT
              const shouldShow = sale.currency === 'MIXED' || sale.payment.method === 'SPLIT'

              if (!shouldShow) return null

              // Si no hay desglose pero debería mostrarse, mostrar mensaje
              if (!splitBreakdown) {
                return (
                  <Card className="bg-info/5 border-info/50">
                    <CardHeader>
                      <CardTitle className="text-sm sm:text-base text-info">
                        Desglose de Pago Mixto
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        No hay información de desglose disponible para esta venta.
                      </p>
                    </CardContent>
                  </Card>
                )
              }

              const hasAnyAmount =
                (splitBreakdown.cash_bs && splitBreakdown.cash_bs > 0) ||
                (splitBreakdown.cash_usd && splitBreakdown.cash_usd > 0) ||
                (splitBreakdown.pago_movil_bs && splitBreakdown.pago_movil_bs > 0) ||
                (splitBreakdown.transfer_bs && splitBreakdown.transfer_bs > 0) ||
                (splitBreakdown.other_bs && splitBreakdown.other_bs > 0)

              if (!hasAnyAmount) {
                return (
                  <Card className="bg-info/5 border-info/50">
                    <CardHeader>
                      <CardTitle className="text-sm sm:text-base text-info">
                        Desglose de Pago Mixto
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        No se encontraron montos en el desglose de pago.
                      </p>
                    </CardContent>
                  </Card>
                )
              }

              return (
                <Card className="bg-info/5 border-info/50">
                  <CardHeader>
                    <CardTitle className="text-sm sm:text-base text-info">
                      Desglose de Pago Mixto
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      {splitBreakdown.cash_bs && splitBreakdown.cash_bs > 0 && (
                        <div>
                          <span className="text-muted-foreground">Efectivo Bs:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            {Number(splitBreakdown.cash_bs).toFixed(2)} Bs
                          </span>
                        </div>
                      )}
                      {splitBreakdown.cash_usd && splitBreakdown.cash_usd > 0 && (
                        <div>
                          <span className="text-muted-foreground">Efectivo USD:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            ${Number(splitBreakdown.cash_usd).toFixed(2)}
                          </span>
                        </div>
                      )}
                      {splitBreakdown.pago_movil_bs && splitBreakdown.pago_movil_bs > 0 && (
                        <div>
                          <span className="text-muted-foreground">Pago Móvil:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            {Number(splitBreakdown.pago_movil_bs).toFixed(2)} Bs
                          </span>
                        </div>
                      )}
                      {splitBreakdown.transfer_bs && splitBreakdown.transfer_bs > 0 && (
                        <div>
                          <span className="text-muted-foreground">Transferencia:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            {Number(splitBreakdown.transfer_bs).toFixed(2)} Bs
                          </span>
                        </div>
                      )}
                      {splitBreakdown.other_bs && splitBreakdown.other_bs > 0 && (
                        <div>
                          <span className="text-muted-foreground">Otro:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            {Number(splitBreakdown.other_bs).toFixed(2)} Bs
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })()}

            {/* Lista de productos */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-foreground mb-3">
                Productos Vendidos
              </h3>

              {/* Vista de Cards para Mobile */}
              {isMobile ? (
                <div className="space-y-3">
                  {saleItems.map((item) => {
                    const unitPriceBs = Number(item.unit_price_bs)
                    const unitPriceUsd = Number(item.unit_price_usd)
                    const discountBs = Number(item.discount_bs || 0)
                    const discountUsd = Number(item.discount_usd || 0)
                    const subtotalBs = unitPriceBs * item.qty - discountBs
                    const subtotalUsd = unitPriceUsd * item.qty - discountUsd
                    const isWeightProduct = Boolean(item.is_weight_product)
                    const weightValue = Number(item.weight_value ?? item.qty ?? 0)
                    const unitPriceDecimals =
                      item.weight_unit === 'g' || item.weight_unit === 'oz' ? 4 : 2

                    return (
                      <Card key={item.id} className="border-border">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="rounded-full bg-primary/10 p-2 flex-shrink-0">
                              <Package className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground text-base mb-1">
                                {item.product?.name || `Producto ${item.product_id.substring(0, 8)}`}
                              </p>
                              {item.product?.sku && (
                                <p className="text-xs text-muted-foreground mb-2">SKU: {item.product.sku}</p>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2 border-t border-border pt-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Cantidad:</span>
                              <span className="font-semibold text-foreground text-sm">
                                {isWeightProduct
                                  ? formatWeightValue(weightValue, item.weight_unit)
                                  : item.qty}
                              </span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Precio Unit.:</span>
                              <span className="text-sm text-foreground font-medium">
                                {isWeightProduct ? (
                                  <>
                                    ${unitPriceUsd.toFixed(unitPriceDecimals)} /{' '}
                                    {unitPriceBs.toFixed(unitPriceDecimals)} Bs
                                    <span className="text-xs ml-1">/ {item.weight_unit || 'kg'}</span>
                                  </>
                                ) : (
                                  <>
                                    ${unitPriceUsd.toFixed(2)} / {unitPriceBs.toFixed(2)} Bs
                                  </>
                                )}
                              </span>
                            </div>

                            {(discountBs > 0 || discountUsd > 0) && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Descuento:</span>
                                <span className="text-sm font-semibold text-destructive">
                                  -${discountUsd.toFixed(2)} / -{discountBs.toFixed(2)} Bs
                                </span>
                              </div>
                            )}

                            <div className="flex justify-between items-center pt-2 border-t border-border">
                              <span className="text-sm font-semibold text-foreground">Subtotal:</span>
                              <span className="font-bold text-foreground text-base">
                                ${subtotalUsd.toFixed(2)} / {subtotalBs.toFixed(2)} Bs
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                /* Vista de Tabla para Desktop */
                <Card className="border-border">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-center">Cantidad</TableHead>
                          <TableHead className="text-right">Precio Unit.</TableHead>
                          <TableHead className="text-right">Descuento</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {saleItems.map((item) => {
                          const unitPriceBs = Number(item.unit_price_bs)
                          const unitPriceUsd = Number(item.unit_price_usd)
                          const discountBs = Number(item.discount_bs || 0)
                          const discountUsd = Number(item.discount_usd || 0)
                          const subtotalBs = unitPriceBs * item.qty - discountBs
                          const subtotalUsd = unitPriceUsd * item.qty - discountUsd
                          const isWeightProduct = Boolean(item.is_weight_product)
                          const weightValue = Number(item.weight_value ?? item.qty ?? 0)
                          const unitPriceDecimals =
                            item.weight_unit === 'g' || item.weight_unit === 'oz' ? 4 : 2

                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="flex items-center">
                                  <Package className="w-4 h-4 text-muted-foreground mr-2 flex-shrink-0" />
                                  <div>
                                    <p className="font-semibold text-foreground text-sm sm:text-base">
                                      {item.product?.name || `Producto ${item.product_id.substring(0, 8)}`}
                                    </p>
                                    {item.product?.sku && (
                                      <p className="text-xs text-muted-foreground">SKU: {item.product.sku}</p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="font-semibold text-foreground">
                                  {isWeightProduct
                                    ? formatWeightValue(weightValue, item.weight_unit)
                                    : item.qty}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-sm text-foreground">
                                  {isWeightProduct ? (
                                    <>
                                      ${unitPriceUsd.toFixed(unitPriceDecimals)} /{' '}
                                      {unitPriceBs.toFixed(unitPriceDecimals)} Bs /{' '}
                                      {item.weight_unit || 'kg'}
                                    </>
                                  ) : (
                                    <>
                                      ${unitPriceUsd.toFixed(2)} / {unitPriceBs.toFixed(2)} Bs
                                    </>
                                  )}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                {(discountBs > 0 || discountUsd > 0) ? (
                                  <span className="text-sm font-semibold text-destructive">
                                    ${discountUsd.toFixed(2)} / {discountBs.toFixed(2)} Bs
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-bold text-foreground">
                                  ${subtotalUsd.toFixed(2)} / {subtotalBs.toFixed(2)} Bs
                                </span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Totales */}
            <Card className="bg-muted/50 border-border">
              <CardHeader>
                <CardTitle className="text-sm sm:text-base">Resumen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm sm:text-base">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-semibold text-foreground">
                      ${Number(sale.totals.subtotal_usd).toFixed(2)} USD /{' '}
                      {Number(sale.totals.subtotal_bs).toFixed(2)} Bs
                    </span>
                  </div>
                  {(Number(sale.totals.discount_bs) > 0 || Number(sale.totals.discount_usd) > 0) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Descuento:</span>
                      <span className="font-semibold text-destructive">
                        -${Number(sale.totals.discount_usd).toFixed(2)} USD / -{' '}
                        {Number(sale.totals.discount_bs).toFixed(2)} Bs
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="font-bold text-foreground">Total:</span>
                    <span className="font-bold text-primary text-lg">
                      ${Number(sale.totals.total_usd).toFixed(2)} USD /{' '}
                      {Number(sale.totals.total_bs).toFixed(2)} Bs
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sección: Factura Fiscal */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-foreground mb-3 flex items-center">
                <ReceiptText className="w-4 h-4 mr-2" />
                Factura Fiscal
              </h3>
              {fiscalInvoice ? (
                <Card className="bg-primary/5 border-primary/50">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="secondary"
                          className={cn(
                            fiscalInvoice.status === 'issued'
                              ? 'bg-green-100 text-green-800'
                              : fiscalInvoice.status === 'draft'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-red-100 text-red-800'
                          )}
                        >
                          {fiscalInvoice.status === 'issued'
                            ? 'Emitida'
                            : fiscalInvoice.status === 'draft'
                              ? 'Borrador'
                              : 'Cancelada'}
                        </Badge>
                        <span className="font-semibold text-foreground">
                          {fiscalInvoice.invoice_number}
                        </span>
                        {fiscalInvoice.fiscal_number && (
                          <span className="text-xs text-muted-foreground">
                            Fiscal: {fiscalInvoice.fiscal_number}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigate(`/fiscal-invoices/${fiscalInvoice.id}`)
                          onClose()
                        }}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Ver Factura
                      </Button>
                    </div>
                    {fiscalInvoice.issued_at && (
                      <p className="text-xs text-muted-foreground">
                        Emitida el: {new Date(fiscalInvoice.issued_at).toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-muted/50 border-border">
                  <CardContent className="p-3 sm:p-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Esta venta no tiene factura fiscal asociada.
                    </p>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setShowCreateModal(true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <ReceiptText className="w-4 h-4 mr-2" />
                      Generar Factura Fiscal
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Nota */}
            {sale.note && (
              <Card className="bg-warning/5 border-warning/50">
                <CardHeader>
                  <CardTitle className="text-sm sm:text-base text-warning">Nota</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground">{sale.note}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={cn(
          "flex-shrink-0 border-t border-border",
          isMobile ? "px-3 py-3" : "px-4 md:px-6 py-4"
        )}>
          {isOwner && !isVoided && voidBlockReason && (
            <p className="text-xs text-muted-foreground mb-2">{voidBlockReason}</p>
          )}
          <div className={cn(
            "flex gap-2",
            isMobile ? "flex-col" : "flex-wrap gap-3"
          )}>
            {canReturn && (
              <Button
                variant="outline"
                onClick={() => setShowReturnModal(true)}
                className={cn(
                  "border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-700",
                  isMobile ? "w-full" : "flex-1"
                )}
                size={isMobile ? "lg" : "default"}
              >
                <Undo2 className="w-4 h-4 mr-2" />
                Devolución Parcial
              </Button>
            )}
            {isOwner && !isVoided && (
              <Button
                variant="destructive"
                onClick={() => setShowVoidDialog(true)}
                disabled={!canVoid}
                className={isMobile ? "w-full" : "flex-1"}
                size={isMobile ? "lg" : "default"}
              >
                <Ban className="w-4 h-4 mr-2" />
                Anular Venta
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                try {
                  printService.printSale(sale, {
                    storeName: 'Velox POS',
                    cashierName: sale.sold_by_user?.full_name || undefined,
                  })
                  toast.success('Ticket enviado a imprimir')
                } catch (error) {
                  toast.error('Error al imprimir ticket')
                  console.error('[SaleDetail] Error printing:', error)
                }
              }}
              className={isMobile ? "w-full" : "flex-1"}
              size={isMobile ? "lg" : "default"}
            >
              <Printer className="w-4 h-4 mr-2" />
              Reimprimir Ticket
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  const text = formatSaleForWhatsApp(sale, 'Velox POS')
                  const encodedText = encodeWhatsAppText(text)
                  const whatsappUrl = `https://wa.me/?text=${encodedText}`
                  window.open(whatsappUrl, '_blank')
                  toast.success('Abriendo WhatsApp...')
                } catch (error) {
                  toast.error('Error al compartir por WhatsApp')
                  console.error('[SaleDetail] Error sharing to WhatsApp:', error)
                }
              }}
              className={isMobile ? "w-full" : "flex-1"}
              size={isMobile ? "lg" : "default"}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Compartir por WhatsApp
            </Button>
            <Button
              onClick={onClose}
              className={isMobile ? "w-full" : "flex-1"}
              size={isMobile ? "lg" : "default"}
            >
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Modal para crear factura fiscal */}
      {sale && (
        <CreateFiscalInvoiceFromSaleModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          saleId={sale.id}
          onSuccess={handleCreateSuccess}
        />
      )}

      <AlertDialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular Venta</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que deseas anular esta venta? Esta acción revertirá el stock y puede afectar reportes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="void-reason">Motivo (opcional)</Label>
              <Textarea
                id="void-reason"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Ej: Error en el cobro, devolución completa..."
                rows={3}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setVoidReason('')}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => voidSaleMutation.mutate({ saleId: sale.id, reason: voidReason.trim() || undefined })}
              disabled={voidSaleMutation.isPending}
            >
              Confirmar Anulación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Devolución Parcial */}
      {showReturnModal && (
        <ReturnItemsModal
          isOpen={showReturnModal}
          onClose={() => setShowReturnModal(false)}
          sale={sale}
        />
      )}
    </Dialog>
  )
}
