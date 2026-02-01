import { api } from '@/lib/api'

export type ReservationStatus = 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'completed'

export interface Reservation {
  id: string
  store_id: string
  table_id: string | null
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  reservation_date: string
  reservation_time: string
  party_size: number
  status: ReservationStatus
  special_requests: string | null
  note: string | null
  created_at: string
  updated_at: string
  table?: {
    id: string
    table_number: string
    name: string | null
  } | null
  customer?: {
    id: string
    name: string
  } | null
}

export interface CreateReservationRequest {
  table_id?: string | null
  customer_id?: string | null
  customer_name: string
  customer_phone?: string | null
  reservation_date: string
  reservation_time: string
  party_size: number
  status?: ReservationStatus
  special_requests?: string | null
  note?: string | null
}

export interface UpdateReservationRequest {
  table_id?: string | null
  customer_name?: string
  customer_phone?: string | null
  reservation_date?: string
  reservation_time?: string
  party_size?: number
  status?: ReservationStatus
  special_requests?: string | null
  note?: string | null
}

export const reservationsService = {
  /**
   * Crea una nueva reserva
   */
  async createReservation(data: CreateReservationRequest): Promise<Reservation> {
    const response = await api.post<Reservation>('/reservations', data)
    return response.data
  },

  /**
   * Obtiene todas las reservas de la tienda
   */
  async getReservations(date?: Date): Promise<Reservation[]> {
    const params = date ? `?date=${date.toISOString().split('T')[0]}` : ''
    const response = await api.get<Reservation[]>(`/reservations${params}`)
    return response.data
  },

  /**
   * Obtiene una reserva por ID
   */
  async getReservationById(id: string): Promise<Reservation> {
    const response = await api.get<Reservation>(`/reservations/${id}`)
    return response.data
  },

  /**
   * Actualiza una reserva
   */
  async updateReservation(
    id: string,
    data: UpdateReservationRequest
  ): Promise<Reservation> {
    const response = await api.put<Reservation>(`/reservations/${id}`, data)
    return response.data
  },

  /**
   * Asigna automáticamente una mesa a una reserva
   */
  async assignTable(id: string): Promise<Reservation> {
    const response = await api.post<Reservation>(`/reservations/${id}/assign-table`)
    return response.data
  },

  /**
   * Marca una reserva como sentada
   */
  async markAsSeated(id: string): Promise<Reservation> {
    const response = await api.post<Reservation>(`/reservations/${id}/seat`)
    return response.data
  },

  /**
   * Cancela una reserva
   */
  async cancelReservation(id: string): Promise<Reservation> {
    const response = await api.post<Reservation>(`/reservations/${id}/cancel`)
    return response.data
  },

  /**
   * Elimina una reserva
   */
  async deleteReservation(id: string): Promise<void> {
    await api.delete(`/reservations/${id}`)
  },
}
