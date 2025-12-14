import { useQuery } from '@tanstack/react-query'
import { Package, TrendingUp, TrendingDown, ShoppingCart } from 'lucide-react'
import { inventoryService, InventoryMovement, StockStatus } from '@/services/inventory.service'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface MovementsModalProps {
  isOpen: boolean
  onClose: () => void
  product: StockStatus | null
}

const movementTypeLabels = {
  received: 'Recibido',
  adjust: 'Ajuste',
  sale: 'Venta',
}

const movementTypeIcons = {
  received: TrendingUp,
  adjust: TrendingDown,
  sale: ShoppingCart,
}

const movementTypeColors = {
  received: 'text-success bg-success/10',
  adjust: 'text-primary bg-primary/10',
  sale: 'text-info bg-info/10',
}

export default function MovementsModal({
  isOpen,
  onClose,
  product,
}: MovementsModalProps) {
  const { data: movementsData, isLoading } = useQuery({
    queryKey: ['inventory', 'movements', product?.product_id || 'all'],
    queryFn: () =>
      inventoryService.getMovements(product?.product_id, 100, 0),
    enabled: isOpen,
  })

  const movements = movementsData?.movements || []
  const total = movementsData?.total || 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl">Movimientos de Inventario</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm mt-0.5">
            {product ? product.product_name : 'Todos los productos'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          {isLoading ? (
            <div className="text-center py-8">
              <Skeleton className="w-12 h-12 rounded-full mx-auto mb-3" />
              <Skeleton className="h-4 w-32 mx-auto" />
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
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
                  movementTypeColors[movement.movement_type] || 'text-muted-foreground bg-muted'

                return (
                  <Card key={movement.id} className="border-border hover:bg-muted/50 transition-colors">
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
                              Number(movement.unit_cost_usd) > 0) && (
                              <Card className="mt-2 bg-info/5 border-info/50">
                                <CardContent className="p-2">
                                  <div className="text-xs sm:text-sm space-y-1">
                                    <div className="flex justify-between items-center">
                                      <span className="text-muted-foreground">Costo unitario:</span>
                                      <span className="font-semibold text-foreground">
                                        ${Number(movement.unit_cost_usd).toFixed(2)} USD / Bs.{' '}
                                        {Number(movement.unit_cost_bs).toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-info/50 pt-1">
                                      <span className="text-foreground font-medium">Costo total:</span>
                                      <span className="font-bold text-info">
                                        ${(Number(movement.unit_cost_usd) * Math.abs(movement.qty_delta)).toFixed(2)} USD / Bs.{' '}
                                        {(Number(movement.unit_cost_bs) * Math.abs(movement.qty_delta)).toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}

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

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <Button onClick={onClose} variant="outline" className="w-full">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

