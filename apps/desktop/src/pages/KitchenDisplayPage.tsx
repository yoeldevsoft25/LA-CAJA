import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Clock, UtensilsCrossed, CheckCircle2, ChefHat, Link as LinkIcon, RefreshCcw, Play, Loader2 } from 'lucide-react'
import { kitchenService } from '@/services/kitchen.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders'
import OrderProgressBar, { type OrderProgressData } from '@/components/public/OrderProgressBar'
import toast from '@/lib/toast'

export default function KitchenDisplayPage() {
  // Escuchar actualizaciones en tiempo real
  useRealtimeOrders()
  const queryClient = useQueryClient()
  const [publicPin, setPublicPin] = useState('')
  const [hasPublicPin, setHasPublicPin] = useState(false)

  const { data: orders, isLoading } = useQuery({
    queryKey: ['kitchen-orders'],
    queryFn: () => kitchenService.getKitchenOrders(),
    staleTime: 1000 * 5, // 5 segundos
    refetchInterval: 1000 * 5, // Refrescar cada 5 segundos
  })

  const publicLinkMutation = useMutation({
    mutationFn: () => kitchenService.getPublicKitchenLink(),
    onSuccess: async (data) => {
      setHasPublicPin(data.has_pin)
      try {
        await navigator.clipboard.writeText(data.url)
        toast.success('Enlace público copiado')
      } catch {
        toast.success('Enlace público generado')
      }
    },
    onError: () => {
      toast.error('No se pudo obtener el enlace público')
    },
  })

  const rotateLinkMutation = useMutation({
    mutationFn: () => kitchenService.rotatePublicKitchenLink(),
    onSuccess: async (data) => {
      setHasPublicPin(data.has_pin)
      try {
        await navigator.clipboard.writeText(data.url)
        toast.success('Enlace regenerado y copiado')
      } catch {
        toast.success('Enlace regenerado')
      }
    },
    onError: () => {
      toast.error('No se pudo regenerar el enlace')
    },
  })

  const setPinMutation = useMutation({
    mutationFn: () => kitchenService.setPublicKitchenPin(publicPin.trim() || undefined),
    onSuccess: (data) => {
      setHasPublicPin(data.has_pin)
      setPublicPin('')
      toast.success(data.has_pin ? 'PIN actualizado' : 'PIN eliminado')
    },
    onError: () => {
      toast.error('No se pudo actualizar el PIN')
    },
  })

  const clearPinMutation = useMutation({
    mutationFn: () => kitchenService.setPublicKitchenPin(undefined),
    onSuccess: (data) => {
      setHasPublicPin(data.has_pin)
      setPublicPin('')
      toast.success('PIN eliminado')
    },
    onError: () => {
      toast.error('No se pudo eliminar el PIN')
    },
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
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <div className="mb-6 sm:mb-8 md:mb-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight">
                Cocina
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground font-medium mt-1">
                {orders?.length || 0} órdenes activas actualmente
              </p>
            </div>
            <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20 self-start sm:self-auto">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-widest">En Vivo</span>
            </div>
          </div>

          <div className="mt-6 sm:mt-8 space-y-6 bg-white p-4 sm:p-6 rounded-3xl border border-border/50 shadow-sm">
            <div>
              <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Acceso Externo (KDS)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <Button
                  variant="outline"
                  onClick={() => publicLinkMutation.mutate()}
                  disabled={publicLinkMutation.isPending}
                  className="h-12 border-muted/40 hover:bg-slate-50 font-bold transition-all shadow-sm"
                >
                  <LinkIcon className="w-4 h-4 mr-2 text-primary" />
                  Copiar Enlace
                </Button>
                <Button
                  variant="outline"
                  onClick={() => rotateLinkMutation.mutate()}
                  disabled={rotateLinkMutation.isPending}
                  className="h-12 border-muted/40 hover:bg-slate-50 font-bold transition-all shadow-sm"
                >
                  <RefreshCcw className="w-4 h-4 mr-2 text-primary" />
                  Regenerar Enlace
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t border-dashed border-border/60">
              <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Seguridad (PIN Opcional)</Label>
              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <div className="relative flex-1">
                  <Input
                    type="password"
                    inputMode="numeric"
                    value={publicPin}
                    onChange={(e) => setPublicPin(e.target.value)}
                    className="h-12 text-base border-muted/40 bg-slate-50/50 focus:bg-white shadow-sm font-mono tracking-widest"
                    placeholder={hasPublicPin ? '••••••••' : 'Configurar PIN'}
                  />
                  {hasPublicPin && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 text-[10px] font-bold">ACTIVO</Badge>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    onClick={() => setPinMutation.mutate()}
                    disabled={setPinMutation.isPending}
                    className="h-12 flex-1 sm:px-6 bg-primary font-bold shadow-lg shadow-primary/20"
                  >
                    Guardar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => clearPinMutation.mutate()}
                    disabled={clearPinMutation.isPending || !hasPublicPin}
                    className="h-12 px-4 text-destructive hover:text-destructive hover:bg-destructive/10 font-bold"
                  >
                    Quitar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {orders && orders.length === 0 ? (
          <div className="bg-card rounded-3xl border-2 border-dashed border-border/60 py-20 text-center shadow-xl">
            <div className="bg-card border border-border/50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <UtensilsCrossed className="w-12 h-12 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Cocina Despejada</h3>
            <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
              No hay órdenes pendientes en este momento. ¡Buen trabajo!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {orders?.map((order) => {
              const orderIsUrgent = order.elapsed_time > 20
              const orderIsCritical = order.elapsed_time > 35

              return (
                <Card
                  key={order.id}
                  className={cn(
                    'transition-all duration-300 border-none shadow-md hover:shadow-xl rounded-[2rem] overflow-hidden flex flex-col h-full',
                    orderIsUrgent ? 'bg-amber-50 ring-2 ring-amber-400 shadow-amber-100' :
                      orderIsCritical ? 'bg-red-50 ring-2 ring-red-500 shadow-red-100' : 'bg-white'
                  )}
                >
                  <CardHeader className="pb-4 px-5 pt-5 bg-transparent">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">Mesa</span>
                        </div>
                        <CardTitle className="text-2xl font-black text-foreground">
                          {order.table_number}
                        </CardTitle>
                        {order.table_name && (
                          <p className="text-xs font-bold text-muted-foreground truncate uppercase tracking-tighter mt-0.5">
                            {order.table_name}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="font-black text-xs px-2 py-1 bg-white border-muted/40 shadow-sm rounded-lg">
                          #{order.order_number}
                        </Badge>
                        <div className="flex items-center justify-end gap-1.5 mt-2.5">
                          <Clock
                            className={cn('w-4 h-4', getTimeColor(order.elapsed_time))}
                          />
                          <span className={cn('text-sm font-black tabular-nums', getTimeColor(order.elapsed_time))}>
                            {formatTime(order.elapsed_time)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
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
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 flex-1">
                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            'p-3.5 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden group',
                            item.status === 'ready' && 'bg-green-50 border-green-200/50 opacity-60 grayscale-[0.3]',
                            item.status === 'preparing' && 'bg-amber-50 border-amber-200 shadow-sm ring-1 ring-amber-100',
                            item.status === 'pending' && 'bg-white border-slate-100 shadow-sm'
                          )}
                        >
                          {item.status === 'preparing' && (
                            <div className="absolute top-0 right-0 h-1 w-full bg-amber-400 animate-pulse" />
                          )}

                          <div className="flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                  <span className="font-black text-lg text-foreground">x{item.qty}</span>
                                  <span className="font-bold text-base text-foreground leading-tight">{item.product_name}</span>
                                </div>
                                {item.note && (
                                  <div className="mt-2 p-2 bg-slate-50 border border-slate-100 rounded-lg">
                                    <p className="text-[11px] text-muted-foreground font-bold italic leading-tight uppercase tracking-tight">
                                      {item.note}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-white shadow-sm border border-border/40">
                                {item.status === 'pending' && <Clock className="w-5 h-5 text-slate-400" />}
                                {item.status === 'preparing' && <ChefHat className="w-5 h-5 text-amber-500 animate-bounce" />}
                                {item.status === 'ready' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                              </div>
                            </div>

                            {/* Botones de acción mejorados para móvil */}
                            <div className="flex gap-2">
                              {item.status === 'pending' && (
                                <Button
                                  size="lg"
                                  variant="default"
                                  className="h-11 flex-1 bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest shadow-md active:scale-95 transition-all"
                                  onClick={() =>
                                    handleStatusChange(order.id, item.id, item.status, 'next')
                                  }
                                  disabled={updateItemStatusMutation.isPending}
                                >
                                  <Play className="w-4 h-4 mr-2" />
                                  Iniciar
                                </Button>
                              )}
                              {item.status === 'preparing' && (
                                <>
                                  <Button
                                    size="lg"
                                    variant="default"
                                    className="h-11 flex-[2] bg-green-500 hover:bg-green-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-green-100 active:scale-95 transition-all"
                                    onClick={() =>
                                      handleStatusChange(order.id, item.id, item.status, 'next')
                                    }
                                    disabled={updateItemStatusMutation.isPending}
                                  >
                                    {updateItemStatusMutation.isPending ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Terminar
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="lg"
                                    variant="outline"
                                    className="h-11 flex-1 border-muted/30 font-bold text-xs uppercase text-muted-foreground active:scale-95 transition-all bg-white"
                                    onClick={() =>
                                      handleStatusChange(order.id, item.id, item.status, 'prev')
                                    }
                                    disabled={updateItemStatusMutation.isPending}
                                  >
                                    <RefreshCcw className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              {item.status === 'ready' && (
                                <Button
                                  size="lg"
                                  variant="outline"
                                  className="h-11 flex-1 border-green-200 text-green-600 font-bold text-xs uppercase tracking-widest hover:bg-green-100/50 active:scale-95 transition-all bg-white"
                                  onClick={() =>
                                    handleStatusChange(order.id, item.id, item.status, 'prev')
                                  }
                                  disabled={updateItemStatusMutation.isPending}
                                >
                                  <UtensilsCrossed className="w-4 h-4 mr-2" />
                                  Recocinar
                                </Button>
                              )}
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
    </div>
  )
}
