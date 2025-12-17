import { FileText, Package, DollarSign, Calendar, User, CreditCard, UserCircle, Receipt } from 'lucide-react'
import { Sale } from '@/services/sales.service'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface SaleDetailModalProps {
  isOpen: boolean
  onClose: () => void
  sale: Sale | null
}

const paymentMethodLabels: Record<string, string> = {
  CASH_BS: 'Efectivo Bs',
  CASH_USD: 'Efectivo USD',
  PAGO_MOVIL: 'Pago Móvil',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
  SPLIT: 'Mixto',
  FIAO: 'Fiado',
}

const currencyLabels: Record<string, string> = {
  BS: 'Bolívares',
  USD: 'Dólares',
  MIXED: 'Mixto',
}

export default function SaleDetailModal({
  isOpen,
  onClose,
  sale,
}: SaleDetailModalProps) {
  if (!sale) return null

  const totalItems = sale.items.reduce((sum, item) => sum + item.qty, 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
            Detalle de Venta
            {sale.invoice_full_number && (
              <Badge variant="default" className="ml-2 font-mono">
                <Receipt className="w-3 h-3 mr-1" />
                {sale.invoice_full_number}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm mt-0.5">
            ID: {sale.id.substring(0, 8)}...
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          <div className="space-y-4 sm:space-y-6">
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
                        {sale.items.length} producto{sale.items.length !== 1 ? 's' : ''} - {totalItems}{' '}
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
              {sale.payment.method === 'SPLIT' && sale.payment.split && (
                <Card className="bg-info/5 border-info/50">
                  <CardHeader>
                    <CardTitle className="text-sm sm:text-base text-info">
                      Desglose de Pago Mixto
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      {sale.payment.split.cash_bs && (
                        <div>
                          <span className="text-muted-foreground">Efectivo Bs:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            {Number(sale.payment.split.cash_bs).toFixed(2)} Bs
                          </span>
                        </div>
                      )}
                      {sale.payment.split.cash_usd && (
                        <div>
                          <span className="text-muted-foreground">Efectivo USD:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            ${Number(sale.payment.split.cash_usd).toFixed(2)}
                          </span>
                        </div>
                      )}
                      {sale.payment.split.pago_movil_bs && (
                        <div>
                          <span className="text-muted-foreground">Pago Móvil:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            {Number(sale.payment.split.pago_movil_bs).toFixed(2)} Bs
                          </span>
                        </div>
                      )}
                      {sale.payment.split.transfer_bs && (
                        <div>
                          <span className="text-muted-foreground">Transferencia:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            {Number(sale.payment.split.transfer_bs).toFixed(2)} Bs
                          </span>
                        </div>
                      )}
                      {sale.payment.split.other_bs && (
                        <div>
                          <span className="text-muted-foreground">Otro:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            {Number(sale.payment.split.other_bs).toFixed(2)} Bs
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Lista de productos */}
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground mb-3">
                  Productos Vendidos
                </h3>
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
                        {sale.items.map((item) => {
                          const unitPriceBs = Number(item.unit_price_bs)
                          const unitPriceUsd = Number(item.unit_price_usd)
                          const discountBs = Number(item.discount_bs || 0)
                          const discountUsd = Number(item.discount_usd || 0)
                          const subtotalBs = unitPriceBs * item.qty - discountBs
                          const subtotalUsd = unitPriceUsd * item.qty - discountUsd

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
                                <span className="font-semibold text-foreground">{item.qty}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-sm text-foreground">
                                  ${unitPriceUsd.toFixed(2)} / {unitPriceBs.toFixed(2)} Bs
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
        <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <Button onClick={onClose} className="w-full">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

