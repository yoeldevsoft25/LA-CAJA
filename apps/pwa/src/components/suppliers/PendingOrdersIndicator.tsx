import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { purchaseOrdersService, PurchaseOrder } from '@/services/purchase-orders.service'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Truck,
  Clock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { cn } from '@/lib/utils'

interface PendingOrdersIndicatorProps {
  className?: string
  variant?: 'badge' | 'card' | 'compact'
}

export default function PendingOrdersIndicator({
  className,
  variant = 'badge',
}: PendingOrdersIndicatorProps) {
  // Obtener órdenes enviadas y confirmadas (pendientes de recibir)
  const { data: sentOrders = [] } = useQuery({
    queryKey: ['purchase-orders', 'sent'],
    queryFn: () => purchaseOrdersService.getAll('sent'),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  const { data: confirmedOrders = [] } = useQuery({
    queryKey: ['purchase-orders', 'confirmed'],
    queryFn: () => purchaseOrdersService.getAll('confirmed'),
    staleTime: 1000 * 60 * 5,
  })

  const { data: partialOrders = [] } = useQuery({
    queryKey: ['purchase-orders', 'partial'],
    queryFn: () => purchaseOrdersService.getAll('partial'),
    staleTime: 1000 * 60 * 5,
  })

  // Combinar órdenes pendientes
  const pendingOrders = [...sentOrders, ...confirmedOrders, ...partialOrders].sort(
    (a, b) => {
      // Ordenar por fecha de entrega esperada
      if (!a.expected_delivery_date) return 1
      if (!b.expected_delivery_date) return -1
      return new Date(a.expected_delivery_date).getTime() - new Date(b.expected_delivery_date).getTime()
    }
  )

  const totalPending = pendingOrders.length

  const getOrderStatus = (order: PurchaseOrder) => {
    if (order.status === 'partial') {
      return { label: 'Recepción parcial', color: 'warning', icon: AlertCircle }
    }
    if (order.status === 'confirmed') {
      return { label: 'Confirmada', color: 'success', icon: CheckCircle2 }
    }
    return { label: 'Enviada', color: 'secondary', icon: Clock }
  }

  const getDeliveryStatus = (order: PurchaseOrder) => {
    if (!order.expected_delivery_date) return null
    const daysUntil = differenceInDays(new Date(order.expected_delivery_date), new Date())
    
    if (daysUntil < 0) {
      return { label: 'Atrasada', color: 'destructive', days: daysUntil }
    }
    if (daysUntil === 0) {
      return { label: 'Hoy', color: 'warning', days: daysUntil }
    }
    if (daysUntil <= 3) {
      return { label: `${daysUntil} días`, color: 'warning', days: daysUntil }
    }
    return { label: `${daysUntil} días`, color: 'secondary', days: daysUntil }
  }

  // Si no hay órdenes pendientes, no mostrar nada (solo en badge)
  if (totalPending === 0 && variant === 'badge') {
    return null
  }

  // Variante badge simple
  if (variant === 'badge') {
    return (
      <Link
        to="/app/purchase-orders"
        className={cn(
          'flex items-center gap-2',
          className
        )}
      >
        <Badge
          variant="secondary"
          className="bg-primary/10 text-primary hover:bg-primary/15"
        >
          <Truck className="w-3 h-3 mr-1" />
          {totalPending} pendiente{totalPending !== 1 ? 's' : ''}
        </Badge>
      </Link>
    )
  }

  // Variante compacta
  if (variant === 'compact') {
    return (
      <Link
        to="/app/purchase-orders"
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/15 transition-colors',
          className
        )}
      >
        <Truck className="w-4 h-4" />
        <span className="font-medium">{totalPending}</span>
        <span className="text-xs">
          {totalPending === 1 ? 'orden pendiente' : 'órdenes pendientes'}
        </span>
      </Link>
    )
  }

  // Variante card para dashboard
  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" />
            Órdenes de Compra Pendientes
          </span>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {totalPending}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {totalPending === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
            <p>No hay órdenes pendientes</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {pendingOrders.slice(0, 5).map((order) => {
                  const status = getOrderStatus(order)
                  const delivery = getDeliveryStatus(order)
                  const StatusIcon = status.icon
                  
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-2 bg-card border border-border/60 rounded-md"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          #{order.order_number}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {order.supplier?.name || 'Sin proveedor'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {delivery && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              delivery.color === 'destructive' && 'border-destructive/40 text-destructive',
                              delivery.color === 'warning' && 'border-orange-500/40 text-orange-600 dark:text-orange-400'
                            )}
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            {delivery.label}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            status.color === 'success' && 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
                            status.color === 'warning' && 'border-orange-500/40 text-orange-600 dark:text-orange-400'
                          )}
                        >
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
            {totalPending > 5 && (
              <Link
                to="/app/purchase-orders"
                className="flex items-center justify-center gap-1 mt-2 text-xs text-primary hover:underline"
              >
                Ver todas ({totalPending})
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
