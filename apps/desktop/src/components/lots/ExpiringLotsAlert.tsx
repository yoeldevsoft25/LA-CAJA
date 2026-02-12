import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { productLotsService, ProductLot } from '@/services/product-lots.service'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertTriangle,
  Package,
  ArrowRight,
  X,
  Clock,
} from 'lucide-react'
import { useState } from 'react'
import { differenceInDays, isPast } from 'date-fns'
import { cn } from '@/lib/utils'

interface ExpiringLotsAlertProps {
  className?: string
  daysThreshold?: number
  showDismiss?: boolean
  variant?: 'alert' | 'card' | 'compact'
}

export default function ExpiringLotsAlert({
  className,
  daysThreshold = 30,
  showDismiss = true,
  variant = 'alert',
}: ExpiringLotsAlertProps) {
  const [isDismissed, setIsDismissed] = useState(false)

  // Obtener lotes próximos a vencer
  const { data: expiringLots = [], isLoading } = useQuery({
    queryKey: ['product-lots', 'expiring', daysThreshold],
    queryFn: () => productLotsService.getLotsExpiringSoon(daysThreshold),
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchInterval: 1000 * 60 * 10, // 10 minutos
  })

  // Obtener lotes vencidos
  const { data: expiredLots = [] } = useQuery({
    queryKey: ['product-lots', 'expired'],
    queryFn: () => productLotsService.getExpiredLots(),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 10,
  })

  // Combinar y ordenar por fecha de vencimiento
  const allAlertLots = [...expiredLots, ...expiringLots].sort((a, b) => {
    const dateA = new Date(a.expiration_date || 0)
    const dateB = new Date(b.expiration_date || 0)
    return dateA.getTime() - dateB.getTime()
  })

  // Si no hay lotes o está descartado, no mostrar
  if (isDismissed || isLoading || allAlertLots.length === 0) {
    return null
  }

  const getLotStatus = (lot: ProductLot) => {
    if (!lot.expiration_date) return null
    const expirationDate = new Date(lot.expiration_date)
    const daysUntil = differenceInDays(expirationDate, new Date())
    
    if (isPast(expirationDate)) {
      return { label: 'Vencido', color: 'destructive', days: daysUntil }
    }
    if (daysUntil <= 7) {
      return { label: `${daysUntil} días`, color: 'destructive', days: daysUntil }
    }
    if (daysUntil <= 15) {
      return { label: `${daysUntil} días`, color: 'warning', days: daysUntil }
    }
    return { label: `${daysUntil} días`, color: 'secondary', days: daysUntil }
  }

  // Variante compacta para sidebar o header
  if (variant === 'compact') {
    return (
      <Link
        to="/app/lots"
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-card border border-orange-500/30 text-foreground hover:bg-muted/30 transition-colors',
          className
        )}
      >
        <AlertTriangle className="w-4 h-4" />
        <span className="font-medium">{allAlertLots.length}</span>
        <span className="text-xs">
          {allAlertLots.length === 1 ? 'lote por vencer' : 'lotes por vencer'}
        </span>
      </Link>
    )
  }

  // Variante Card para dashboard
  if (variant === 'card') {
    return (
      <Card className={cn('border-orange-500/30 bg-card', className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <AlertTriangle className="w-4 h-4" />
              Productos por Vencer
            </CardTitle>
            {showDismiss && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsDismissed(true)}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-[150px]">
            <div className="space-y-2">
              {allAlertLots.slice(0, 5).map((lot) => {
                const status = getLotStatus(lot)
                return (
                  <div
                    key={lot.id}
                    className="flex items-center justify-between p-2 bg-card border border-border/60 rounded-md"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {lot.product?.name || 'Producto'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Lote: {lot.lot_number} • {lot.remaining_quantity} uds
                      </p>
                    </div>
                    {status && (
                      <Badge
                        variant={status.color as any}
                        className={cn(
                          'text-xs flex-shrink-0',
                          status.color === 'warning' && 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
                          status.color === 'destructive' && 'bg-destructive/10 text-destructive'
                        )}
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
          {allAlertLots.length > 5 && (
            <Link
              to="/app/lots"
              className="flex items-center justify-center gap-1 mt-2 text-xs text-primary hover:underline"
            >
              Ver todos ({allAlertLots.length})
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </CardContent>
      </Card>
    )
  }

  // Variante Alert (por defecto)
  return (
    <Alert
      variant="destructive"
      className={cn(
        'border-orange-500/30 bg-card',
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-foreground flex items-center justify-between">
        <span>
          {expiredLots.length > 0
            ? `¡Atención! ${expiredLots.length} lote(s) vencido(s)`
            : `${expiringLots.length} lote(s) próximos a vencer`}
        </span>
        {showDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mr-2"
            onClick={() => setIsDismissed(true)}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </AlertTitle>
      <AlertDescription className="text-foreground/90">
        <div className="mt-2 space-y-1">
          {allAlertLots.slice(0, 3).map((lot) => {
            const status = getLotStatus(lot)
            return (
              <div key={lot.id} className="flex items-center gap-2 text-sm">
                <Package className="w-3 h-3" />
                <span className="font-medium">{lot.product?.name || 'Producto'}</span>
                <span className="text-muted-foreground">
                  (Lote {lot.lot_number})
                </span>
                {status && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      status.days < 0 && 'border-destructive/40 text-destructive',
                      status.days >= 0 && status.days <= 7 && 'border-orange-500/40 text-orange-600 dark:text-orange-400'
                    )}
                  >
                    {status.label}
                  </Badge>
                )}
              </div>
            )
          })}
          {allAlertLots.length > 3 && (
            <p className="text-xs mt-2">
              Y {allAlertLots.length - 3} más...
            </p>
          )}
        </div>
        <Link
          to="/app/lots"
          className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-primary hover:underline"
        >
          Ver todos los lotes
          <ArrowRight className="w-4 h-4" />
        </Link>
      </AlertDescription>
    </Alert>
  )
}
