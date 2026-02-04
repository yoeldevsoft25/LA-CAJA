import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/auth.store'
import { Clock, CheckCircle2, Eye } from 'lucide-react'
import { shiftsService, Shift } from '@/services/shifts.service'
import { format } from 'date-fns'
import ShiftSummaryModal from './ShiftSummaryModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

export default function ShiftsList() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 10

  // Obtener datos del prefetch como placeholderData (primera página)
  const prefetchedShifts = queryClient.getQueryData<{ shifts: Shift[]; total: number }>([
    'shifts',
    'list',
    user?.store_id,
  ])

  const { data: shiftsData, isLoading } = useQuery({
    queryKey: ['shifts', 'list', currentPage],
    queryFn: () => shiftsService.listShifts({ limit, offset: (currentPage - 1) * limit }),
    placeholderData: currentPage === 1 ? prefetchedShifts : undefined,
    staleTime: 1000 * 60 * 10, // 10 minutos
    gcTime: Infinity,
    refetchOnMount: false,
  })

  const handleViewSummary = (shift: Shift) => {
    setSelectedShift(shift)
    setIsSummaryModalOpen(true)
  }

  if (isLoading) {
    return (
      <Card className="border border-border">
        <CardContent className="p-6">
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    )
  }

  const shifts = shiftsData?.shifts || []
  const totalPages = shiftsData ? Math.ceil(shiftsData.total / limit) : 0

  if (shifts.length === 0) {
    return null
  }

  return (
    <>
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Historial de Turnos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="hidden sm:table-cell">Estado</TableHead>
                  <TableHead className="hidden md:table-cell">Apertura</TableHead>
                  <TableHead className="hidden lg:table-cell">Cierre</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => {
                  const isOpen = shift.status === 'open'

                  return (
                    <TableRow key={shift.id}>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium text-foreground">
                            {format(new Date(shift.opened_at), 'dd/MM/yyyy')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(shift.opened_at), 'HH:mm')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {isOpen ? (
                          <Badge className="bg-success text-white">
                            <Clock className="w-3 h-3 mr-1" />
                            Abierto
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Cerrado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-sm">
                          <p className="text-foreground">
                            {Number(shift.opening_amount_bs).toFixed(2)} Bs
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ${Number(shift.opening_amount_usd).toFixed(2)} USD
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {shift.closed_at ? (
                          <div className="text-sm">
                            <p className="text-foreground">
                              {format(new Date(shift.closed_at), 'dd/MM/yyyy HH:mm')}
                            </p>
                            {shift.closing_amount_bs && shift.closing_amount_usd && (
                              <p className="text-xs text-muted-foreground">
                                {Number(shift.closing_amount_bs).toFixed(2)} Bs / $
                                {Number(shift.closing_amount_usd).toFixed(2)} USD
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">-</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewSummary(shift)}
                          className="text-primary hover:text-primary hover:bg-primary/10"
                        >
                          <Eye className="w-4 h-4 mr-1.5" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
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
        </CardContent>
      </Card>

      {selectedShift && (
        <ShiftSummaryModal
          isOpen={isSummaryModalOpen}
          onClose={() => {
            setIsSummaryModalOpen(false)
            setSelectedShift(null)
          }}
          shiftId={selectedShift.id}
        />
      )}
    </>
  )
}

