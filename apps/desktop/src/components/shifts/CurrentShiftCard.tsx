import { Clock, DollarSign, FileX, CheckCircle2, Calendar, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { Shift, ShiftSummary } from '@/services/shifts.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface CurrentShiftCardProps {
  shift: Shift | null
  shiftSummary: ShiftSummary | null
  isLoading: boolean
  onCloseShift: () => void
  onCreateCutX: () => void
  onCreateCutZ: () => void
}

export default function CurrentShiftCard({
  shift,
  shiftSummary,
  isLoading,
  onCloseShift,
  onCreateCutX,
  onCreateCutZ,
}: CurrentShiftCardProps) {
  if (isLoading) {
    return (
      <Card className="border border-border">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!shift) {
    return null
  }

  const isOpen = shift.status === 'open'
  const expectedTotals = shiftSummary?.summary.expected

  return (
    <Card className="border border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg sm:text-xl font-semibold flex items-center">
          {isOpen ? (
            <>
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 mr-2" />
              Turno Abierto
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground mr-2" />
              Turno Cerrado
            </>
          )}
        </CardTitle>
        <div className="flex gap-2">
          {isOpen && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onCreateCutX}
                className="w-full sm:w-auto"
              >
                <FileX className="w-4 h-4 mr-2" />
                Corte X
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onCloseShift}
                className="w-full sm:w-auto"
              >
                Cerrar Turno
              </Button>
            </>
          )}
          {!isOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateCutZ}
              className="w-full sm:w-auto"
            >
              <FileX className="w-4 h-4 mr-2" />
              Corte Z
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Alert de estado */}
          {isOpen && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-900">Turno Activo</AlertTitle>
              <AlertDescription className="text-green-700">
                El turno está abierto desde el {format(new Date(shift.opened_at), 'dd/MM/yyyy HH:mm')}
              </AlertDescription>
            </Alert>
          )}

          {!isOpen && shift.closed_at && (
            <Alert className="bg-muted border-border">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <AlertTitle>Turno Cerrado</AlertTitle>
              <AlertDescription>
                Cerrado el {format(new Date(shift.closed_at), 'dd/MM/yyyy HH:mm')}
              </AlertDescription>
            </Alert>
          )}

          {/* Información básica */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center mb-2">
                  <Calendar className="w-4 h-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-900">Apertura</span>
                </div>
                <p className="text-sm text-blue-700">
                  {format(new Date(shift.opened_at), 'dd/MM/yyyy HH:mm')}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center mb-2">
                  <DollarSign className="w-4 h-4 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-green-900">Apertura Bs</span>
                </div>
                <p className="text-lg font-bold text-green-900">
                  {Number(shift.opening_amount_bs).toFixed(2)} Bs
                </p>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center mb-2">
                  <DollarSign className="w-4 h-4 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-green-900">Apertura USD</span>
                </div>
                <p className="text-lg font-bold text-green-900">
                  ${Number(shift.opening_amount_usd).toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center mb-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 mr-2" />
                  <span className="text-sm font-medium text-purple-900">Ventas</span>
                </div>
                <p className="text-lg font-bold text-purple-900">
                  {shiftSummary?.sales_count || 0}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Resumen de efectivo esperado */}
          {expectedTotals && (
            <Card className="bg-muted/50 border-border">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Resumen de Efectivo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Efectivo Esperado (Bs)</p>
                    <p className="text-xl font-bold text-foreground">
                      {Number(expectedTotals.cash_bs).toFixed(2)} Bs
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Efectivo Esperado (USD)</p>
                    <p className="text-xl font-bold text-foreground">
                      ${Number(expectedTotals.cash_usd).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Totales por método de pago */}
                <div className="pt-4 border-t border-border">
                  <p className="text-sm font-medium text-foreground mb-3">Ventas por Método de Pago</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground mb-1">Efectivo Bs:</span>
                      <Badge variant="secondary" className="w-fit">
                        {Number(expectedTotals.cash_bs || 0).toFixed(2)} Bs
                      </Badge>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground mb-1">Efectivo USD:</span>
                      <Badge variant="secondary" className="w-fit">
                        ${Number(expectedTotals.cash_usd || 0).toFixed(2)}
                      </Badge>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground mb-1">Pago Móvil:</span>
                      <Badge variant="secondary" className="w-fit">
                        {Number(expectedTotals.pago_movil_bs || 0).toFixed(2)} Bs
                      </Badge>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground mb-1">Transferencia:</span>
                      <Badge variant="secondary" className="w-fit">
                        {Number(expectedTotals.transfer_bs || 0).toFixed(2)} Bs
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Diferencias si el turno está cerrado */}
          {!isOpen && shift.difference_bs !== null && shift.difference_usd !== null && (
            <Card
              className={cn(
                'border',
                Math.abs(Number(shift.difference_bs)) > 10 ||
                  Math.abs(Number(shift.difference_usd)) > 10
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
                    <p className="text-sm text-muted-foreground mb-1">Diferencia en Bs</p>
                    <p
                      className={cn(
                        'text-xl font-bold',
                        Math.abs(Number(shift.difference_bs)) > 10
                          ? 'text-destructive'
                          : 'text-warning'
                      )}
                    >
                      {Number(shift.difference_bs) >= 0 ? '+' : ''}
                      {Number(shift.difference_bs).toFixed(2)} Bs
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Diferencia en USD</p>
                    <p
                      className={cn(
                        'text-xl font-bold',
                        Math.abs(Number(shift.difference_usd)) > 10
                          ? 'text-destructive'
                          : 'text-warning'
                      )}
                    >
                      {Number(shift.difference_usd) >= 0 ? '+' : ''}
                      {Number(shift.difference_usd).toFixed(2)} USD
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

