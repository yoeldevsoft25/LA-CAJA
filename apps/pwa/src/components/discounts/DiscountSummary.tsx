import { useQuery } from '@tanstack/react-query'
import { Percent, TrendingUp, Users } from 'lucide-react'
import { discountsService } from '@/services/discounts.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface DiscountSummaryProps {
  startDate?: string
  endDate?: string
}

export default function DiscountSummary({ startDate, endDate }: DiscountSummaryProps) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['discounts', 'summary', startDate, endDate],
    queryFn: () =>
      discountsService.getDiscountSummary({
        start_date: startDate,
        end_date: endDate,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          Resumen de Descuentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total descuentos Bs */}
          <Card className="bg-blue-500/10 border-blue-500/20 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center mb-2">
                <Percent className="w-4 h-4 text-blue-500 dark:text-blue-400 mr-2" />
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Descuentos Bs</span>
              </div>
              <p className="text-lg font-bold text-foreground">
                {Number(summary.total_discounts_bs).toFixed(2)} Bs
              </p>
            </CardContent>
          </Card>

          {/* Total descuentos USD */}
          <Card className="bg-emerald-500/10 border-emerald-500/20 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center mb-2">
                <Percent className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mr-2" />
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Total Descuentos USD</span>
              </div>
              <p className="text-lg font-bold text-foreground">
                ${Number(summary.total_discounts_usd).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          {/* Promedio porcentaje */}
          <Card className="bg-purple-500/10 border-purple-500/20 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center mb-2">
                <TrendingUp className="w-4 h-4 text-purple-500 dark:text-purple-400 mr-2" />
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Promedio %</span>
              </div>
              <p className="text-lg font-bold text-foreground">
                {Number(summary.average_percentage).toFixed(2)}%
              </p>
            </CardContent>
          </Card>

          {/* Total autorizaciones */}
          <Card className="bg-orange-500/10 border-orange-500/20 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center mb-2">
                <Users className="w-4 h-4 text-orange-500 dark:text-orange-400 mr-2" />
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Total Autorizaciones</span>
              </div>
              <p className="text-lg font-bold text-foreground">{summary.total_authorizations}</p>
            </CardContent>
          </Card>
        </div>

        {/* Por autorizador */}
        {summary.by_authorizer && summary.by_authorizer.length > 0 && (
          <div className="border-t border-border pt-4">
            <h3 className="text-base font-semibold text-foreground mb-3">Por Autorizador</h3>
            <div className="space-y-2">
              {summary.by_authorizer.map((auth) => (
                <div
                  key={auth.authorizer_id}
                  className="flex items-center justify-between p-3 bg-card border border-border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{auth.authorizer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {auth.count} autorización{auth.count !== 1 ? 'es' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {Number(auth.total_bs).toFixed(2)} Bs
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${Number(auth.total_usd).toFixed(2)} USD
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

