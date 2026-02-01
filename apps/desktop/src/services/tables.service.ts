import { api } from '@/lib/api'

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'out_of_service'

export interface Table {
  id: string
  store_id: string
  table_number: string
  name: string | null
  capacity: number | null
  status: TableStatus
  current_order_id: string | null
  zone: string | null
  coordinates: { x: number; y: number } | null
  estimated_dining_time: number | null
  note: string | null
  created_at: string
  updated_at: string
  currentOrder?: {
    id: string
    order_number: string
    status: string
  } | null
  qrCode?: {
    id: string
    qr_code: string
    public_url: string
  } | null
}

export interface CreateTableRequest {
  table_number: string
  name?: string | null
  capacity?: number | null
  status?: TableStatus
  zone?: string | null
  coordinates?: { x: number; y: number } | null
  estimated_dining_time?: number | null
  note?: string | null
}

export interface UpdateTableRequest {
  table_number?: string
  name?: string | null
  capacity?: number | null
  status?: TableStatus
  zone?: string | null
  coordinates?: { x: number; y: number } | null
  estimated_dining_time?: number | null
  note?: string | null
}

export const tablesService = {
  /**
   * Crea una nueva mesa
   */
  async createTable(data: CreateTableRequest): Promise<Table> {
    const response = await api.post<Table>('/tables', data)
    return response.data
  },

  /**
   * Obtiene todas las mesas de la tienda
   */
  async getTablesByStore(status?: TableStatus): Promise<Table[]> {
    const params = status ? `?status=${status}` : ''
    const response = await api.get<Table[]>(`/tables${params}`)
    return response.data
  },

  /**
   * Obtiene una mesa por ID
   */
  async getTableById(id: string): Promise<Table> {
    const response = await api.get<Table>(`/tables/${id}`)
    return response.data
  },

  /**
   * Actualiza una mesa
   */
  async updateTable(id: string, data: UpdateTableRequest): Promise<Table> {
    const response = await api.put<Table>(`/tables/${id}`, data)
    return response.data
  },

  /**
   * Actualiza el estado de una mesa
   */
  async updateTableStatus(id: string, status: TableStatus): Promise<Table> {
    const response = await api.put<Table>(`/tables/${id}/status`, { status })
    return response.data
  },

  /**
   * Elimina una mesa
   */
  async deleteTable(id: string): Promise<void> {
    await api.delete(`/tables/${id}`)
  },
}

