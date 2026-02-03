import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, Plus } from 'lucide-react'
import { paymentsService, CreateCashMovementRequest } from '@/services/payments.service'
import toast from '@/lib/toast'
import { format } from 'date-fns'
import CashMovementModal from './CashMovementModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

interface CashMovementsListProps {
  shiftId?: string | null
  cashSessionId?: string | null
}

export default function CashMovementsList({
  shiftId,
  cashSessionId,
}: CashMovementsListProps) {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 20

  const createMovementMutation = useMutation({
    mutationFn: (data: CreateCashMovementRequest) => paymentsService.createCashMovement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', 'movements'] })
      toast.success('Movimiento registrado correctamente')
      setIsModalOpen(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al registrar el movimiento')
    },
  })

  const { data: movementsData, isLoading } = useQuery({
    queryKey: ['payments', 'movements', currentPage, shiftId, cashSessionId],
    queryFn: () =>
      paymentsService.getCashMovements({
        limit,
        offset: (currentPage - 1) * limit,
        shift_id: shiftId || undefined,
        cash_session_id: cashSessionId || undefined,
      }),
    staleTime: 1000 * 60 * 5, // 5 minutos
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    )
  }

  const movements = movementsData?.movements || []
  const totalPages = movementsData ? Math.ceil(movementsData.total / limit) : 0

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg sm:text-xl">Movimientos de Efectivo</CardTitle>
          <Button onClick={() => setIsModalOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Registrar Movimiento
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No hay movimientos registrados
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                      <TableHead className="hidden md:table-cell">Monto Bs</TableHead>
                      <TableHead className="hidden lg:table-cell">Monto USD</TableHead>
                      <TableHead>Razón</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-medium text-foreground">
                              {format(new Date(movement.created_at), 'dd/MM/yyyy')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(movement.created_at), 'HH:mm')}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge
                            variant={movement.movement_type === 'entry' ? 'default' : 'destructive'}
                          >
                            {movement.movement_type === 'entry' ? (
                              <>
                                <ArrowDownCircle className="w-3 h-3 mr-1" />
                                Entrada
                              </>
                            ) : (
                              <>
                                <ArrowUpCircle className="w-3 h-3 mr-1" />
                                Salida
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <p className="text-sm font-medium text-foreground">
                            {Number(movement.amount_bs).toFixed(2)} Bs
                          </p>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <p className="text-sm font-medium text-foreground">
                            ${Number(movement.amount_usd).toFixed(2)}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-foreground">{movement.reason}</p>
                          {movement.note && (
                            <p className="text-xs text-muted-foreground mt-1">{movement.note}</p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="border-t border-border px-4 py-3 sm:px-6 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CashMovementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={(data) => createMovementMutation.mutate(data)}
        isLoading={createMovementMutation.isPending}
        shiftId={shiftId}
        cashSessionId={cashSessionId}
      />
    </>
  )
}

