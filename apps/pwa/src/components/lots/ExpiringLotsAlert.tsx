import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { productLotsService } from '@/services/product-lots.service'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { differenceInDays } from 'date-fns'

interface ExpiringLotsAlertProps {
  days?: number
}

export default function ExpiringLotsAlert({
  days = 30,
}: ExpiringLotsAlertProps) {
  const { data: expiringLots, isLoading } = useQuery({
    queryKey: ['product-lots', 'expiring', days],
    queryFn: () => productLotsService.getLotsExpiringSoon(days),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  const { data: expiredLots } = useQuery({
    queryKey: ['product-lots', 'expired'],
    queryFn: () => productLotsService.getExpiredLots(),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  if (isLoading) {
    return null
  }

  const expiredCount = expiredLots?.length || 0
  const expiringCount = expiringLots?.filter((lot) => {
    if (!lot.expiration_date) return false
    const expirationDate = new Date(lot.expiration_date)
    const today = new Date()
    return differenceInDays(expirationDate, today) > 0
  }).length || 0

  if (expiredCount === 0 && expiringCount === 0) {
    return null
  }

  return (
    <Alert
      variant={expiredCount > 0 ? 'destructive' : 'default'}
      className="border-warning/50 bg-warning/5"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>Alertas de Vencimiento</span>
        <Link to="/lots">
          <Button variant="ghost" size="sm" className="h-7">
            Ver Todos
          </Button>
        </Link>
      </AlertTitle>
      <AlertDescription>
        {expiredCount > 0 && (
          <div className="mb-2">
            <strong className="text-destructive">{expiredCount}</strong> lote
            {expiredCount !== 1 ? 's' : ''} vencido{expiredCount !== 1 ? 's' : ''}
          </div>
        )}
        {expiringCount > 0 && (
          <div>
            <strong>{expiringCount}</strong> lote{expiringCount !== 1 ? 's' : ''} próximo
            {expiringCount !== 1 ? 's' : ''} a vencer en los próximos {days} días
          </div>
        )}
      </AlertDescription>
    </Alert>
  )
}

