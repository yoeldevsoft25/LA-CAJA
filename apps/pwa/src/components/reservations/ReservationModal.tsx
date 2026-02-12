import { useState, useEffect } from 'react'
import {
  Reservation,
  CreateReservationRequest,
  UpdateReservationRequest,
} from '@/services/reservations.service'
import { Table } from '@/services/tables.service'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'

interface ReservationModalProps {
  isOpen: boolean
  onClose: () => void
  reservation: Reservation | null
  tables: Table[]
  onSave: (data: CreateReservationRequest | UpdateReservationRequest) => void
  isLoading: boolean
}

export default function ReservationModal({
  isOpen,
  onClose,
  reservation,
  tables,
  onSave,
  isLoading,
}: ReservationModalProps) {
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [reservationDate, setReservationDate] = useState('')
  const [reservationTime, setReservationTime] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [tableId, setTableId] = useState<string>('')
  const noTableValue = 'none'
  const [specialRequests, setSpecialRequests] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (reservation) {
      setCustomerName(reservation.customer_name)
      setCustomerPhone(reservation.customer_phone || '')
      setReservationDate(reservation.reservation_date.split('T')[0])
      setReservationTime(reservation.reservation_time.substring(0, 5))
      setPartySize(reservation.party_size)
      setTableId(reservation.table_id || '')
      setSpecialRequests(reservation.special_requests || '')
      setNote(reservation.note || '')
    } else {
      // Reset form
      setCustomerName('')
      setCustomerPhone('')
      setReservationDate(format(new Date(), 'yyyy-MM-dd'))
      setReservationTime('19:00')
      setPartySize(2)
      setTableId('')
      setSpecialRequests('')
      setNote('')
    }
  }, [reservation, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const data = {
      customer_name: customerName,
      customer_phone: customerPhone || null,
      reservation_date: reservationDate,
      reservation_time: reservationTime,
      party_size: partySize,
      table_id: tableId || null,
      special_requests: specialRequests || null,
      note: note || null,
    }

    onSave(data)
  }

  const availableTables = tables.filter(
    (table) =>
      table.status === 'available' &&
      table.capacity &&
      table.capacity >= partySize
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle>
            {reservation ? 'Editar Reserva' : 'Nueva Reserva'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">
                Nombre del Cliente <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerPhone">Teléfono</Label>
              <Input
                id="customerPhone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+58 412 123 4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reservationDate">
                Fecha <span className="text-destructive">*</span>
              </Label>
              <Input
                id="reservationDate"
                type="date"
                value={reservationDate}
                onChange={(e) => setReservationDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reservationTime">
                Hora <span className="text-destructive">*</span>
              </Label>
              <Input
                id="reservationTime"
                type="time"
                value={reservationTime}
                onChange={(e) => setReservationTime(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="partySize">
                Número de Personas <span className="text-destructive">*</span>
              </Label>
              <Input
                id="partySize"
                type="number"
                min="1"
                max="20"
                value={partySize}
                onChange={(e) => setPartySize(parseInt(e.target.value) || 1)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tableId">Mesa</Label>
              <Select
                value={tableId || noTableValue}
                onValueChange={(value) => setTableId(value === noTableValue ? '' : value)}
              >
                <SelectTrigger id="tableId">
                  <SelectValue placeholder="Sin asignar (se asignará automáticamente)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={noTableValue}>Sin asignar</SelectItem>
                  {availableTables.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      Mesa {table.table_number}
                      {table.name && ` - ${table.name}`}
                      {table.capacity && ` (Capacidad: ${table.capacity})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialRequests">Solicitudes Especiales</Label>
            <Textarea
              id="specialRequests"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="Alergias, preferencias, etc."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Notas Internas</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Notas para el personal..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="btn-glass-neutral">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : reservation ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
