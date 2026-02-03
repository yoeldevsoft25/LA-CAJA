import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock, UtensilsCrossed, ChefHat, CheckCircle2 } from 'lucide-react'
import { publicKitchenService, type KitchenOrder } from '@/services/public-kitchen.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@la-caja/ui-core'
import { Label } from '@/components/ui/label'
import { Button } from '@la-caja/ui-core'
import { cn } from '@la-caja/ui-core'
import OrderProgressBar, { type OrderProgressData } from '@/components/public/OrderProgressBar'

export default function PublicKitchenPage() {
  const { token } = useParams<{ token: string }>()
  const [pinValue, setPinValue] = useState('')
  const [pinApplied, setPinApplied] = useState(false)

  const { data: orders, isLoading, isError, error, refetch } = useQuery<KitchenOrder[]>({
    queryKey: ['public-kitchen-orders', token, pinApplied ? pinValue : ''],
    queryFn: () => publicKitchenService.getKitchenOrders(token || '', pinApplied ? pinValue : undefined),
    enabled: !!token && (pinApplied || pinValue === ''),
    staleTime: 1000 * 5,
    refetchInterval: (query) => (query.state.data && query.state.data.length > 0) ? 1000 * 5 : false,
  })

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const getTimeColor = (minutes: number) => {
    if (minutes < 15) return 'text-green-600'
    if (minutes < 30) return 'text-yellow-600'
    return 'text-red-600'
  }

  const hasOrders = (orders || []).length > 0

  const errorMessage = error instanceof Error ? error.message : ''

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Cocina - Órdenes Activas</h1>
        <p className="text-muted-foreground">
          {orders?.length || 0} orden(es) en preparación
        </p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2 items-start sm:items-end">
          <div className="w-full sm:max-w-xs">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">PIN (si aplica)</Label>
            <Input
              type="password"
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value)}
              className="mt-1"
              placeholder="Ingresa PIN"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setPinApplied(true)
              refetch()
            }}
          >
            Aplicar PIN
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {errorMessage || 'Error cargando órdenes.'}
          </CardContent>
        </Card>
      ) : !hasOrders ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg text-muted-foreground">No hay órdenes activas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders?.map((order) => {
            const pendingItems = order.items.filter((item) => item.status === 'pending').length
            const preparingItems = order.items.filter((item) => item.status === 'preparing').length
            const readyItems = order.items.filter((item) => item.status === 'ready').length
            const progress: OrderProgressData = {
              totalItems: order.items.length,
              pendingItems,
              preparingItems,
              readyItems,
              orderStatus: 'open',
            }

            return (
              <Card
                key={order.id}
                className={cn(
                  'transition-all hover:shadow-lg',
                  order.elapsed_time > 30 && 'border-red-500 border-2'
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        Mesa {order.table_number}
                      </CardTitle>
                      {order.table_name && (
                        <p className="text-sm text-muted-foreground">
                          {order.table_name}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {order.order_number}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-2 mb-3">
                    <Clock
                      className={cn('w-4 h-4', getTimeColor(order.elapsed_time))}
                    />
                    <span className={cn('text-sm font-medium', getTimeColor(order.elapsed_time))}>
                      {formatTime(order.elapsed_time)}
                    </span>
                  </div>

                  <OrderProgressBar progress={progress} compact={true} />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          'p-3 rounded-lg border-2 transition-all',
                          item.status === 'ready' && 'bg-green-50 border-green-300 shadow-sm',
                          item.status === 'preparing' && 'bg-yellow-50 border-yellow-300 shadow-sm',
                          item.status === 'pending' && 'bg-gray-50 border-gray-200'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">x{item.qty}</span>
                              <span className="font-semibold text-sm">{item.product_name}</span>
                            </div>
                            {item.note && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                Nota: {item.note}
                              </p>
                            )}
                            <div className="flex items-center gap-1 mt-2">
                              {item.status === 'pending' && (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pendiente
                                </Badge>
                              )}
                              {item.status === 'preparing' && (
                                <Badge variant="outline" className="text-xs bg-yellow-100 border-yellow-300">
                                  <ChefHat className="w-3 h-3 mr-1" />
                                  Preparando
                                </Badge>
                              )}
                              {item.status === 'ready' && (
                                <Badge variant="outline" className="text-xs bg-green-100 border-green-300">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Listo
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
