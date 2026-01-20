import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, UtensilsCrossed, CheckCircle2, ChefHat, Play, Loader2 } from 'lucide-react'
import { kitchenService } from '@/services/kitchen.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders'
import OrderProgressBar, { type OrderProgressData } from '@/components/public/OrderProgressBar'
import toast from 'react-hot-toast'

export default function KitchenDisplayPage() {
  // Escuchar actualizaciones en tiempo real
  useRealtimeOrders()
  const queryClient = useQueryClient()

  const { data: orders, isLoading } = useQuery({
    queryKey: ['kitchen-orders'],
    queryFn: () => kitchenService.getKitchenOrders(),
    staleTime: 1000 * 5, // 5 segundos
    refetchInterval: 1000 * 5, // Refrescar cada 5 segundos
  })

  // Mutación para actualizar estado de item
  const updateItemStatusMutation = useMutation({
    mutationFn: ({
      orderId,
      itemId,
      status,
    }: {
      orderId: string
      itemId: string
      status: 'pending' | 'preparing' | 'ready'
    }) => kitchenService.updateOrderItemStatus(orderId, itemId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] })
      toast.success('Estado actualizado')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar el estado')
    },
  })

  const handleStatusChange = (
    orderId: string,
    itemId: string,
    currentStatus: 'pending' | 'preparing' | 'ready',
    direction: 'next' | 'prev'
  ) => {
    let newStatus: 'pending' | 'preparing' | 'ready'

    if (direction === 'next') {
      if (currentStatus === 'pending') newStatus = 'preparing'
      else if (currentStatus === 'preparing') newStatus = 'ready'
      else newStatus = 'ready'
    } else {
      if (currentStatus === 'ready') newStatus = 'preparing'
      else if (currentStatus === 'preparing') newStatus = 'pending'
      else newStatus = 'pending'
    }

    if (newStatus !== currentStatus) {
      updateItemStatusMutation.mutate({ orderId, itemId, status: newStatus })
    }
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const getTimeColor = (minutes: number) => {
    if (minutes < 15) return 'text-green-600'
    if (minutes < 30) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Cocina - Órdenes Activas</h1>
        <p className="text-muted-foreground">
          {orders?.length || 0} orden(es) en preparación
        </p>
      </div>

      {orders && orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg text-muted-foreground">No hay órdenes activas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders?.map((order) => (
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

                {/* Barra de progreso de la orden */}
                {(() => {
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
                  return <OrderProgressBar progress={progress} compact={true} />
                })()}
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
                          {/* Indicador de estado */}
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

                        {/* Botones de control de estado */}
                        <div className="flex flex-col gap-1 shrink-0">
                          {item.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-xs"
                              onClick={() =>
                                handleStatusChange(order.id, item.id, item.status, 'next')
                              }
                              disabled={updateItemStatusMutation.isPending}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Iniciar
                            </Button>
                          )}
                          {item.status === 'preparing' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-xs bg-yellow-100 hover:bg-yellow-200"
                                onClick={() =>
                                  handleStatusChange(order.id, item.id, item.status, 'next')
                                }
                                disabled={updateItemStatusMutation.isPending}
                              >
                                {updateItemStatusMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Listo
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() =>
                                  handleStatusChange(order.id, item.id, item.status, 'prev')
                                }
                                disabled={updateItemStatusMutation.isPending}
                              >
                                <Clock className="w-3 h-3 mr-1" />
                                Atrás
                              </Button>
                            </>
                          )}
                          {item.status === 'ready' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs"
                              onClick={() =>
                                handleStatusChange(order.id, item.id, item.status, 'prev')
                              }
                              disabled={updateItemStatusMutation.isPending}
                            >
                              <Clock className="w-3 h-3 mr-1" />
                              Preparar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
