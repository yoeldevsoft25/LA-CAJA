import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sale, salesService, ReturnSaleItemDto } from '@/services/sales.service'
import toast from '@/lib/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertTriangle, Undo2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReturnItemsModalProps {
  isOpen: boolean
  onClose: () => void
  sale: Sale
}

interface ReturnItemState {
  selected: boolean
  qty: number
  maxQty: number
  note: string
}

const formatCurrency = (amount: number, currency: 'BS' | 'USD' = 'BS') => {
  if (currency === 'USD') {
    return `$${Number(amount).toFixed(2)}`
  }
  return `Bs. ${Number(amount).toFixed(2)}`
}

export default function ReturnItemsModal({
  isOpen,
  onClose,
  sale,
}: ReturnItemsModalProps) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [returnItems, setReturnItems] = useState<Record<string, ReturnItemState>>(() => {
    const initial: Record<string, ReturnItemState> = {}
    sale.items.forEach((item) => {
      initial[item.id] = {
        selected: false,
        qty: Number(item.qty),
        maxQty: Number(item.qty),
        note: '',
      }
    })
    return initial
  })

  // Calcular totales de devolución
  const totals = useMemo(() => {
    let totalBs = 0
    let totalUsd = 0
    let itemCount = 0

    Object.entries(returnItems).forEach(([itemId, state]) => {
      if (state.selected && state.qty > 0) {
        const saleItem = sale.items.find((i) => i.id === itemId)
        if (saleItem) {
          // Calcular precio unitario considerando descuentos
          const unitPriceBs = Number(saleItem.unit_price_bs)
          const unitPriceUsd = Number(saleItem.unit_price_usd)
          const discountBs = Number(saleItem.discount_bs) || 0
          const discountUsd = Number(saleItem.discount_usd) || 0
          const originalQty = Number(saleItem.qty)
          
          // Precio unitario después de descuento
          const unitPriceAfterDiscountBs = (unitPriceBs * originalQty - discountBs) / originalQty
          const unitPriceAfterDiscountUsd = (unitPriceUsd * originalQty - discountUsd) / originalQty
          
          totalBs += unitPriceAfterDiscountBs * state.qty
          totalUsd += unitPriceAfterDiscountUsd * state.qty
          itemCount++
        }
      }
    })

    return { totalBs, totalUsd, itemCount }
  }, [returnItems, sale.items])

  const returnMutation = useMutation({
    mutationFn: async () => {
      const items: ReturnSaleItemDto[] = []

      Object.entries(returnItems).forEach(([itemId, state]) => {
        if (state.selected && state.qty > 0) {
          items.push({
            sale_item_id: itemId,
            qty: state.qty,
            note: state.note || undefined,
          })
        }
      })

      if (items.length === 0) {
        throw new Error('Selecciona al menos un item para devolver')
      }

      return salesService.returnItems(sale.id, items, reason || undefined)
    },
    onSuccess: () => {
      toast.success('Devolución procesada correctamente')
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      onClose()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || 'Error al procesar devolución')
    },
  })

  const handleSelectItem = (itemId: string, checked: boolean) => {
    setReturnItems((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], selected: checked },
    }))
  }

  const handleQtyChange = (itemId: string, value: string) => {
    const numValue = parseFloat(value) || 0
    setReturnItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        qty: Math.min(Math.max(0, numValue), prev[itemId].maxQty),
      },
    }))
  }

  const handleSelectAll = () => {
    const allSelected = Object.values(returnItems).every((item) => item.selected)
    setReturnItems((prev) => {
      const updated = { ...prev }
      Object.keys(updated).forEach((id) => {
        updated[id] = { ...updated[id], selected: !allSelected }
      })
      return updated
    })
  }

  const canSubmit = totals.itemCount > 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="w-5 h-5 text-orange-500" />
            Devolución Parcial
          </DialogTitle>
          <DialogDescription>
            Selecciona los productos y cantidades a devolver de la venta #{sale.invoice_full_number || sale.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Header de selección */}
          <div className="flex items-center justify-between mb-3 px-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs"
            >
              {Object.values(returnItems).every((item) => item.selected)
                ? 'Deseleccionar todo'
                : 'Seleccionar todo'}
            </Button>
            <Badge variant="outline">
              {totals.itemCount} item{totals.itemCount !== 1 ? 's' : ''} seleccionado{totals.itemCount !== 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Lista de items */}
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {sale.items.map((item) => {
                const state = returnItems[item.id]
                if (!state) return null

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'border rounded-lg p-3 transition-colors',
                      state.selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={state.selected}
                        onCheckedChange={(checked: boolean) =>
                          handleSelectItem(item.id, checked)
                        }
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm line-clamp-1">
                              {item.product?.name || 'Producto sin nombre'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Precio: {formatCurrency(
                                (Number(item.unit_price_bs) * Number(item.qty) - Number(item.discount_bs || 0)) / Number(item.qty),
                                'BS'
                              )}/u
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            x{Number(item.qty)}
                          </Badge>
                        </div>

                        {state.selected && (
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Cantidad a devolver
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                max={state.maxQty}
                                step={item.is_weight_product ? 0.001 : 1}
                                value={state.qty}
                                onChange={(e) => handleQtyChange(item.id, e.target.value)}
                                className="h-8 mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Subtotal devolución
                              </Label>
                              <p className="h-8 flex items-center text-sm font-semibold text-orange-600">
                                {formatCurrency(
                                  ((Number(item.unit_price_bs) * Number(item.qty) - Number(item.discount_bs || 0)) / Number(item.qty)) * state.qty,
                                  'BS'
                                )}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>

          {/* Razón de devolución */}
          <div className="mt-4">
            <Label htmlFor="return-reason" className="text-sm">
              Razón de devolución (opcional)
            </Label>
            <Textarea
              id="return-reason"
              placeholder="Ej: Producto defectuoso, cliente cambió de opinión..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5 h-20 resize-none"
            />
          </div>

          {/* Resumen */}
          {totals.itemCount > 0 && (
            <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                    Total a devolver
                  </p>
                  <p className="text-lg font-bold text-orange-600">
                    {formatCurrency(totals.totalBs, 'BS')}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({formatCurrency(totals.totalUsd, 'USD')})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    El stock será restaurado automáticamente al inventario.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => returnMutation.mutate()}
            disabled={!canSubmit || returnMutation.isPending}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {returnMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Undo2 className="w-4 h-4 mr-2" />
                Procesar Devolución
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
