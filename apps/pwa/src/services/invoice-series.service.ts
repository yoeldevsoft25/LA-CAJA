import { api } from '@/lib/api'

export interface InvoiceSeries {
  id: string
  store_id: string
  series_code: string
  name: string
  prefix: string | null
  current_number: number
  start_number: number
  is_active: boolean
  note: string | null
  created_at: string
  updated_at: string
}

export interface CreateInvoiceSeriesRequest {
  series_code: string
  name: string
  prefix?: string | null
  start_number?: number
  is_active?: boolean
  note?: string | null
}

export interface UpdateInvoiceSeriesRequest {
  name?: string
  prefix?: string | null
  start_number?: number
  is_active?: boolean
  note?: string | null
}

export const invoiceSeriesService = {
  /**
   * Crea una nueva serie de factura
   */
  async createSeries(data: CreateInvoiceSeriesRequest): Promise<InvoiceSeries> {
    const response = await api.post<InvoiceSeries>('/invoice-series', data)
    return response.data
  },

  /**
   * Obtiene todas las series de la tienda
   */
  async getSeriesByStore(): Promise<InvoiceSeries[]> {
    const response = await api.get<InvoiceSeries[]>('/invoice-series')
    return response.data
  },

  /**
   * Obtiene una serie por ID
   */
  async getSeriesById(id: string): Promise<InvoiceSeries> {
    const response = await api.get<InvoiceSeries>(`/invoice-series/${id}`)
    return response.data
  },

  /**
   * Obtiene una serie por código
   */
  async getSeriesByCode(code: string): Promise<InvoiceSeries> {
    const response = await api.get<InvoiceSeries>(`/invoice-series/code/${code}`)
    return response.data
  },

  /**
   * Obtiene la serie por defecto (primera serie activa)
   */
  async getDefaultSeries(): Promise<InvoiceSeries | null> {
    try {
      const response = await api.get<InvoiceSeries>('/invoice-series/default/active')
      return response.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  /**
   * Actualiza una serie de factura
   */
  async updateSeries(id: string, data: UpdateInvoiceSeriesRequest): Promise<InvoiceSeries> {
    const response = await api.put<InvoiceSeries>(`/invoice-series/${id}`, data)
    return response.data
  },

  /**
   * Elimina una serie de factura
   */
  async deleteSeries(id: string): Promise<void> {
    await api.delete(`/invoice-series/${id}`)
  },

  /**
   * Reinicia el consecutivo de una serie
   */
  async resetSeriesNumber(id: string, newNumber: number): Promise<InvoiceSeries> {
    const response = await api.put<InvoiceSeries>(`/invoice-series/${id}/reset`, {
      new_number: newNumber,
    })
    return response.data
  },
}

