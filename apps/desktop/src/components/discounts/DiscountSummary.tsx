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
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center mb-2">
                <Percent className="w-4 h-4 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-900">Total Descuentos Bs</span>
              </div>
              <p className="text-lg font-bold text-blue-900">
                {Number(summary.total_discounts_bs).toFixed(2)} Bs
              </p>
            </CardContent>
          </Card>

          {/* Total descuentos USD */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center mb-2">
                <Percent className="w-4 h-4 text-green-600 mr-2" />
                <span className="text-sm font-medium text-green-900">Total Descuentos USD</span>
              </div>
              <p className="text-lg font-bold text-green-900">
                ${Number(summary.total_discounts_usd).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          {/* Promedio porcentaje */}
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center mb-2">
                <TrendingUp className="w-4 h-4 text-purple-600 mr-2" />
                <span className="text-sm font-medium text-purple-900">Promedio %</span>
              </div>
              <p className="text-lg font-bold text-purple-900">
                {Number(summary.average_percentage).toFixed(2)}%
              </p>
            </CardContent>
          </Card>

          {/* Total autorizaciones */}
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center mb-2">
                <Users className="w-4 h-4 text-orange-600 mr-2" />
                <span className="text-sm font-medium text-orange-900">Total Autorizaciones</span>
              </div>
              <p className="text-lg font-bold text-orange-900">{summary.total_authorizations}</p>
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
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
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

