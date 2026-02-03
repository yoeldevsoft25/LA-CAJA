import { useQuery } from '@tanstack/react-query'
import { History, Package, ArrowDown, ArrowUp, X, AlertTriangle } from 'lucide-react'
import { productLotsService, ProductLot } from '@/services/product-lots.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@la-caja/ui-core'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format } from 'date-fns'
import { cn } from '@la-caja/ui-core'

interface LotMovementsListProps {
  isOpen: boolean
  onClose: () => void
  lot: ProductLot
}

const movementTypeLabels: Record<string, string> = {
  received: 'Recibido',
  sold: 'Vendido',
  expired: 'Vencido',
  damaged: 'Dañado',
  adjusted: 'Ajustado',
}

const movementTypeIcons: Record<string, typeof ArrowUp> = {
  received: ArrowUp,
  sold: ArrowDown,
  expired: X,
  damaged: AlertTriangle,
  adjusted: Package,
}

const movementTypeColors: Record<string, string> = {
  received: 'text-success',
  sold: 'text-primary',
  expired: 'text-destructive',
  damaged: 'text-warning',
  adjusted: 'text-muted-foreground',
}

export default function LotMovementsList({ isOpen, onClose, lot }: LotMovementsListProps) {
  const { data: movements, isLoading } = useQuery({
    queryKey: ['product-lots', 'movements', lot.id],
    queryFn: () => productLotsService.getLotMovements(lot.id),
    enabled: isOpen,
    staleTime: 1000 * 60 * 2, // 2 minutos
  })

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg sm:text-xl flex items-center">
            <History className="w-5 h-5 sm:w-6 sm:h-6 text-primary mr-2" />
            Movimientos del Lote {lot.lot_number}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : movements && movements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay movimientos registrados para este lote
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden sm:table-cell">Cantidad</TableHead>
                    <TableHead className="hidden md:table-cell">Venta</TableHead>
                    <TableHead>Nota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements
                    ?.sort(
                      (a, b) =>
                        new Date(b.happened_at).getTime() - new Date(a.happened_at).getTime()
                    )
                    .map((movement) => {
                      const Icon = movementTypeIcons[movement.movement_type] || Package
                      const isPositive = movement.qty_delta > 0

                      return (
                        <TableRow key={movement.id}>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium text-foreground">
                                {format(new Date(movement.happened_at), 'dd/MM/yyyy')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(movement.happened_at), 'HH:mm')}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon
                                className={cn(
                                  'w-4 h-4',
                                  movementTypeColors[movement.movement_type] || 'text-muted-foreground'
                                )}
                              />
                              <Badge
                                variant={
                                  movement.movement_type === 'received'
                                    ? 'default'
                                    : movement.movement_type === 'sold'
                                      ? 'secondary'
                                      : 'destructive'
                                }
                              >
                                {movementTypeLabels[movement.movement_type] || movement.movement_type}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center gap-1">
                              {isPositive ? (
                                <ArrowUp className="w-4 h-4 text-success" />
                              ) : (
                                <ArrowDown className="w-4 h-4 text-destructive" />
                              )}
                              <span
                                className={cn(
                                  'font-semibold',
                                  isPositive ? 'text-success' : 'text-destructive'
                                )}
                              >
                                {isPositive ? '+' : ''}
                                {movement.qty_delta}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {movement.sale_id ? (
                              <p className="text-sm text-muted-foreground font-mono">
                                {movement.sale_id.slice(0, 8)}...
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">-</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-foreground">{movement.note || '-'}</p>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <Button onClick={onClose} className="w-full">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

