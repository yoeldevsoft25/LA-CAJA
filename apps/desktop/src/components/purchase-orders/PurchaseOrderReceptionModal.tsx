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
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import toast from '@/lib/toast'

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
        // Prellenar con 0 para permitir recepción parcial explícita
        // El usuario puede ingresar la cantidad que desea recibir
        quantities[item.id] = 0
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

      // Validar que la cantidad recibida en esta recepción sea válida
      if (received < 0) {
        toast.error(
          `La cantidad recibida de ${item.product?.name || 'producto'} no puede ser negativa`
        )
        return
      }
    }

    // Calcular el total acumulado (cantidad ya recibida + cantidad en esta recepción)
    const data: ReceivePurchaseOrderDto = {
      items: order.items.map((item) => {
        const receivedInThisReception = receivedQuantities[item.id] || 0
        const alreadyReceived = item.quantity_received || 0
        const totalReceived = alreadyReceived + receivedInThisReception

        return {
          quantity_received: totalReceived, // Backend espera el total acumulado
        }
      }),
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

  // Handler para escaneo de código de barras
  const handleBarcodeScan = (barcode: string) => {
    // Buscar el item de la orden que corresponde al código de barras escaneado
    const matchingItem = order.items.find((item) => {
      const productBarcode = item.product?.barcode?.toLowerCase()
      const scannedBarcode = barcode.toLowerCase()
      
      return productBarcode === scannedBarcode
    })

    if (!matchingItem) {
      toast.error(`Producto no encontrado en la orden: ${barcode}`, {
        icon: '🔍',
        duration: 3000,
      })
      return
    }

    // Obtener la cantidad pendiente
    const pending = matchingItem.quantity - matchingItem.quantity_received
    
    if (pending <= 0) {
      toast.error(`${matchingItem.product?.name || 'Producto'} ya está completamente recibido`, {
        icon: '⚠️',
        duration: 3000,
      })
      return
    }

    // Incrementar cantidad recibida en 1 (si hay pendiente)
    const currentReceived = receivedQuantities[matchingItem.id] || 0
    const newReceived = Math.min(currentReceived + 1, pending)
    
    updateReceivedQuantity(matchingItem.id, newReceived)
    
    toast.success(`${matchingItem.product?.name || 'Producto'} - Cantidad: ${newReceived}/${pending}`, {
      icon: '✅',
      duration: 2000,
    })
  }

  // Integrar scanner de código de barras (solo cuando el modal está abierto y no hay input activo)
  useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: isOpen && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA',
    minLength: 4,
    maxLength: 50,
    maxIntervalMs: 50,
  })

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl">Recibir Orden de Compra {order.order_number}</DialogTitle>
          <DialogDescription>
            Indica las cantidades recibidas de cada producto. Puedes recibir parcialmente ingresando menos de la cantidad pendiente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-5">
            <div className="space-y-4 sm:space-y-5">
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
                      
                      {/* Mostrar diferencia si existe después de esta recepción */}
                      {received > 0 && (() => {
                        const totalReceivedAfter = item.quantity_received + received;
                        const difference = totalReceivedAfter - item.quantity;
                        
                        if (difference !== 0) {
                          return (
                            <div className="mt-2 p-2 rounded-md bg-amber-50 border border-amber-200">
                              <p className="text-xs font-medium text-amber-800">
                                {difference < 0 ? (
                                  <>⚠️ Se registrará un faltante de {Math.abs(difference)} unidades (solicitadas: {item.quantity}, recibidas: {totalReceivedAfter})</>
                                ) : (
                                  <>⚠️ Se registrará un excedente de {difference} unidades (solicitadas: {item.quantity}, recibidas: {totalReceivedAfter})</>
                                )}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label htmlFor={`received_${item.id}`}>
                            Cantidad a Recibir *
                          </Label>
                          {pending > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => updateReceivedQuantity(item.id, pending)}
                            >
                              Recibir todo ({pending})
                            </Button>
                          )}
                        </div>
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
                          inputMode="numeric"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {received > 0 && received < pending && (
                            <span className="text-orange-600 font-medium">
                              Recepción parcial: {received} de {pending} unidades
                            </span>
                          )}
                          {received === pending && pending > 0 && (
                            <span className="text-green-600 font-medium">
                              Recepción completa
                            </span>
                          )}
                          {received === 0 && (
                            <span>Máximo: {pending} unidades (puedes recibir parcialmente)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

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
            </div>
          </div>
          <DialogFooter className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-border flex-shrink-0">
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

