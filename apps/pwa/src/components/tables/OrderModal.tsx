import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  X,
  Plus,
  Trash2,
  Pause,
  Play,
  DollarSign,
  XCircle,
  CheckCircle,
  Coffee,
} from 'lucide-react'
import { ordersService, Order, AddOrderItemRequest, CreatePartialPaymentRequest } from '@/services/orders.service'
import { CreateSaleRequest } from '@/services/sales.service'
import toast from 'react-hot-toast'
import OrderItemModal from './OrderItemModal'
import PartialPaymentModal from './PartialPaymentModal'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

  const { data: orderData, refetch: refetchOrder } = useQuery({
    queryKey: ['order', order?.id],
    queryFn: () => order && ordersService.getOrderById(order.id),
    enabled: isOpen && !!order,
    staleTime: 1000 * 30, // 30 segundos
  })

  const currentOrder = orderData || order

  const calculateOrderTotal = (order: Order) => {
    let totalBs = 0
    let totalUsd = 0

    // Verificar que items exista y sea un array
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

    // Restar pagos parciales (verificar que payments exista y sea un array)
    if (order.payments && Array.isArray(order.payments)) {
      order.payments.forEach((payment) => {
        totalBs -= Number(payment.amount_bs)
        totalUsd -= Number(payment.amount_usd)
      })
    }

    return { bs: Math.max(0, totalBs), usd: Math.max(0, totalUsd) }
  }

  const totals = currentOrder ? calculateOrderTotal(currentOrder) : { bs: 0, usd: 0 }

  const addItemMutation = useMutation({
    mutationFn: (data: AddOrderItemRequest) => {
      if (!currentOrder) throw new Error('No hay orden seleccionada')
      return ordersService.addOrderItem(currentOrder.id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', currentOrder?.id] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'open'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Item agregado correctamente')
      setIsItemModalOpen(false)
      refetchOrder()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al agregar el item')
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

  const handleAddItem = (data: AddOrderItemRequest) => {
    addItemMutation.mutate(data)
  }

  const handleRemoveItem = (itemId: string) => {
    removeItemMutation.mutate(itemId)
  }

  const handlePause = () => {
    pauseMutation.mutate()
  }

  const handleResume = () => {
    resumeMutation.mutate()
  }


  const handlePartialPayment = (data: CreatePartialPaymentRequest) => {
    partialPaymentMutation.mutate(data)
  }

  const handleCancel = () => {
    cancelMutation.mutate()
  }

  const handleCloseOrder = (saleData: CreateSaleRequest) => {
    if (!currentOrder) return

    ordersService
      .closeOrder(currentOrder.id, saleData)
      .then(() => {
        // Invalidar todas las queries relacionadas
        queryClient.invalidateQueries({ queryKey: ['order', currentOrder.id] })
        queryClient.invalidateQueries({ queryKey: ['orders', 'open'] })
        queryClient.invalidateQueries({ queryKey: ['tables'] })
        queryClient.invalidateQueries({ queryKey: ['sales'] })
        queryClient.invalidateQueries({ queryKey: ['inventory', 'status'] })
        queryClient.invalidateQueries({ queryKey: ['inventory', 'stock-status'] })
        toast.success('Orden cerrada y venta generada correctamente')
        onOrderUpdated?.()
        onClose()
      })
      .catch((error: any) => {
        toast.error(error.response?.data?.message || 'Error al cerrar la orden')
      })
  }

  if (!isOpen || !currentOrder) return null

  const canClose = currentOrder.status === 'open' && currentOrder.items.length > 0
  const canPause = currentOrder.status === 'open'
  const canResume = currentOrder.status === 'paused'

  // Convertir items de orden a items de carrito para CheckoutModal
  const cartItems = currentOrder.items.map((item) => ({
    id: item.id,
    product_id: item.product_id,
    variant_id: item.variant_id,
    qty: item.qty,
    discount_bs: Number(item.discount_bs || 0),
    discount_usd: Number(item.discount_usd || 0),
    product_name: item.product?.name || 'Producto',
    unit_price_bs: Number(item.unit_price_bs),
    unit_price_usd: Number(item.unit_price_usd),
  }))

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg sm:text-xl flex items-center">
                  <Coffee className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
                  Orden {currentOrder.order_number}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant={
                      currentOrder.status === 'open'
                        ? 'default'
                        : currentOrder.status === 'paused'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {currentOrder.status === 'open'
                      ? 'Abierta'
                      : currentOrder.status === 'paused'
                        ? 'Pausada'
                        : currentOrder.status === 'closed'
                          ? 'Cerrada'
                          : 'Cancelada'}
                  </Badge>
                  {currentOrder.table && (
                    <Badge variant="outline">
                      Mesa {currentOrder.table.table_number}
                    </Badge>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
            <div className="space-y-4">
              {/* Información de la orden */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Abierta:</p>
                  <p className="font-medium text-foreground">
                    {format(new Date(currentOrder.opened_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                {currentOrder.paused_at && (
                  <div>
                    <p className="text-muted-foreground">Pausada:</p>
                    <p className="font-medium text-foreground">
                      {format(new Date(currentOrder.paused_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                )}
              </div>

              {/* Items de la orden */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">Items ({currentOrder.items.length})</h3>
                  {canPause && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsItemModalOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar Item
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-64 border border-border rounded-lg">
                  <div className="p-2">
                    {currentOrder.items.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No hay items en la orden
                      </div>
                    ) : (
                      currentOrder.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between p-3 border-b border-border last:border-0"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground">
                              {item.product?.name || 'Producto'}
                            </p>
                            {item.variant && (
                              <p className="text-xs text-muted-foreground">
                                {item.variant.variant_type}: {item.variant.variant_value}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>
                                {item.qty} x ${Number(item.unit_price_usd).toFixed(2)} = $
                                {(Number(item.unit_price_usd) * item.qty).toFixed(2)}
                              </span>
                              {(Number(item.discount_bs) > 0 || Number(item.discount_usd) > 0) && (
                                <Badge variant="secondary" className="text-xs">
                                  Descuento
                                </Badge>
                              )}
                            </div>
                            {item.note && (
                              <p className="text-xs text-muted-foreground italic mt-1">
                                Nota: {item.note}
                              </p>
                            )}
                          </div>
                          {canPause && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Pagos parciales */}
              {currentOrder.payments.length > 0 && (
                <div>
                  <h3 className="font-semibold text-foreground mb-3">
                    Pagos Parciales ({currentOrder.payments.length})
                  </h3>
                  <ScrollArea className="h-32 border border-border rounded-lg">
                    <div className="p-2">
                      {currentOrder.payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between p-2 border-b border-border last:border-0"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              ${Number(payment.amount_usd).toFixed(2)} /{' '}
                              {Number(payment.amount_bs).toFixed(2)} Bs
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(payment.paid_at), 'dd/MM/yyyy HH:mm')}
                            </p>
                          </div>
                          <Badge variant="outline">{payment.payment_method}</Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Totales */}
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Total Pendiente:</span>
                      <div className="text-right">
                        <p className="font-bold text-lg text-primary">
                          ${totals.usd.toFixed(2)} USD
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {totals.bs.toFixed(2)} Bs
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Acciones */}
              {canPause && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={handlePause}
                    disabled={pauseMutation.isPending}
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    Pausar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsPaymentModalOpen(true)}
                  >
                    <DollarSign className="w-4 h-4 mr-1" />
                    Pago Parcial
                  </Button>
                  {canClose && (
                    <Button
                      variant="outline"
                      onClick={() => setIsCloseModalOpen(true)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Cerrar Orden
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setIsCancelDialogOpen(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Cancelar
                  </Button>
                </div>
              )}

              {canResume && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={handleResume}
                    disabled={resumeMutation.isPending}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Reanudar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsCancelDialogOpen(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de agregar item */}
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
        onConfirm={handlePartialPayment}
        isLoading={partialPaymentMutation.isPending}
      />

      {/* Modal de cerrar orden (CheckoutModal) */}
      {isCloseModalOpen && (
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
      )}

      {/* Dialog de cancelar */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar orden?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción cancelará la orden {currentOrder.order_number}. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

