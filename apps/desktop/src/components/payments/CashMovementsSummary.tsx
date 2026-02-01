import { useQuery } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, TrendingUp } from 'lucide-react'
import { paymentsService } from '@/services/payments.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface CashMovementsSummaryProps {
  shiftId?: string | null
  cashSessionId?: string | null
}

export default function CashMovementsSummary({
  shiftId,
  cashSessionId,
}: CashMovementsSummaryProps) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['payments', 'movements', 'summary', shiftId, cashSessionId],
    queryFn: () =>
      paymentsService.getCashMovementsSummary({
        shift_id: shiftId || undefined,
        cash_session_id: cashSessionId || undefined,
      }),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!summary) {
    return null
  }

  const netBs = Number(summary.net_bs)
  const netUsd = Number(summary.net_usd)
  const isPositive = netBs >= 0 && netUsd >= 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          Resumen de Movimientos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Entradas */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center mb-2">
                <ArrowDownCircle className="w-4 h-4 text-green-600 mr-2" />
                <span className="text-sm font-medium text-green-900">Entradas</span>
              </div>
              <p className="text-lg font-bold text-green-900">
                {Number(summary.entries_bs).toFixed(2)} Bs
              </p>
              <p className="text-sm text-green-700">
                ${Number(summary.entries_usd).toFixed(2)} USD
              </p>
            </CardContent>
          </Card>

          {/* Salidas */}
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center mb-2">
                <ArrowUpCircle className="w-4 h-4 text-red-600 mr-2" />
                <span className="text-sm font-medium text-red-900">Salidas</span>
              </div>
              <p className="text-lg font-bold text-red-900">
                {Number(summary.exits_bs).toFixed(2)} Bs
              </p>
              <p className="text-sm text-red-700">
                ${Number(summary.exits_usd).toFixed(2)} USD
              </p>
            </CardContent>
          </Card>

          {/* Neto */}
          <Card
            className={cn(
              'border-2',
              isPositive ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center mb-2">
                <TrendingUp
                  className={cn('w-4 h-4 mr-2', isPositive ? 'text-blue-600' : 'text-orange-600')}
                />
                <span
                  className={cn(
                    'text-sm font-medium',
                    isPositive ? 'text-blue-900' : 'text-orange-900'
                  )}
                >
                  Neto
                </span>
              </div>
              <p
                className={cn(
                  'text-lg font-bold',
                  isPositive ? 'text-blue-900' : 'text-orange-900'
                )}
              >
                {netBs >= 0 ? '+' : ''}
                {netBs.toFixed(2)} Bs
              </p>
              <p
                className={cn(
                  'text-sm',
                  isPositive ? 'text-blue-700' : 'text-orange-700'
                )}
              >
                {netUsd >= 0 ? '+' : ''}
                ${netUsd.toFixed(2)} USD
              </p>
            </CardContent>
          </Card>

          {/* Total de movimientos */}
          <Card className="bg-muted/50 border-border">
            <CardContent className="p-4">
              <div className="flex items-center mb-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground mr-2" />
                <span className="text-sm font-medium text-foreground">Total Movimientos</span>
              </div>
              <p className="text-lg font-bold text-foreground">{summary.total_movements}</p>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}
