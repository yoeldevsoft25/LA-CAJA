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
import { AlertTriangle, Undo2, Loader2, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

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
        <DialogHeader className="border-b pb-4 px-6 -mx-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-950/40 rounded-xl">
              <Undo2 className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Devolución de Venta</DialogTitle>
              <DialogDescription className="text-sm">
                Selecciona los productos a devolver de la venta <span className="font-mono text-primary">#{sale.invoice_full_number || sale.id.slice(0, 8)}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 flex flex-col min-h-0 flex-1 overflow-hidden">
          {/* Barra de herramientas */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs font-semibold h-8 border-dashed hover:border-orange-500 hover:text-orange-600 transition-colors"
            >
              <Package className="w-3.5 h-3.5 mr-2" />
              {Object.values(returnItems).every((item) => item.selected)
                ? 'Deseleccionar todo'
                : 'Marcar todo'}
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Items seleccionados:</span>
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 font-bold border-none">
                {totals.itemCount}
              </Badge>
            </div>
          </div>

          <ScrollArea className="flex-1 pr-4 -mr-4">
            <div className="space-y-4 pb-4">
              <AnimatePresence mode="popLayout">
                {sale.items.map((item) => {
                  const state = returnItems[item.id]
                  if (!state) return null

                  return (
                    <motion.div
                      layout
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={cn(
                        'group relative border-2 rounded-xl p-4 transition-all duration-200',
                        state.selected
                          ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 ring-4 ring-orange-500/10'
                          : 'border-border bg-card hover:border-muted-foreground/30'
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center pt-1">
                          <Checkbox
                            checked={state.selected}
                            onCheckedChange={(checked: boolean) =>
                              handleSelectItem(item.id, checked)
                            }
                            className="w-5 h-5 border-2 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600 transition-colors"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-bold text-base leading-tight tracking-tight text-foreground group-hover:text-primary transition-colors">
                                {item.product?.name || 'Producto sin nombre'}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono px-1.5 py-0.5 bg-muted rounded">
                                  SKU: {item.product?.sku || 'N/A'}
                                </span>
                                <Badge variant="outline" className="text-[10px] h-4 tracking-widest uppercase opacity-70">
                                  ORIGINAL: x{Number(item.qty)}
                                </Badge>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="text-xs text-muted-foreground font-medium uppercase tracking-tighter">Precio Unit.</p>
                              <p className="text-sm font-bold text-foreground">
                                {formatCurrency(
                                  (Number(item.unit_price_bs) * Number(item.qty) - Number(item.discount_bs || 0)) / Number(item.qty),
                                  'BS'
                                )}
                              </p>
                            </div>
                          </div>

                          {state.selected && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-4 pt-4 border-t border-dashed border-orange-200 dark:border-orange-800"
                            >
                              <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Cant. Devolver
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={state.maxQty}
                                      step={item.is_weight_product ? 0.001 : 1}
                                      value={state.qty}
                                      onChange={(e) => handleQtyChange(item.id, e.target.value)}
                                      className="h-10 text-lg font-mono text-center bg-background border-2 focus-visible:ring-orange-500"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2 text-right">
                                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Subtotal Dev.
                                  </Label>
                                  <div className="h-10 flex items-center justify-end">
                                    <p className="text-xl font-black text-orange-600 tracking-tighter">
                                      {formatCurrency(
                                        ((Number(item.unit_price_bs) * Number(item.qty) - Number(item.discount_bs || 0)) / Number(item.qty)) * state.qty,
                                        'BS'
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>

          {/* Razón de devolución y Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t bg-muted/30 -mx-6 px-6">
            <div className="space-y-2">
              <Label htmlFor="return-reason" className="text-xs font-bold uppercase text-muted-foreground">
                Explicación del Motivo
              </Label>
              <Textarea
                id="return-reason"
                placeholder="Ej: Producto defectuoso, el cliente decidió cambiarlo o revertir la compra..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="bg-background min-h-[100px] border-2 focus-visible:ring-orange-500 resize-none text-sm p-3"
              />
            </div>

            <div className="flex flex-col justify-end">
              <AnimatePresence>
                {totals.itemCount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-5 bg-orange-600 text-white rounded-2xl shadow-xl shadow-orange-600/20 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                      <Undo2 className="w-20 h-20 rotate-12" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-orange-200" />
                        <span className="text-xs font-bold uppercase tracking-widest text-orange-100">Cálculo de Devolución</span>
                      </div>
                      <p className="text-3xl font-black tracking-tighter leading-none">
                        {formatCurrency(totals.totalBs, 'BS')}
                      </p>
                      <p className="text-orange-200 text-sm font-medium mt-1">
                        Equivalente: {formatCurrency(totals.totalUsd, 'USD')}
                      </p>
                      <div className="mt-4 pt-4 border-t border-white/20">
                        <p className="text-[10px] text-white/70 italic leading-tight">
                          * Los productos volverán automáticamente al inventario tras confirmar.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 pt-6 border-t px-0 flex items-center justify-between sm:justify-between w-full">
          <Button variant="outline" onClick={onClose} className="px-6 font-semibold uppercase tracking-widest text-xs hover:bg-muted transition-all">
            Abandonar
          </Button>
          <Button
            onClick={() => returnMutation.mutate()}
            disabled={!canSubmit || returnMutation.isPending}
            className="px-8 h-12 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
          >
            {returnMutation.isPending ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Procesando...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Undo2 className="w-5 h-5" />
                <span>CONFIRMAR DEVOLUCIÓN</span>
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent >
    </Dialog >
  )
}
