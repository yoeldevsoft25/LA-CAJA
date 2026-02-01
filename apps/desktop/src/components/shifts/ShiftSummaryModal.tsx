import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { shiftsService, ShiftSummary } from '@/services/shifts.service'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ShiftSummaryModalProps {
  isOpen: boolean
  onClose: () => void
  shiftId: string
}

export default function ShiftSummaryModal({
  isOpen,
  onClose,
  shiftId,
}: ShiftSummaryModalProps) {
  const { data: summary, isLoading } = useQuery<ShiftSummary>({
    queryKey: ['shifts', 'summary', shiftId],
    queryFn: () => shiftsService.getShiftSummary(shiftId),
    enabled: isOpen && !!shiftId,
  })

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Resumen del Turno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!summary) {
    return null
  }

  const { shift, sales_count, cuts_count, summary: shiftSummary } = summary
  const expected = shiftSummary.expected
  const counted = shiftSummary.counted
  const difference = shiftSummary.difference

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            Resumen del Turno
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          <div className="space-y-4 sm:space-y-6">
            {/* Información básica */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Información del Turno</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Apertura</p>
                    <p className="text-sm font-medium text-foreground">
                      {format(new Date(shift.opened_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  {shift.closed_at && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Cierre</p>
                      <p className="text-sm font-medium text-foreground">
                        {format(new Date(shift.closed_at), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Estado</p>
                    <Badge variant={shift.status === 'open' ? 'default' : 'secondary'}>
                      {shift.status === 'open' ? 'Abierto' : 'Cerrado'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Ventas</p>
                    <p className="text-sm font-medium text-foreground">{sales_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Cortes</p>
                    <p className="text-sm font-medium text-foreground">{cuts_count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Montos de apertura */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Montos de Apertura</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Apertura en Bs</p>
                    <p className="text-lg font-bold text-foreground">
                      {Number(shift.opening_amount_bs).toFixed(2)} Bs
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Apertura en USD</p>
                    <p className="text-lg font-bold text-foreground">
                      ${Number(shift.opening_amount_usd).toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Totales esperados */}
            {expected && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Totales Esperados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Efectivo Bs</p>
                      <p className="text-lg font-bold text-foreground">
                        {Number(expected.cash_bs).toFixed(2)} Bs
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Efectivo USD</p>
                      <p className="text-lg font-bold text-foreground">
                        ${Number(expected.cash_usd).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm font-medium text-foreground mb-3">Por Método de Pago</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-1">Pago Móvil:</span>
                        <Badge variant="secondary" className="w-fit">
                          {Number(expected.pago_movil_bs || 0).toFixed(2)} Bs
                        </Badge>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-1">Transferencia:</span>
                        <Badge variant="secondary" className="w-fit">
                          {Number(expected.transfer_bs || 0).toFixed(2)} Bs
                        </Badge>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-1">Otros:</span>
                        <Badge variant="secondary" className="w-fit">
                          {Number(expected.other_bs || 0).toFixed(2)} Bs
                        </Badge>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-1">Total Bs:</span>
                        <Badge variant="secondary" className="w-fit">
                          {Number(expected.total_bs || 0).toFixed(2)} Bs
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Totales contados */}
            {counted && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Totales Contados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Efectivo Bs</p>
                      <p className="text-lg font-bold text-foreground">
                        {Number(counted.cash_bs).toFixed(2)} Bs
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Efectivo USD</p>
                      <p className="text-lg font-bold text-foreground">
                        ${Number(counted.cash_usd).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Diferencias */}
            {difference.bs !== null && difference.usd !== null && (
              <Card
                className={cn(
                  'border',
                  Math.abs(Number(difference.bs)) > 10 || Math.abs(Number(difference.usd)) > 10
                    ? 'bg-destructive/10 border-destructive/50'
                    : 'bg-warning/10 border-warning/50'
                )}
              >
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Diferencias de Arqueo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Diferencia en Bs</p>
                      <p
                        className={cn(
                          'text-xl font-bold',
                          Math.abs(Number(difference.bs)) > 10 ? 'text-destructive' : 'text-warning'
                        )}
                      >
                        {Number(difference.bs) >= 0 ? '+' : ''}
                        {Number(difference.bs).toFixed(2)} Bs
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Diferencia en USD</p>
                      <p
                        className={cn(
                          'text-xl font-bold',
                          Math.abs(Number(difference.usd)) > 10 ? 'text-destructive' : 'text-warning'
                        )}
                      >
                        {Number(difference.usd) >= 0 ? '+' : ''}
                        {Number(difference.usd).toFixed(2)} USD
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Nota */}
            {shift.note && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Nota</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground">{shift.note}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

