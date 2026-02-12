import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Send, Package, Edit } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  purchaseOrdersService,
  PurchaseOrder,
  PurchaseOrderStatus,
} from '@/services/purchase-orders.service'
import toast from '@/lib/toast'
import PurchaseOrderReceptionModal from './PurchaseOrderReceptionModal'
import PurchaseOrderFormModal from './PurchaseOrderFormModal'

interface PurchaseOrderDetailModalProps {
  isOpen: boolean
  onClose: () => void
  order: PurchaseOrder | null
  onSuccess?: () => void
}

const statusLabels: Record<PurchaseOrderStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  confirmed: 'Confirmada',
  partial: 'Parcial',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

const statusColors: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-primary/10 text-primary',
  confirmed: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  partial: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-destructive/10 text-destructive',
}

function getStatusBadge(status: PurchaseOrderStatus) {
  return (
    <Badge variant="secondary" className={statusColors[status]}>
      {statusLabels[status]}
    </Badge>
  )
}

export default function PurchaseOrderDetailModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: PurchaseOrderDetailModalProps) {
  const queryClient = useQueryClient()
  const [isReceptionOpen, setIsReceptionOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const sendMutation = useMutation({
    mutationFn: (id: string) => purchaseOrdersService.send(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Orden enviada exitosamente')
      onClose()
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al enviar la orden')
    },
  })

  const confirmMutation = useMutation({
    mutationFn: (id: string) => purchaseOrdersService.confirm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Orden confirmada exitosamente')
      onClose()
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al confirmar la orden')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => purchaseOrdersService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Orden cancelada exitosamente')
      onClose()
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al cancelar la orden')
    },
  })

  const handleSend = () => {
    if (!order) return
    if (!confirm('¿Estás seguro de enviar esta orden al proveedor?')) return
    sendMutation.mutate(order.id)
  }

  const handleConfirm = () => {
    if (!order) return
    if (!confirm('¿Estás seguro de confirmar esta orden?')) return
    confirmMutation.mutate(order.id)
  }

  const handleCancel = () => {
    if (!order) return
    if (
      !confirm(
        '¿Estás seguro de cancelar esta orden? Esta acción no se puede deshacer.'
      )
    )
      return
    cancelMutation.mutate(order.id)
  }

  if (!order) return null

  // Bloquear edición si la orden fue recibida (parcial o completa) o completada
  // También bloquear si tiene cualquier cantidad recibida en sus items
  const hasReceivedItems = order.items.some(item => item.quantity_received > 0)
  const canEdit = order.status === 'draft' && !hasReceivedItems
  const canSend = order.status === 'draft'
  const canConfirm = order.status === 'sent'
  const canReceive = order.status === 'confirmed' || order.status === 'partial'
  const canCancel =
    order.status === 'draft' || order.status === 'sent' || order.status === 'confirmed'

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
            <DialogTitle className="text-lg sm:text-xl">Orden de Compra {order.order_number}</DialogTitle>
            <DialogDescription>Detalles de la orden de compra</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
            <div className="space-y-4 sm:space-y-5">
            {/* Información general */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Estado</Label>
                <div className="mt-1">{getStatusBadge(order.status)}</div>
              </div>
              <div>
                <Label>Proveedor</Label>
                <p className="text-sm font-medium mt-1">
                  {order.supplier?.name || 'N/A'}
                </p>
              </div>
              {order.warehouse && (
                <div>
                  <Label>Bodega</Label>
                  <p className="text-sm font-medium mt-1">
                    {order.warehouse.name} ({order.warehouse.code})
                  </p>
                </div>
              )}
              {order.expected_delivery_date && (
                <div>
                  <Label>Fecha Esperada de Entrega</Label>
                  <p className="text-sm font-medium mt-1">
                    {new Date(order.expected_delivery_date).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {/* Fechas y usuarios */}
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <p>
                  Solicitada: {new Date(order.requested_at).toLocaleString()}
                  {order.requester && ` por ${order.requester.full_name}`}
                </p>
                {order.sent_at && (
                  <p>
                    Enviada: {new Date(order.sent_at).toLocaleString()}
                  </p>
                )}
                {order.confirmed_at && (
                  <p>
                    Confirmada: {new Date(order.confirmed_at).toLocaleString()}
                  </p>
                )}
                {order.received_at && (
                  <p>
                    Recibida: {new Date(order.received_at).toLocaleString()}
                    {order.receiver && ` por ${order.receiver.full_name}`}
                  </p>
                )}
              </div>
            </div>

            {/* Items */}
            <div>
              <Label>Items</Label>
              <div className="space-y-2 mt-2">
                {order.items.map((item) => (
                  <Card key={item.id} className="border border-border">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">
                            {item.product?.name || 'Producto'}
                            {item.variant && (
                              <span className="text-muted-foreground ml-2">
                                ({item.variant.variant_type}: {item.variant.variant_value})
                              </span>
                            )}
                          </p>
                          {item.product?.sku && (
                            <p className="text-xs text-muted-foreground">
                              SKU: {item.product.sku}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Cantidad</p>
                            <p className="font-bold">{item.quantity}</p>
                          </div>
                          {item.quantity_received > 0 && (
                            <div>
                              <p className="text-muted-foreground">Recibido</p>
                              <p className="font-bold text-emerald-600 dark:text-emerald-400">
                                {item.quantity_received}
                              </p>
                            </div>
                          )}
                          <div className="text-right">
                            <p className="text-muted-foreground">Costo Unit.</p>
                            <p className="font-bold">
                              Bs. {Number(item.unit_cost_bs).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ${Number(item.unit_cost_usd).toFixed(2)} USD
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-muted-foreground">Total</p>
                            <p className="font-bold">
                              Bs. {Number(item.total_cost_bs).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ${Number(item.total_cost_usd).toFixed(2)} USD
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Totales */}
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-lg">Total:</span>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      Bs. {Number(order.total_amount_bs).toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ${Number(order.total_amount_usd).toFixed(2)} USD
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notas */}
            {order.note && (
              <div>
                <Label>Notas</Label>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {order.note}
                </p>
              </div>
            )}

            </div>
          </div>
          {/* Acciones */}
          <DialogFooter className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-border flex-shrink-0">
            <div className="flex gap-2 w-full">
              {canEdit ? (
                <Button
                  variant="outline"
                  onClick={() => setIsEditOpen(true)}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              ) : hasReceivedItems ? (
                <Button
                  variant="outline"
                  disabled
                  className="flex-1"
                  title="No se puede editar una orden que ya tiene productos recibidos"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar (Bloqueado)
                </Button>
              ) : null}
              {canSend && (
                <Button
                  variant="default"
                  onClick={handleSend}
                  disabled={sendMutation.isPending}
                  className="flex-1"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sendMutation.isPending ? 'Enviando...' : 'Enviar'}
                </Button>
              )}
              {canConfirm && (
                <Button
                  variant="default"
                  onClick={handleConfirm}
                  disabled={confirmMutation.isPending}
                  className="flex-1"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {confirmMutation.isPending ? 'Confirmando...' : 'Confirmar'}
                </Button>
              )}
              {canReceive && (
                <Button
                  variant="default"
                  onClick={() => setIsReceptionOpen(true)}
                  className="flex-1"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Recibir
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={cancelMutation.isPending}
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  {cancelMutation.isPending ? 'Cancelando...' : 'Cancelar'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de recepción */}
      {order && (
        <PurchaseOrderReceptionModal
          isOpen={isReceptionOpen}
          onClose={() => setIsReceptionOpen(false)}
          order={order}
          onSuccess={() => {
            // Invalidar queries para refrescar datos
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
            queryClient.invalidateQueries({ queryKey: ['purchase-orders', order.id] })
            setIsReceptionOpen(false)
            // Cerrar modal padre para que se refresque con los nuevos datos
            onClose()
            onSuccess?.()
          }}
        />
      )}

      {/* Modal de edición */}
      {order && canEdit && (
        <PurchaseOrderFormModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          order={order}
          onSuccess={() => {
            // Invalidar queries para refrescar datos
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
            queryClient.invalidateQueries({ queryKey: ['purchase-orders', order.id] })
            setIsEditOpen(false)
            // Cerrar modal padre para que se refresque con los nuevos datos
            onClose()
            onSuccess?.()
          }}
        />
      )}
    </>
  )
}

