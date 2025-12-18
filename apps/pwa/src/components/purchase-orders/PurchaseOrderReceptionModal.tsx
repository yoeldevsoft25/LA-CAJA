import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  purchaseOrdersService,
  PurchaseOrder,
  ReceivePurchaseOrderDto,
} from '@/services/purchase-orders.service'
import toast from 'react-hot-toast'

interface PurchaseOrderReceptionModalProps {
  isOpen: boolean
  onClose: () => void
  order: PurchaseOrder
  onSuccess?: () => void
}

export default function PurchaseOrderReceptionModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: PurchaseOrderReceptionModalProps) {
  const queryClient = useQueryClient()
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({})
  const [note, setNote] = useState<string>('')

  // Inicializar cantidades recibidas cuando se abre el modal
  useEffect(() => {
    if (isOpen && order) {
      const quantities: Record<string, number> = {}
      order.items.forEach((item) => {
        // Prellenar con cantidad pendiente (quantity - quantity_received)
        const pending = item.quantity - item.quantity_received
        quantities[item.id] = pending > 0 ? pending : 0
      })
      setReceivedQuantities(quantities)
      setNote('')
    }
  }, [isOpen, order])

  const receiveMutation = useMutation({
    mutationFn: (data: ReceivePurchaseOrderDto) =>
      purchaseOrdersService.receive(order.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Orden recibida exitosamente')
      onClose()
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al recibir la orden')
    },
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Validar cantidades
    for (const item of order.items) {
      const received = receivedQuantities[item.id] || 0
      const alreadyReceived = item.quantity_received
      const pending = item.quantity - alreadyReceived

      if (received < 0) {
        toast.error(
          `La cantidad recibida de ${item.product?.name || 'producto'} no puede ser negativa`
        )
        return
      }

      if (received > pending) {
        toast.error(
          `La cantidad recibida de ${item.product?.name || 'producto'} no puede ser mayor a la pendiente (${pending})`
        )
        return
      }
    }

    const data: ReceivePurchaseOrderDto = {
      items: order.items.map((item) => ({
        quantity_received: receivedQuantities[item.id] || 0,
      })),
      note: note || undefined,
    }

    receiveMutation.mutate(data)
  }

  const updateReceivedQuantity = (itemId: string, quantity: number) => {
    setReceivedQuantities((prev) => ({
      ...prev,
      [itemId]: quantity,
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recibir Orden de Compra {order.order_number}</DialogTitle>
          <DialogDescription>
            Indica las cantidades recibidas de cada producto
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            {order.items.map((item) => {
              const pending = item.quantity - item.quantity_received
              const received = receivedQuantities[item.id] || 0

              return (
                <Card key={item.id} className="border border-border">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div>
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

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Cantidad Solicitada
                          </Label>
                          <p className="text-lg font-bold">{item.quantity}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Ya Recibido
                          </Label>
                          <p className="text-lg font-bold text-blue-600">
                            {item.quantity_received}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Pendiente
                          </Label>
                          <p className="text-lg font-bold text-orange-600">{pending}</p>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor={`received_${item.id}`}>
                          Cantidad a Recibir *
                        </Label>
                        <Input
                          id={`received_${item.id}`}
                          type="number"
                          min="0"
                          max={pending}
                          value={received}
                          onChange={(e) =>
                            updateReceivedQuantity(
                              item.id,
                              parseInt(e.target.value) || 0
                            )
                          }
                          required
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Máximo: {pending} unidades
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div>
            <Label htmlFor="reception_note">Notas de Recepción</Label>
            <Textarea
              id="reception_note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Notas adicionales sobre la recepción..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={receiveMutation.isPending}>
              {receiveMutation.isPending ? 'Recibiendo...' : 'Confirmar Recepción'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

