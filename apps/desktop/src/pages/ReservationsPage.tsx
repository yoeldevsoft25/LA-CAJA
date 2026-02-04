import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Plus, Users, Clock, MapPin, Phone, Edit, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import { reservationsService, Reservation, CreateReservationRequest, UpdateReservationRequest } from '@/services/reservations.service'
import { tablesService } from '@/services/tables.service'
import toast from '@/lib/toast'
import ReservationModal from '@/components/reservations/ReservationModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

const statusLabels: Record<Reservation['status'], string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  seated: 'Sentada',
  cancelled: 'Cancelada',
  completed: 'Completada',
}

const statusColors: Record<Reservation['status'], string> = {
  pending: 'secondary',
  confirmed: 'default',
  seated: 'default',
  cancelled: 'destructive',
  completed: 'outline',
}

export default function ReservationsPage() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  )
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [reservationToDelete, setReservationToDelete] = useState<Reservation | null>(null)

  const { data: reservations, isLoading } = useQuery({
    queryKey: ['reservations', selectedDate],
    queryFn: () => {
      const date = selectedDate ? new Date(selectedDate) : undefined
      return reservationsService.getReservations(date)
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  })

  const { data: tables } = useQuery({
    queryKey: ['tables'],
    queryFn: () => tablesService.getTablesByStore(),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateReservationRequest) => reservationsService.createReservation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      toast.success('Reserva creada correctamente')
      setIsModalOpen(false)
      setSelectedReservation(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al crear la reserva')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateReservationRequest }) =>
      reservationsService.updateReservation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      toast.success('Reserva actualizada correctamente')
      setIsModalOpen(false)
      setSelectedReservation(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar la reserva')
    },
  })

  const assignTableMutation = useMutation({
    mutationFn: (id: string) => reservationsService.assignTable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Mesa asignada automáticamente')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al asignar la mesa')
    },
  })

  const markAsSeatedMutation = useMutation({
    mutationFn: (id: string) => reservationsService.markAsSeated(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Reserva marcada como sentada')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al marcar la reserva')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => reservationsService.cancelReservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      toast.success('Reserva cancelada')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al cancelar la reserva')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reservationsService.deleteReservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      toast.success('Reserva eliminada')
      setReservationToDelete(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al eliminar la reserva')
    },
  })

  const handleCreate = () => {
    setSelectedReservation(null)
    setIsModalOpen(true)
  }

  const handleEdit = (reservation: Reservation) => {
    setSelectedReservation(reservation)
    setIsModalOpen(true)
  }

  const handleSave = (data: CreateReservationRequest | UpdateReservationRequest) => {
    if (selectedReservation) {
      updateMutation.mutate({ id: selectedReservation.id, data: data as UpdateReservationRequest })
    } else {
      createMutation.mutate(data as CreateReservationRequest)
    }
  }

  // Función para obtener mesas disponibles (puede usarse en el futuro)
  // const getAvailableTables = (partySize: number) => {
  //   if (!tables) return []
  //   return tables.filter(
  //     (table) =>
  //       table.status === 'available' &&
  //       table.capacity &&
  //       table.capacity >= partySize
  //   )
  // }

  const groupedReservations = reservations?.reduce((acc, reservation) => {
    const time = reservation.reservation_time.substring(0, 5) // HH:mm
    if (!acc[time]) {
      acc[time] = []
    }
    acc[time].push(reservation)
    return acc
  }, {} as Record<string, Reservation[]>) || {}

  const sortedTimes = Object.keys(groupedReservations).sort()

  return (
    <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-xl sm:text-2xl flex items-center">
              <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-primary mr-2" />
              Reservas
            </CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex-1 sm:flex-initial">
                <Label htmlFor="date" className="sr-only">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full"
                />
              </div>
              <Button onClick={handleCreate} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Reserva
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : sortedTimes.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg text-muted-foreground">
                No hay reservas para esta fecha
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedTimes.map((time) => (
                <div key={time}>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    {time}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedReservations[time].map((reservation) => (
                      <Card
                        key={reservation.id}
                        className={cn(
                          'transition-all hover:shadow-lg',
                          reservation.status === 'cancelled' && 'opacity-60'
                        )}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg">
                                {reservation.customer_name}
                              </CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                  {reservation.party_size} persona(s)
                                </span>
                              </div>
                            </div>
                            <Badge variant={statusColors[reservation.status] as any}>
                              {statusLabels[reservation.status]}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {reservation.table && (
                              <div className="flex items-center gap-2 text-sm">
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                <span>Mesa {reservation.table.table_number}</span>
                                {reservation.table.name && (
                                  <span className="text-muted-foreground">
                                    ({reservation.table.name})
                                  </span>
                                )}
                              </div>
                            )}
                            {reservation.customer_phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="w-4 h-4 text-muted-foreground" />
                                <span>{reservation.customer_phone}</span>
                              </div>
                            )}
                            {reservation.special_requests && (
                              <div className="text-sm text-muted-foreground italic mt-2 pt-2 border-t">
                                {reservation.special_requests}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                            {reservation.status === 'pending' && !reservation.table_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => assignTableMutation.mutate(reservation.id)}
                                disabled={assignTableMutation.isPending}
                              >
                                Asignar Mesa
                              </Button>
                            )}
                            {reservation.status === 'confirmed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markAsSeatedMutation.mutate(reservation.id)}
                                disabled={markAsSeatedMutation.isPending}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Marcar Sentada
                              </Button>
                            )}
                            {reservation.status !== 'cancelled' && reservation.status !== 'completed' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(reservation)}
                                >
                                  <Edit className="w-4 h-4 mr-1" />
                                  Editar
                                </Button>
                                {reservation.status !== 'seated' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => cancelMutation.mutate(reservation.id)}
                                    disabled={cancelMutation.isPending}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Cancelar
                                  </Button>
                                )}
                              </>
                            )}
                            {reservation.status === 'cancelled' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setReservationToDelete(reservation)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Eliminar
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de reserva */}
      <ReservationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedReservation(null)
        }}
        reservation={selectedReservation}
        tables={tables || []}
        onSave={handleSave}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Dialog de eliminar */}
      <AlertDialog
        open={!!reservationToDelete}
        onOpenChange={(open) => !open && setReservationToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la reserva de{' '}
              {reservationToDelete?.customer_name}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => reservationToDelete && deleteMutation.mutate(reservationToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
