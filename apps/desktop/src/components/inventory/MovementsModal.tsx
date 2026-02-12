import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Package, TrendingUp, TrendingDown, ShoppingCart } from 'lucide-react'
import { inventoryService, StockStatus } from '@/services/inventory.service'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface MovementsModalProps {
  isOpen: boolean
  onClose: () => void
  product: StockStatus | null
  warehouseId?: string
}

const movementTypeLabels = {
  received: 'Recibido',
  adjust: 'Ajuste',
  sold: 'Venta',
  sale: 'Venta',
  transfer_in: 'Traslado (Entrada)',
  transfer_out: 'Traslado (Salida)',
}

const movementTypeIcons = {
  received: TrendingUp,
  adjust: TrendingDown,
  sold: ShoppingCart,
  sale: ShoppingCart,
  transfer_in: TrendingUp,
  transfer_out: TrendingDown,
}

const movementTypeColors = {
  received: 'text-success bg-success/10',
  adjust: 'text-primary bg-primary/10',
  sold: 'text-info bg-info/10',
  sale: 'text-info bg-info/10',
  transfer_in: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  transfer_out: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
}

export default function MovementsModal({
  isOpen,
  onClose,
  product,
  warehouseId,
}: MovementsModalProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20 // Mostrar 20 movimientos por página

  // Reset page cuando cambian los filtros de fecha
  useEffect(() => {
    setCurrentPage(1)
  }, [startDate, endDate])

  const offset = (currentPage - 1) * pageSize

  const { data: movementsData, isLoading } = useQuery({
    queryKey: [
      'inventory',
      'movements',
      product?.product_id || 'all',
      warehouseId || 'all',
      startDate,
      endDate,
      currentPage,
    ],
    queryFn: () =>
      inventoryService.getMovements({
        product_id: product?.product_id || undefined,
        warehouse_id: warehouseId,
        limit: pageSize,
        offset,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }),
    enabled: isOpen,
  })

  const movements = movementsData?.movements || []
  const total = movementsData?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0 bg-card">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl">Movimientos de Inventario</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm mt-0.5">
            {product ? product.product_name : 'Todos los productos'}
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex-shrink-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-1 h-9"
              />
            </div>
          </div>
          {(startDate || endDate) && (
            <div className="mt-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          {isLoading ? (
            <div className="text-center py-8">
              <Skeleton className="w-12 h-12 rounded-full mx-auto mb-3" />
              <Skeleton className="h-4 w-32 mx-auto" />
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-card border border-border/60 flex items-center justify-center mx-auto mb-3">
                <Package className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-foreground mb-1">No hay movimientos</p>
              <p className="text-sm text-muted-foreground">Este producto no tiene movimientos registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="mb-4 text-sm text-muted-foreground">
                Total de movimientos: <span className="font-semibold text-foreground">{total}</span>
              </div>
              {movements.map((movement) => {
                const Icon =
                  movementTypeIcons[movement.movement_type] || Package
                const typeLabel =
                  movementTypeLabels[movement.movement_type] || movement.movement_type
                const typeColor =
                  movementTypeColors[movement.movement_type] || 'text-muted-foreground bg-card border border-border/60'

                return (
                  <Card key={movement.id} className="border-border bg-card hover:bg-muted/20 transition-colors">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start space-x-3">
                        <div className={cn('p-2 rounded-lg flex-shrink-0', typeColor)}>
                          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Nombre del producto (si no está filtrado por producto) */}
                          {!product && movement.product_name && (
                            <h4 className="font-semibold text-foreground mb-2 text-sm sm:text-base">
                              {movement.product_name}
                            </h4>
                          )}

                          <div className="flex items-center space-x-2 mb-2 flex-wrap">
                            <Badge variant="secondary" className={typeColor}>
                              {typeLabel}
                            </Badge>
                            <span
                              className={cn(
                                'text-base sm:text-lg font-bold',
                                movement.qty_delta > 0
                                  ? 'text-success'
                                  : movement.qty_delta < 0
                                    ? 'text-destructive'
                                    : 'text-muted-foreground'
                              )}
                            >
                              {movement.qty_delta > 0 ? '+' : ''}
                              {movement.qty_delta} unidades
                            </span>
                          </div>

                          <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                            {format(new Date(movement.happened_at), 'dd/MM/yyyy HH:mm')}
                          </p>

                          {/* Costos - Unitario y Total */}
                          {movement.movement_type === 'received' &&
                            (Number(movement.unit_cost_bs) > 0 ||
                              Number(movement.unit_cost_usd) > 0) && (() => {
                                const uUsd = Number(movement.unit_cost_usd)
                                const uBs = Number(movement.unit_cost_bs)
                                const qty = Math.abs(movement.qty_delta)
                                const sinUsd = uUsd === 0 && uBs > 0
                                return (
                                  <Card className="mt-2 bg-info/5 border-info/50">
                                    <CardContent className="p-2">
                                      <div className="text-xs sm:text-sm space-y-1">
                                        <div className="flex justify-between items-center">
                                          <span className="text-muted-foreground">Costo unitario:</span>
                                          <span className="font-semibold text-foreground">
                                            {sinUsd ? '—' : `$${uUsd.toFixed(2)} USD`} / Bs. {uBs.toFixed(2)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-info/50 pt-1">
                                          <span className="text-foreground font-medium">Costo total:</span>
                                          <span className="font-bold text-info">
                                            {sinUsd ? '—' : `$${(uUsd * qty).toFixed(2)} USD`} / Bs. {(uBs * qty).toFixed(2)}
                                          </span>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                )
                              })()}

                          {movement.ref && (
                            <div className="mt-2 text-xs text-muted-foreground space-y-1">
                              {movement.ref.supplier && (
                                <p>
                                  <span className="font-medium text-foreground">Proveedor:</span>{' '}
                                  {movement.ref.supplier}
                                </p>
                              )}
                              {movement.ref.invoice && (
                                <p>
                                  <span className="font-medium text-foreground">Factura:</span>{' '}
                                  {movement.ref.invoice}
                                </p>
                              )}
                            </div>
                          )}

                          {movement.note && (
                            <p className="text-sm text-foreground mt-2 italic border-l-2 border-border pl-2">
                              {movement.note}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer con paginación */}
        <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4 space-y-3">
          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between flex-col sm:flex-row gap-3">
              <div className="text-xs sm:text-sm text-muted-foreground">
                Mostrando {offset + 1} - {Math.min(offset + pageSize, total)} de {total} movimientos
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="btn-glass-neutral"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <div className="flex items-center gap-2 px-2 sm:px-3">
                  <span className="text-xs sm:text-sm">
                    Página {currentPage} de {totalPages}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="btn-glass-neutral"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}

          <Button onClick={onClose} variant="outline" className="w-full btn-glass-neutral">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
