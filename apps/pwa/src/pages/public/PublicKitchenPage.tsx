import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock, UtensilsCrossed, ChefHat, CheckCircle2 } from 'lucide-react'
import { publicKitchenService, type KitchenOrder } from '@/services/public-kitchen.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <div className="mb-6 sm:mb-8 md:mb-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight">
                Cocina en Vivo
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground font-medium mt-1">
                Visualización de órdenes en preparación
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

          <div className="mt-6 bg-white p-4 sm:p-5 rounded-3xl border border-border/50 shadow-sm max-w-lg">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Protección por PIN</Label>
            <div className="flex gap-2 mt-2">
              <Input
                type="password"
                inputMode="numeric"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value)}
                className="h-12 text-base border-muted/40 bg-slate-50/50 focus:bg-white shadow-sm font-mono tracking-widest"
                placeholder="Ingresa PIN si aplica"
              />
              <Button
                variant="default"
                className="h-12 px-6 bg-primary font-bold shadow-lg shadow-primary/20 shrink-0"
                onClick={() => {
                  setPinApplied(true)
                  refetch()
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64 rounded-[2rem]" />
            ))}
          </div>
        ) : isError ? (
          <div className="bg-white/40 backdrop-blur-md border-2 border-dashed border-destructive/20 rounded-[2.5rem] py-16 px-6 text-center shadow-lg">
            <div className="bg-destructive/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <UtensilsCrossed className="w-10 h-10 text-destructive" />
            </div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Acceso Denegado</h3>
            <p className="text-muted-foreground mt-2 max-w-xs mx-auto font-medium">
              {errorMessage || 'No se pudieron cargar las órdenes. Verifica el token o el PIN de acceso.'}
            </p>
          </div>
        ) : !hasOrders ? (
          <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] border-2 border-dashed border-border/60 py-24 text-center shadow-xl">
            <div className="bg-white/60 w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
              <UtensilsCrossed className="w-14 h-14 text-muted-foreground/30" />
            </div>
            <h3 className="text-2xl font-black text-foreground tracking-tight">Cocina Despejada</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto font-medium text-lg">
              No hay órdenes pendientes en este momento. ¡Todo listo por aquí!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {orders?.map((order) => {
              const orderIsUrgent = order.elapsed_time > 20
              const orderIsCritical = order.elapsed_time > 35
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
                      <OrderProgressBar progress={progress} compact={true} />
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 flex-1">
                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            'p-3.5 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden',
                            item.status === 'ready' && 'bg-green-50 border-green-200/50 opacity-60 grayscale-[0.3]',
                            item.status === 'preparing' && 'bg-amber-50 border-amber-200 shadow-sm ring-1 ring-amber-100',
                            item.status === 'pending' && 'bg-white border-slate-100 shadow-sm'
                          )}
                        >
                          {item.status === 'preparing' && (
                            <div className="absolute top-0 right-0 h-1 w-full bg-amber-400 animate-pulse" />
                          )}

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
                              <div className="flex items-center gap-1.5 mt-3">
                                {item.status === 'pending' && (
                                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider py-0 px-2 h-5 bg-slate-100 border-slate-200">
                                    Pendiente
                                  </Badge>
                                )}
                                {item.status === 'preparing' && (
                                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider py-0 px-2 h-5 bg-amber-100 border-amber-200 text-amber-700">
                                    Cocinando
                                  </Badge>
                                )}
                                {item.status === 'ready' && (
                                  <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider py-0 px-2 h-5 bg-green-100 border-green-200 text-green-700 shadow-sm">
                                    LISTO
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-white shadow-sm border border-border/40">
                              {item.status === 'pending' && <Clock className="w-5 h-5 text-slate-400" />}
                              {item.status === 'preparing' && <ChefHat className="w-5 h-5 text-amber-500 animate-bounce" />}
                              {item.status === 'ready' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
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
