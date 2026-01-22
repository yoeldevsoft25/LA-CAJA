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
} from 'lucide-react'
import { ordersService, Order, AddOrderItemRequest, CreatePartialPaymentRequest } from '@/services/orders.service'
import { CreateSaleRequest } from '@/services/sales.service'
import { inventoryService } from '@/services/inventory.service'
import { useOnline } from '@/hooks/use-online'
import toast from 'react-hot-toast'
import OrderItemModal from './OrderItemModal'
import PartialPaymentModal from './PartialPaymentModal'
import SplitBillModal from './SplitBillModal'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  
  // Validaciones defensivas para evitar errores
  const orderItems = currentOrder?.items || []
  const orderPayments = currentOrder?.payments || []

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

  const handleAddItem = (data: AddOrderItemRequest) => {
    addItemMutation.mutate(data)
  }

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

    // Solo validar si se está aumentando la cantidad y estamos online
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
        // Si falla la verificación, permitir el cambio
        console.warn('[OrderModal] No se pudo verificar stock:', error)
      }
    }

    updateItemQuantityMutation.mutate({ itemId, qty: newQty })
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

  const canClose = currentOrder.status === 'open' && orderItems.length > 0
  const canPause = currentOrder.status === 'open'
  const canResume = currentOrder.status === 'paused'

  // Convertir items de orden a items de carrito para CheckoutModal (formato CartItem)
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
    is_weight_product: false, // Las órdenes no manejan productos por peso por ahora
  }))

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={onClose}
        modal={!isCloseModalOpen}
      >
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
              {/* El botón X se maneja automáticamente por DialogContent, no necesita duplicado */}
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
                  <h3 className="font-semibold text-foreground">Items ({orderItems.length})</h3>
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
                    {orderItems.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No hay items en la orden
                      </div>
                    ) : (
                      currentOrder.items.map((item) => {
                        const lineSubtotalUsd = item.qty * Number(item.unit_price_usd || 0)
                        const lineDiscountUsd = Number(item.discount_usd || 0)
                        const lineTotalUsd = lineSubtotalUsd - lineDiscountUsd

                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "bg-muted/50 rounded-lg p-2.5 sm:p-3 border hover:border-primary/50 transition-all shadow-sm mb-2",
                              "border-border"
                            )}
                          >
                            <div className="flex items-start justify-between mb-2 gap-2 min-w-0">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-xs sm:text-sm text-foreground break-words leading-snug">
                                  {item.product?.name || 'Producto'}
                                </p>
                                {item.variant && (
                                  <p className="text-xs text-muted-foreground">
                                    {item.variant.variant_type}: {item.variant.variant_value}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  ${Number(item.unit_price_usd).toFixed(2)} c/u
                                </p>
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
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRemoveItem(item.id)
                                  }}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 flex-shrink-0"
                                  disabled={removeItemMutation.isPending}
                                  aria-label="Eliminar producto"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              {canPause ? (
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleUpdateQty(item.id, item.qty - 1)
                                    }}
                                    className="h-8 w-8 min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px]"
                                    disabled={updateItemQuantityMutation.isPending || item.qty <= 1}
                                    aria-label="Disminuir cantidad"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <Input
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={MAX_QTY_PER_PRODUCT}
                                    value={item.qty}
                                    onChange={(e) => {
                                      const newQty = parseInt(e.target.value) || 1
                                      if (newQty >= 1 && newQty <= MAX_QTY_PER_PRODUCT) {
                                        handleUpdateQty(item.id, newQty)
                                      }
                                    }}
                                    className="w-16 h-10 sm:h-8 text-center font-semibold text-sm sm:text-base tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    disabled={updateItemQuantityMutation.isPending}
                                    aria-label="Cantidad"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleUpdateQty(item.id, item.qty + 1)
                                    }}
                                    className="h-8 w-8 min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px]"
                                    disabled={updateItemQuantityMutation.isPending}
                                    aria-label="Aumentar cantidad"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-sm font-medium">Cantidad: {item.qty}</span>
                              )}
                              <div className="text-right min-w-[80px] shrink-0">
                                <p className="font-semibold text-sm sm:text-base">
                                  ${lineTotalUsd.toFixed(2)}
                                </p>
                                {(Number(item.discount_bs) > 0 || Number(item.discount_usd) > 0) && (
                                  <Badge variant="secondary" className="text-xs mt-0.5">
                                    Descuento
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Pagos parciales */}
              {orderPayments.length > 0 && (
                <div>
                  <h3 className="font-semibold text-foreground mb-3">
                    Pagos Parciales ({orderPayments.length})
                  </h3>
                  <ScrollArea className="h-32 border border-border rounded-lg">
                    <div className="p-2">
                      {orderPayments.map((payment) => (
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
                  <Button
                    variant="outline"
                    onClick={() => setIsSplitBillModalOpen(true)}
                    disabled={orderItems.length === 0}
                  >
                    <Users className="w-4 h-4 mr-1" />
                    Dividir Cuenta
                  </Button>
                  {canClose && (
                    <Button
                      variant="default"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setIsCloseModalOpen(true)
                      }}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md font-semibold"
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

      {/* Modal de dividir cuenta */}
      {isSplitBillModalOpen && currentOrder && (
        <SplitBillModal
          isOpen={isSplitBillModalOpen}
          onClose={() => setIsSplitBillModalOpen(false)}
          order={currentOrder}
          onSplit={async (splits) => {
            // Crear pagos parciales para cada división
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
