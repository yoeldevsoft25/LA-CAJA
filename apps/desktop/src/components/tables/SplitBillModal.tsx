import { useState, useMemo } from 'react'
import { Users, Percent, List } from 'lucide-react'
import { Order } from '@/services/orders.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SplitBillModalProps {
  isOpen: boolean
  onClose: () => void
  order: Order
  onSplit: (splits: Array<{
    items: string[] // order_item_ids
    amount_bs: number
    amount_usd: number
    diner_name?: string
  }>) => void
}

type SplitMode = 'items' | 'diners' | 'percentage'

interface ItemSplit {
  itemId: string
  dinerIndex: number
  quantity: number
}

interface DinerSplit {
  name: string
  itemIds: string[]
}

export default function SplitBillModal({
  isOpen,
  onClose,
  order,
  onSplit,
}: SplitBillModalProps) {
  const [splitMode, setSplitMode] = useState<SplitMode>('items')
  const [numDiners, setNumDiners] = useState(2)
  const [itemSplits, setItemSplits] = useState<Map<string, ItemSplit[]>>(new Map())
  const [dinerSplits, setDinerSplits] = useState<DinerSplit[]>([])
  const [percentageSplits, setPercentageSplits] = useState<Map<number, number>>(new Map())

  // Calcular totales
  const orderTotal = useMemo(() => {
    let totalBs = 0
    let totalUsd = 0

    const items = order.items || []
    const payments = order.payments || []

    items.forEach((item) => {
      totalBs += Number(item.unit_price_bs) * item.qty - Number(item.discount_bs || 0)
      totalUsd += Number(item.unit_price_usd) * item.qty - Number(item.discount_usd || 0)
    })

    // Restar pagos parciales
    payments.forEach((payment) => {
      totalBs -= Number(payment.amount_bs)
      totalUsd -= Number(payment.amount_usd)
    })

    return { bs: Math.max(0, totalBs), usd: Math.max(0, totalUsd) }
  }, [order])

  // Inicializar splits de comensales
  const initializeDiners = () => {
    if (dinerSplits.length === 0) {
      setDinerSplits(
        Array.from({ length: numDiners }, (_, i) => ({
          name: `Comensal ${i + 1}`,
          itemIds: [],
        }))
      )
    } else if (dinerSplits.length !== numDiners) {
      const newSplits = Array.from({ length: numDiners }, (_, i) => {
        const existing = dinerSplits[i]
        return existing || { name: `Comensal ${i + 1}`, itemIds: [] }
      })
      setDinerSplits(newSplits)
    }
  }

  // Inicializar splits por porcentaje
  const initializePercentages = () => {
    if (percentageSplits.size === 0) {
      const percentagePerDiner = 100 / numDiners
      const newSplits = new Map<number, number>()
      for (let i = 0; i < numDiners; i++) {
        newSplits.set(i, percentagePerDiner)
      }
      setPercentageSplits(newSplits)
    }
  }

  // Calcular totales por comensal (modo items)
  const calculateDinerTotals = (dinerIndex: number) => {
    let totalBs = 0
    let totalUsd = 0

    const items = order.items || []
    itemSplits.forEach((splits, itemId) => {
      const item = items.find((i) => i.id === itemId)
      if (!item) return

      const dinerSplit = splits.find((s) => s.dinerIndex === dinerIndex)
      if (dinerSplit) {
        const itemPriceBs = Number(item.unit_price_bs) - Number(item.discount_bs || 0) / item.qty
        const itemPriceUsd = Number(item.unit_price_usd) - Number(item.discount_usd || 0) / item.qty
        totalBs += itemPriceBs * dinerSplit.quantity
        totalUsd += itemPriceUsd * dinerSplit.quantity
      }
    })

    return { bs: totalBs, usd: totalUsd }
  }

  // Calcular totales por comensal (modo diners)
  const calculateDinerTotalsFromItems = (itemIds: string[]) => {
    let totalBs = 0
    let totalUsd = 0

    const items = order.items || []
    itemIds.forEach((itemId) => {
      const item = items.find((i) => i.id === itemId)
      if (item) {
        totalBs += Number(item.unit_price_bs) * item.qty - Number(item.discount_bs || 0)
        totalUsd += Number(item.unit_price_usd) * item.qty - Number(item.discount_usd || 0)
      }
    })

    return { bs: totalBs, usd: totalUsd }
  }

  const handleSplit = () => {
    if (splitMode === 'items') {
      // Dividir por items
      const splits: Array<{
        items: string[]
        amount_bs: number
        amount_usd: number
        diner_name?: string
      }> = []

      for (let i = 0; i < numDiners; i++) {
        const itemIds: string[] = []
        itemSplits.forEach((splits, itemId) => {
          if (splits.some((s) => s.dinerIndex === i)) {
            itemIds.push(itemId)
          }
        })

        if (itemIds.length > 0) {
          const totals = calculateDinerTotals(i)
          splits.push({
            items: itemIds,
            amount_bs: totals.bs,
            amount_usd: totals.usd,
            diner_name: `Comensal ${i + 1}`,
          })
        }
      }

      onSplit(splits)
    } else if (splitMode === 'diners') {
      // Dividir por comensales
      const splits = dinerSplits
        .filter((diner) => diner.itemIds.length > 0)
        .map((diner) => {
          const totals = calculateDinerTotalsFromItems(diner.itemIds)
          return {
            items: diner.itemIds,
            amount_bs: totals.bs,
            amount_usd: totals.usd,
            diner_name: diner.name,
          }
        })

      onSplit(splits)
    } else if (splitMode === 'percentage') {
      // Dividir por porcentaje
      const splits: Array<{
        items: string[]
        amount_bs: number
        amount_usd: number
        diner_name?: string
      }> = []

      percentageSplits.forEach((percentage, dinerIndex) => {
        if (percentage > 0) {
          splits.push({
            items: (order.items || []).map((i) => i.id), // Todos los items
            amount_bs: (orderTotal.bs * percentage) / 100,
            amount_usd: (orderTotal.usd * percentage) / 100,
            diner_name: `Comensal ${dinerIndex + 1}`,
          })
        }
      })

      onSplit(splits)
    }

    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Dividir Cuenta</DialogTitle>
        </DialogHeader>

        <Tabs value={splitMode} onValueChange={(v) => setSplitMode(v as SplitMode)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="items">
              <List className="w-4 h-4 mr-2" />
              Por Items
            </TabsTrigger>
            <TabsTrigger value="diners">
              <Users className="w-4 h-4 mr-2" />
              Por Comensales
            </TabsTrigger>
            <TabsTrigger value="percentage">
              <Percent className="w-4 h-4 mr-2" />
              Por Porcentaje
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto mt-4">
            <TabsContent value="items" className="space-y-4 mt-0">
              <div className="flex items-center gap-4">
                <Label>Número de comensales:</Label>
                <Input
                  type="number"
                  min="2"
                  max="10"
                  value={numDiners}
                  onChange={(e) => {
                    const num = parseInt(e.target.value) || 2
                    setNumDiners(Math.max(2, Math.min(10, num)))
                  }}
                  className="w-24"
                />
              </div>

              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {(order.items || []).map((item) => {
                    const splits = itemSplits.get(item.id) || []
                    const totalAssigned = splits.reduce((sum, s) => sum + s.quantity, 0)
                    const remaining = item.qty - totalAssigned

                    return (
                      <Card key={item.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-medium">{item.product?.name || 'Producto'}</p>
                              <p className="text-sm text-muted-foreground">
                                Cantidad: {item.qty} | ${Number(item.unit_price_usd).toFixed(2)} c/u
                              </p>
                            </div>
                            <Badge variant={remaining === 0 ? 'default' : 'secondary'}>
                              {remaining} restante(s)
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Array.from({ length: numDiners }, (_, i) => {
                              const dinerSplit = splits.find((s) => s.dinerIndex === i)
                              const quantity = dinerSplit?.quantity || 0

                              return (
                                <div key={i} className="space-y-1">
                                  <Label className="text-xs">Comensal {i + 1}</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max={item.qty}
                                    value={quantity}
                                    onChange={(e) => {
                                      const qty = parseInt(e.target.value) || 0
                                      const newSplits = new Map(itemSplits)
                                      const itemSplitsList = newSplits.get(item.id) || []

                                      if (qty === 0) {
                                        const filtered = itemSplitsList.filter(
                                          (s) => s.dinerIndex !== i
                                        )
                                        if (filtered.length === 0) {
                                          newSplits.delete(item.id)
                                        } else {
                                          newSplits.set(item.id, filtered)
                                        }
                                      } else {
                                        const existing = itemSplitsList.find(
                                          (s) => s.dinerIndex === i
                                        )
                                        if (existing) {
                                          existing.quantity = Math.min(qty, item.qty)
                                        } else {
                                          itemSplitsList.push({
                                            itemId: item.id,
                                            dinerIndex: i,
                                            quantity: Math.min(qty, item.qty),
                                          })
                                        }
                                        newSplits.set(item.id, itemSplitsList)
                                      }

                                      setItemSplits(newSplits)
                                    }}
                                    className="h-9"
                                  />
                                </div>
                              )
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </ScrollArea>

              <div className="border-t pt-4 space-y-2">
                <p className="text-sm font-medium">Resumen por comensal:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Array.from({ length: numDiners }, (_, i) => {
                    const totals = calculateDinerTotals(i)
                    return (
                      <Card key={i}>
                        <CardContent className="p-3">
                          <p className="text-xs text-muted-foreground">Comensal {i + 1}</p>
                          <p className="font-semibold">${totals.usd.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            Bs. {totals.bs.toFixed(2)}
                          </p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="diners" className="space-y-4 mt-0">
              <div className="flex items-center gap-4 mb-4">
                <Label>Número de comensales:</Label>
                <Input
                  type="number"
                  min="2"
                  max="10"
                  value={numDiners}
                  onChange={(e) => {
                    const num = parseInt(e.target.value) || 2
                    setNumDiners(Math.max(2, Math.min(10, num)))
                    initializeDiners()
                  }}
                  className="w-24"
                />
              </div>

              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {dinerSplits.map((diner, dinerIndex) => {
                    const totals = calculateDinerTotalsFromItems(diner.itemIds)
                    return (
                      <Card key={dinerIndex}>
                        <CardContent className="p-4">
                          <div className="mb-3">
                            <Label>Nombre del comensal</Label>
                            <Input
                              value={diner.name}
                              onChange={(e) => {
                                const newSplits = [...dinerSplits]
                                newSplits[dinerIndex].name = e.target.value
                                setDinerSplits(newSplits)
                              }}
                              className="mt-1"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm">Items asignados:</Label>
                            <div className="flex flex-wrap gap-2">
                              {(order.items || []).map((item) => {
                                const isSelected = diner.itemIds.includes(item.id)
                                return (
                                  <Button
                                    key={item.id}
                                    variant={isSelected ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                      const newSplits = [...dinerSplits]
                                      if (isSelected) {
                                        newSplits[dinerIndex].itemIds = diner.itemIds.filter(
                                          (id) => id !== item.id
                                        )
                                      } else {
                                        newSplits[dinerIndex].itemIds.push(item.id)
                                      }
                                      setDinerSplits(newSplits)
                                    }}
                                  >
                                    {item.product?.name || 'Producto'} (x{item.qty})
                                  </Button>
                                )
                              })}
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm font-medium">
                              Total: ${totals.usd.toFixed(2)} (Bs. {totals.bs.toFixed(2)})
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="percentage" className="space-y-4 mt-0">
              <div className="flex items-center gap-4 mb-4">
                <Label>Número de comensales:</Label>
                <Input
                  type="number"
                  min="2"
                  max="10"
                  value={numDiners}
                  onChange={(e) => {
                    const num = parseInt(e.target.value) || 2
                    setNumDiners(Math.max(2, Math.min(10, num)))
                    initializePercentages()
                  }}
                  className="w-24"
                />
              </div>

              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {Array.from({ length: numDiners }, (_, i) => {
                    const percentage = percentageSplits.get(i) || 0
                    const amount = (orderTotal.usd * percentage) / 100

                    return (
                      <Card key={i}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div>
                              <Label>Comensal {i + 1}</Label>
                              <div className="flex items-center gap-2 mt-1">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={percentage}
                                  onChange={(e) => {
                                    const newPercentage = parseFloat(e.target.value) || 0
                                    const newSplits = new Map(percentageSplits)
                                    newSplits.set(i, Math.min(100, Math.max(0, newPercentage)))
                                    setPercentageSplits(newSplits)
                                  }}
                                  className="flex-1"
                                />
                                <span className="text-sm text-muted-foreground">%</span>
                              </div>
                            </div>

                            <div className="pt-2 border-t">
                              <p className="text-sm font-medium">
                                Monto: ${amount.toFixed(2)} (Bs.{' '}
                                {((orderTotal.bs * percentage) / 100).toFixed(2)})
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </ScrollArea>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total asignado:</span>
                  <span className="text-sm font-semibold">
                    {Array.from(percentageSplits.values()).reduce((sum, p) => sum + p, 0).toFixed(1)}%
                  </span>
                </div>
                {Math.abs(Array.from(percentageSplits.values()).reduce((sum, p) => sum + p, 0) - 100) > 0.1 && (
                  <p className="text-xs text-destructive mt-1">
                    El total debe sumar 100%
                  </p>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSplit}
            disabled={
              splitMode === 'percentage' &&
              Math.abs(Array.from(percentageSplits.values()).reduce((sum, p) => sum + p, 0) - 100) > 0.1
            }
          >
            Dividir Cuenta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
