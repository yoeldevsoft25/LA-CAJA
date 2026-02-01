import { useQuery } from '@tanstack/react-query'
import { Calendar, CheckCircle2, Lock, Unlock } from 'lucide-react'
import { cashService, CashSession, CashSessionSummary } from '@/services/cash.service'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

interface CashSessionDetailModalProps {
  isOpen: boolean
  onClose: () => void
  session: CashSession
}

export default function CashSessionDetailModal({
  isOpen,
  onClose,
  session,
}: CashSessionDetailModalProps) {
  const { data: summary, isLoading } = useQuery<CashSessionSummary>({
    queryKey: ['cash', 'session-summary', session.id],
    queryFn: () => cashService.getSessionSummary(session.id),
    enabled: isOpen,
  })

  const isOpenSession = session.closed_at === null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl">Detalle de Sesión de Caja</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm mt-0.5">
            ID: {session.id.substring(0, 8)}...
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          {isLoading ? (
            <div className="text-center py-8">
              <Skeleton className="h-4 w-32 mx-auto" />
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {/* Estado */}
              <Card className={cn(
                'border',
                isOpenSession ? 'bg-success/5 border-success/50' : 'bg-muted/50 border-border'
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    {isOpenSession ? (
                      <Unlock className={cn('w-5 h-5 mr-2', isOpenSession ? 'text-success' : 'text-muted-foreground')} />
                    ) : (
                      <Lock className={cn('w-5 h-5 mr-2', isOpenSession ? 'text-success' : 'text-muted-foreground')} />
                    )}
                    <span className={cn('font-semibold', isOpenSession ? 'text-success' : 'text-foreground')}>
                      {isOpenSession ? 'Sesión Abierta' : 'Sesión Cerrada'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Información básica */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="bg-info/5 border-info/50">
                  <CardContent className="p-4">
                    <div className="flex items-center mb-2">
                      <Calendar className="w-4 h-4 text-info mr-2" />
                      <span className="text-sm font-semibold text-info">Apertura</span>
                    </div>
                    <p className="text-base font-semibold text-foreground">
                      {format(new Date(session.opened_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </CardContent>
                </Card>

                {session.closed_at && (
                  <Card className="bg-muted/50 border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center mb-2">
                        <Lock className="w-4 h-4 text-muted-foreground mr-2" />
                        <span className="text-sm font-semibold text-foreground">Cierre</span>
                      </div>
                      <p className="text-base font-semibold text-foreground">
                        {format(new Date(session.closed_at), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Montos de apertura */}
              <div>
                <h3 className="text-base font-semibold text-foreground mb-3">Montos de Apertura</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card className="bg-success/5 border-success/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-success mb-1">Apertura en Bs</p>
                      <p className="text-xl font-bold text-foreground">
                        {Number(session.opening_amount_bs).toFixed(2)} Bs
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-success/5 border-success/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-success mb-1">Apertura en USD</p>
                      <p className="text-xl font-bold text-foreground">
                        ${Number(session.opening_amount_usd).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Resumen de ventas */}
              {summary && (
                <>
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-3">Resumen de Ventas</h3>
                    <Card className="bg-muted/50 border-border">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Total de Ventas</p>
                            <p className="text-xl font-bold text-foreground">
                              {summary.sales_count} venta{summary.sales_count !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Total Vendido</p>
                            <p className="text-lg font-bold text-foreground">
                              {Number(summary.sales.total_bs).toFixed(2)} Bs / $
                              {Number(summary.sales.total_usd).toFixed(2)} USD
                            </p>
                          </div>
                        </div>

                        {/* Ventas por método de pago */}
                        <div className="border-t border-border pt-4">
                          <p className="text-sm font-medium text-foreground mb-3">
                            Ventas por Método de Pago
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Efectivo Bs:</span>{' '}
                              <span className="font-semibold text-foreground">
                                {Number(summary.sales.by_method.CASH_BS || 0).toFixed(2)} Bs
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Efectivo USD:</span>{' '}
                              <span className="font-semibold text-foreground">
                                ${Number(summary.sales.by_method.CASH_USD || 0).toFixed(2)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Pago Móvil:</span>{' '}
                              <span className="font-semibold text-foreground">
                                {Number(summary.sales.by_method.PAGO_MOVIL || 0).toFixed(2)} Bs
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Transferencia:</span>{' '}
                              <span className="font-semibold text-foreground">
                                {Number(summary.sales.by_method.TRANSFER || 0).toFixed(2)} Bs
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Flujo de efectivo */}
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-3">
                      Flujo de Efectivo
                    </h3>
                    <Card className="bg-info/5 border-info/50">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-info mb-1">Efectivo Esperado (Bs)</p>
                            <p className="text-xl font-bold text-foreground">
                              {Number(summary.cash_flow.expected_bs).toFixed(2)} Bs
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Apertura: {Number(summary.cash_flow.opening_bs).toFixed(2)} Bs + Ventas:{' '}
                              {Number(summary.cash_flow.sales_bs).toFixed(2)} Bs + Movimientos:{' '}
                              {Number(summary.cash_flow.movements_bs).toFixed(2)} Bs
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-info mb-1">Efectivo Esperado (USD)</p>
                            <p className="text-xl font-bold text-foreground">
                              ${Number(summary.cash_flow.expected_usd).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Apertura: ${Number(summary.cash_flow.opening_usd).toFixed(2)} + Ventas:{' '}
                              ${Number(summary.cash_flow.sales_usd).toFixed(2)} + Movimientos:{' '}
                              ${Number(summary.cash_flow.movements_usd).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}

              {/* Información de cierre */}
              {session.closed_at && session.counted && session.expected && (
                <div>
                  <h3 className="text-base font-semibold text-foreground mb-3">Información de Cierre</h3>
                  <Card className="bg-muted/50 border-border">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Esperado</p>
                          <p className="text-base font-semibold text-foreground">
                            {Number(session.expected.cash_bs).toFixed(2)} Bs / $
                            {Number(session.expected.cash_usd).toFixed(2)} USD
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Contado</p>
                          <p className="text-base font-semibold text-foreground">
                            {Number(session.counted.cash_bs).toFixed(2)} Bs / $
                            {Number(session.counted.cash_usd).toFixed(2)} USD
                          </p>
                        </div>
                      </div>

                      {/* Diferencias */}
                      {(() => {
                        const diffBs =
                          Number(session.counted.cash_bs) - Number(session.expected.cash_bs)
                        const diffUsd =
                          Number(session.counted.cash_usd) - Number(session.expected.cash_usd)
                        const hasDifference = Math.abs(diffBs) > 0.01 || Math.abs(diffUsd) > 0.01
                        const hasLargeDifference = Math.abs(diffBs) > 10 || Math.abs(diffUsd) > 10

                        return hasDifference ? (
                          <Alert className={cn(
                            'border-t mt-4',
                            hasLargeDifference ? 'bg-destructive/10 border-destructive/50' : 'bg-warning/10 border-warning/50'
                          )}>
                            <AlertDescription>
                              <p className={cn('text-sm font-medium mb-2', hasLargeDifference ? 'text-destructive' : 'text-warning')}>
                                Diferencias
                              </p>
                              <p className={cn(
                                'text-lg font-bold',
                                hasLargeDifference ? 'text-destructive' : 'text-warning'
                              )}>
                                {diffBs >= 0 ? '+' : ''}
                                {diffBs.toFixed(2)} Bs / {diffUsd >= 0 ? '+' : ''}
                                {diffUsd.toFixed(2)} USD
                              </p>
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <Alert className="border-t mt-4 bg-success/10 border-success/50">
                            <CheckCircle2 className="w-4 h-4 text-success" />
                            <AlertDescription>
                              <p className="text-sm font-medium text-success mb-1">
                                Cuadre Perfecto
                              </p>
                              <p className="text-xs text-success/80">No hay diferencias</p>
                            </AlertDescription>
                          </Alert>
                        )
                      })()}
                    </CardContent>
                  </Card>

                  {session.note && (
                    <Alert className="mt-4 bg-warning/10 border-warning/50">
                      <AlertDescription>
                        <p className="text-sm font-medium text-warning mb-1">Nota</p>
                        <p className="text-sm text-foreground">{session.note}</p>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>
          )}
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
