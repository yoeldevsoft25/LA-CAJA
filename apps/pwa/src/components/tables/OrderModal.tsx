import { useState, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Plus,
  Minus,
  Trash2,
  Pause,
  Play,
  DollarSign,
  XCircle,
  CheckCircle,
  Coffee,
  Users,
  Clock,
  ReceiptText,
  AlertCircle
} from 'lucide-react'
import { ordersService, Order, AddOrderItemRequest, CreatePartialPaymentRequest } from '@/services/orders.service'
import { CreateSaleRequest } from '@/services/sales.service'
import { inventoryService } from '@/services/inventory.service'
import { useOnline } from '@/hooks/use-online'
import toast from '@/lib/toast'
import OrderItemModal from './OrderItemModal'
import PartialPaymentModal from './PartialPaymentModal'
import SplitBillModal from './SplitBillModal'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { format } from 'date-fns'
import CheckoutModal from '@/components/pos/CheckoutModal'
import { cn } from '@/lib/utils'

interface OrderModalProps {
  isOpen: boolean
  onClose: () => void
  order: Order | null
  onOrderUpdated?: () => void
}

export default function OrderModal({ isOpen, onClose, order, onOrderUpdated }: OrderModalProps) {
  const queryClient = useQueryClient()
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [isSplitBillModalOpen, setIsSplitBillModalOpen] = useState(false)

  // Optimización: diferir carga en mobile para mejor percepción de rendimiento
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    if (isOpen && order) {
      const delay = window.innerWidth < 640 ? 100 : 0
      const timer = setTimeout(() => setShouldLoad(true), delay)
      return () => clearTimeout(timer)
    } else {
      setShouldLoad(false)
    }
  }, [isOpen, order])

  const { data: orderData, refetch: refetchOrder } = useQuery({
    queryKey: ['order', order?.id],
    queryFn: () => order && ordersService.getOrderById(order.id),
    enabled: shouldLoad && !!order,
    staleTime: 1000 * 30, // 30 segundos
  })

  const currentOrder = orderData || order

  const calculateOrderTotal = (order: Order) => {
    let totalBs = 0
    let totalUsd = 0

    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item) => {
        const itemTotalBs =
          Number(item.unit_price_bs) * item.qty - Number(item.discount_bs || 0)
        const itemTotalUsd =
          Number(item.unit_price_usd) * item.qty - Number(item.discount_usd || 0)
        totalBs += itemTotalBs
        totalUsd += itemTotalUsd
      })
    }

    if (order.payments && Array.isArray(order.payments)) {
      order.payments.forEach((payment) => {
        totalBs -= Number(payment.amount_bs)
        totalUsd -= Number(payment.amount_usd)
      })
    }

    return { bs: Math.max(0, totalBs), usd: Math.max(0, totalUsd) }
  }

  const totals = currentOrder ? calculateOrderTotal(currentOrder) : { bs: 0, usd: 0 }
  const orderItems = currentOrder?.items || []
  const orderPayments = currentOrder?.payments || []

  const addItemMutation = useMutation({
    mutationFn: async (items: AddOrderItemRequest[]) => {
      if (!currentOrder) throw new Error('No hay orden seleccionada')
      for (const item of items) {
        await ordersService.addOrderItem(currentOrder.id, item)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', currentOrder?.id] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'open'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Items agregados correctamente')
      setIsItemModalOpen(false)
      refetchOrder()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al agregar los items')
    },
  })

  const isOnline = useOnline()
  const MAX_QTY_PER_PRODUCT = 999

  const updateItemQuantityMutation = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: string; qty: number }) => {
      if (!currentOrder) throw new Error('No hay orden seleccionada')
      return ordersService.updateOrderItemQuantity(currentOrder.id, itemId, qty)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', currentOrder?.id] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'open'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      refetchOrder()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar la cantidad')
    },
  })

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => {
      if (!currentOrder) throw new Error('No hay orden seleccionada')
      return ordersService.removeOrderItem(currentOrder.id, itemId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', currentOrder?.id] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'open'] })
      toast.success('Item eliminado correctamente')
      refetchOrder()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al eliminar el item')
    },
  })

  const pauseMutation = useMutation({
    mutationFn: () => {
      if (!currentOrder) throw new Error('No hay orden seleccionada')
      return ordersService.pauseOrder(currentOrder.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', currentOrder?.id] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'open'] })
      toast.success('Orden pausada')
      refetchOrder()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al pausar la orden')
    },
  })

  const resumeMutation = useMutation({
    mutationFn: () => {
      if (!currentOrder) throw new Error('No hay orden seleccionada')
      return ordersService.resumeOrder(currentOrder.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', currentOrder?.id] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'open'] })
      toast.success('Orden reanudada')
      refetchOrder()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al reanudar la orden')
    },
  })

  const partialPaymentMutation = useMutation({
    mutationFn: (data: CreatePartialPaymentRequest) => {
      if (!currentOrder) throw new Error('No hay orden seleccionada')
      return ordersService.createPartialPayment(currentOrder.id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', currentOrder?.id] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'open'] })
      toast.success('Pago parcial registrado correctamente')
      setIsPaymentModalOpen(false)
      refetchOrder()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al registrar el pago parcial')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!currentOrder) throw new Error('No hay orden seleccionada')
      return ordersService.cancelOrder(currentOrder.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', currentOrder?.id] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'open'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Orden cancelada')
      onOrderUpdated?.()
      onClose()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al cancelar la orden')
    },
  })

  const handleUpdateQty = async (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(itemId)
      return
    }

    const item = orderItems.find((i) => i.id === itemId)
    if (!item) return

    if (newQty > MAX_QTY_PER_PRODUCT) {
      toast.error(`Cantidad máxima por producto: ${MAX_QTY_PER_PRODUCT}`)
      return
    }

    if (newQty > item.qty && isOnline) {
      try {
        const stockInfo = await inventoryService.getProductStock(item.product_id)
        const availableStock = stockInfo.current_stock

        if (newQty > availableStock) {
          toast.error(
            `Stock insuficiente. Disponible: ${availableStock}`,
            { icon: '⚠️', duration: 3000 }
          )
          return
        }
      } catch (error) {
        console.warn('[OrderModal] No se pudo verificar stock:', error)
      }
    }

    updateItemQuantityMutation.mutate({ itemId, qty: newQty })
  }

  const handleAddItem = (items: AddOrderItemRequest[]) => {
    addItemMutation.mutate(items)
  }

  const handleRemoveItem = (itemId: string) => {
    removeItemMutation.mutate(itemId)
  }

  const handlePause = () => pauseMutation.mutate()
  const handleResume = () => resumeMutation.mutate()
  const handleCancel = () => cancelMutation.mutate()

  const handleCloseOrder = (saleData: CreateSaleRequest) => {
    if (!currentOrder) return

    ordersService
      .closeOrder(currentOrder.id, saleData)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['order', currentOrder.id] })
        queryClient.invalidateQueries({ queryKey: ['orders', 'open'] })
        queryClient.invalidateQueries({ queryKey: ['tables'] })
        queryClient.invalidateQueries({ queryKey: ['sales'] })
        queryClient.invalidateQueries({ queryKey: ['inventory', 'status'] })
        toast.success('Orden cerrada y venta generada correctamente')
        onOrderUpdated?.()
        onClose()
      })
      .catch((error: any) => {
        toast.error(error.response?.data?.message || 'Error al cerrar la orden')
      })
  }

  if (!isOpen || !currentOrder) return null

  const canClose = currentOrder.status === 'open' && orderItems.length > 0
  const canPause = currentOrder.status === 'open'
  const canResume = currentOrder.status === 'paused'

  const cartItems = orderItems.map((item) => ({
    id: item.id,
    product_id: item.product_id,
    product_name: item.product?.name || 'Producto',
    qty: item.qty,
    unit_price_bs: Number(item.unit_price_bs || 0),
    unit_price_usd: Number(item.unit_price_usd || 0),
    discount_bs: Number(item.discount_bs || 0),
    discount_usd: Number(item.discount_usd || 0),
    variant_id: item.variant_id || null,
    variant_name: item.variant ? `${item.variant.variant_type}: ${item.variant.variant_value}` : null,
    is_weight_product: false,
  }))

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl h-[95vh] sm:h-[85vh] flex flex-col p-0 gap-0 overflow-hidden border-none bg-white shadow-2xl">
          {/* Header Glassmorphic */}
          <DialogHeader className="px-6 py-4 flex-shrink-0 bg-white/80 backdrop-blur-xl border-b border-slate-100 relative z-10 pr-14">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                  <ReceiptText className="w-7 h-7" />
                </div>
                <div>
                  <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                    Orden #{currentOrder.order_number}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      className={cn(
                        "font-black text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full border-2",
                        currentOrder.status === 'open' ? "bg-green-100 text-green-700 border-green-200" :
                          currentOrder.status === 'paused' ? "bg-amber-100 text-amber-700 border-amber-200" :
                            "bg-slate-100 text-slate-700 border-slate-200"
                      )}
                    >
                      {currentOrder.status === 'open' ? 'Activa' :
                        currentOrder.status === 'paused' ? 'Pausada' :
                          currentOrder.status.toUpperCase()}
                    </Badge>
                    {currentOrder.table && (
                      <Badge variant="outline" className="bg-white/50 font-black text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full border-slate-200">
                        Mesa {currentOrder.table.table_number}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex flex-col items-end text-right">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Abierta hace {format(new Date(currentOrder.opened_at), 'HH:mm')}</span>
                </div>
                {currentOrder.paused_at && (
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-1">
                    Pausada: {format(new Date(currentOrder.paused_at), 'HH:mm')}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden bg-muted/20">
            {/* Lista de Items - Estilo Recibo Digital */}
            <div className="flex-1 flex flex-col min-h-0 relative px-4 py-4 sm:p-6 lg:p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-4 h-4" /> Resumen del Pedido ({orderItems.length})
                </h3>
                {canPause && (
                  <Button
                    size="sm"
                    onClick={() => setIsItemModalOpen(true)}
                    className="bg-primary/10 hover:bg-primary/20 text-primary font-black text-[10px] uppercase tracking-widest h-8 px-4 rounded-xl border-none transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Agregar
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1 -mx-2 px-2 mask-linear">
                <div className="space-y-3 pb-6">
                  {orderItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/40 rounded-[2rem] border-2 border-dashed border-muted/30">
                      <Coffee className="w-12 h-12 text-muted-foreground/20 mb-3" />
                      <p className="font-bold text-muted-foreground">No hay items registrados</p>
                    </div>
                  ) : (
                    orderItems.map((item) => (
                      <div
                        key={item.id}
                        className="group bg-white rounded-3xl p-4 shadow-sm border border-slate-100 hover:shadow-md hover:border-primary/20 transition-all flex items-center gap-4 relative isolate"
                      >
                        {/* Cantidad Badge */}
                        <div className="h-12 w-12 rounded-2xl bg-muted/40 dark:bg-muted/10 flex items-center justify-center text-xl font-black text-foreground shrink-0 border border-muted/20">
                          {item.qty}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-foreground leading-tight truncate">
                            {item.product?.name || 'Producto'}
                          </h4>
                          {item.variant && (
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">
                              {item.variant.variant_type}: {item.variant.variant_value}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5">
                            <p className="text-xs font-bold text-primary">
                              ${Number(item.unit_price_usd).toFixed(2)} c/u
                            </p>
                            {item.note && (
                              <Badge variant="secondary" className="text-[9px] font-bold py-0 h-4 rounded-md truncate max-w-[120px]">
                                {item.note}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="font-black text-base text-foreground tabular-nums">
                            ${(item.qty * Number(item.unit_price_usd) - Number(item.discount_usd || 0)).toFixed(2)}
                          </p>
                        </div>

                        {/* Quick Actions Overlay (Mobile friendly) */}
                        <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUpdateQty(item.id, item.qty - 1)}
                            className="h-8 w-8 rounded-full bg-slate-100/80 hover:bg-white transition-colors border border-slate-200"
                            disabled={!canPause}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUpdateQty(item.id, item.qty + 1)}
                            className="h-8 w-8 rounded-full bg-slate-100/80 hover:bg-white transition-colors border border-slate-200"
                            disabled={!canPause}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleRemoveItem(item.id)}
                            className="h-8 w-8 rounded-full bg-destructive/10 text-destructive hover:bg-destructive shadow-none border-none transition-colors"
                            disabled={!canPause}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Pagos Parciales (Sutil) */}
              {orderPayments.length > 0 && (
                <div className="mt-4 p-4 rounded-3xl bg-white/40 border border-slate-100">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5" /> Pagos Parciales
                  </p>
                  <div className="space-y-1">
                    {orderPayments.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-600">{p.payment_method}</span>
                        <span className="font-black text-foreground">${Number(p.amount_usd).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar de Pago y Acciones */}
            <div className="w-full sm:w-80 lg:w-96 flex flex-col flex-shrink-0 bg-white border-l border-slate-200 p-6 sm:p-8">
              <div className="flex-1 space-y-8">
                {/* Totales Reales */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Saldo Pendiente</p>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-4xl lg:text-5xl font-black text-primary tracking-tighter tabular-nums">
                          ${totals.usd.toFixed(2)}
                        </span>
                        <Badge className="bg-primary/10 text-primary border-none font-black text-xs px-3 py-1 rounded-lg">USD</Badge>
                      </div>
                      <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-muted/30">
                        <span className="text-2xl font-bold text-slate-500 tabular-nums">
                          {totals.bs.toFixed(2)}
                        </span>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">BOLÍVARES</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botones de Control */}
                <div className="space-y-3 pt-4">
                  {canPause && (
                    <>
                      <Button
                        onClick={() => setIsCloseModalOpen(true)}
                        disabled={!canClose}
                        className="w-full h-16 rounded-[2rem] bg-primary text-primary-foreground font-black text-xl shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-3 border-none group"
                      >
                        <CheckCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
                        Cerrar Orden
                      </Button>

                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          onClick={() => setIsPaymentModalOpen(true)}
                          className="h-14 rounded-2xl border-slate-200 bg-slate-50 font-bold hover:bg-white hover:border-primary/40 transition-all"
                        >
                          <DollarSign className="w-4 h-4 mr-2 text-primary" /> Pagos
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setIsSplitBillModalOpen(true)}
                          disabled={orderItems.length === 0}
                          className="h-14 rounded-2xl border-slate-200 bg-slate-50 font-bold hover:bg-white hover:border-primary/40 transition-all"
                        >
                          <Users className="w-4 h-4 mr-2 text-blue-500" /> Dividir
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="ghost"
                          onClick={handlePause}
                          disabled={pauseMutation.isPending}
                          className="h-12 rounded-2xl font-bold text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                        >
                          <Pause className="w-4 h-4 mr-2" /> Pausar
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setIsCancelDialogOpen(true)}
                          className="h-12 rounded-2xl font-bold text-destructive hover:bg-destructive/10"
                        >
                          <XCircle className="w-4 h-4 mr-2" /> Cancelar
                        </Button>
                      </div>
                    </>
                  )}

                  {canResume && (
                    <div className="flex flex-col gap-3">
                      <Button
                        onClick={handleResume}
                        disabled={resumeMutation.isPending}
                        className="w-full h-16 rounded-[2rem] bg-indigo-600 text-white font-black text-xl shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-3"
                      >
                        <Play className="w-6 h-6" /> Reanudar Orden
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setIsCancelDialogOpen(true)}
                        className="h-12 rounded-2xl font-bold text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="w-4 h-4 mr-2" /> Cancelar Orden
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase tracking-tight">
                  Pasa el mouse sobre los items para editarlos o eliminarlos rápidamente.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Selector inicial de item */}
      <OrderItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        onConfirm={handleAddItem}
        isLoading={addItemMutation.isPending}
      />

      {/* Modal de pago parcial */}
      <PartialPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        orderTotal={totals}
        onConfirm={(data) => partialPaymentMutation.mutate(data)}
        isLoading={partialPaymentMutation.isPending}
      />

      {/* CheckoutModal */}
      <CheckoutModal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        items={cartItems}
        total={totals}
        onConfirm={(data) => {
          const saleData: CreateSaleRequest = {
            items: cartItems.map((item) => ({
              product_id: item.product_id,
              variant_id: item.variant_id || null,
              qty: item.qty,
              discount_bs: item.discount_bs,
              discount_usd: item.discount_usd,
            })),
            exchange_rate: data.exchange_rate,
            currency: data.currency,
            payment_method: data.payment_method,
            cash_payment: data.cash_payment,
            cash_payment_bs: data.cash_payment_bs,
            customer_id: data.customer_id,
            customer_name: data.customer_name,
            customer_document_id: data.customer_document_id,
            customer_phone: data.customer_phone,
            customer_note: data.customer_note,
          }
          handleCloseOrder(saleData)
          setIsCloseModalOpen(false)
        }}
        isLoading={false}
      />

      {/* Dividir cuenta */}
      {isSplitBillModalOpen && currentOrder && (
        <SplitBillModal
          isOpen={isSplitBillModalOpen}
          onClose={() => setIsSplitBillModalOpen(false)}
          order={currentOrder}
          onSplit={async (splits) => {
            try {
              for (const split of splits) {
                await ordersService.createPartialPayment(currentOrder.id, {
                  amount_bs: split.amount_bs,
                  amount_usd: split.amount_usd,
                  payment_method: 'SPLIT',
                  note: split.diner_name ? `División: ${split.diner_name}` : 'División de cuenta',
                })
              }
              toast.success('Cuenta dividida correctamente')
              queryClient.invalidateQueries({ queryKey: ['order', currentOrder.id] })
              queryClient.invalidateQueries({ queryKey: ['orders', 'open'] })
              onOrderUpdated?.()
            } catch (error: any) {
              toast.error(error.response?.data?.message || 'Error al dividir la cuenta')
            }
          }}
        />
      )}

      {/* Cancelación */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black">¿Anular esta orden?</AlertDialogTitle>
            <AlertDialogDescription className="font-medium">
              Esta acción cancelará la orden #{currentOrder.order_number}. Se liberará la mesa y los items no serán cobrados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-2xl border-none bg-slate-100 hover:bg-slate-200 font-bold">Mantener Orden</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-black"
            >
              Sí, Anular Orden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
