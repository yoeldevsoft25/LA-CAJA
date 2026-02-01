import { api } from '@/lib/api'

export type ShiftStatus = 'open' | 'closed' | 'cancelled'
export type CutType = 'X' | 'Z'

export interface Shift {
  id: string
  store_id: string
  cashier_id: string
  opened_at: string
  closed_at: string | null
  opening_amount_bs: number | string
  opening_amount_usd: number | string
  closing_amount_bs: number | string | null
  closing_amount_usd: number | string | null
  expected_totals: {
    cash_bs: number
    cash_usd: number
    pago_movil_bs: number
    transfer_bs: number
    other_bs: number
    total_bs: number
    total_usd: number
  } | null
  counted_totals: {
    cash_bs: number
    cash_usd: number
    pago_movil_bs: number
    transfer_bs: number
    other_bs: number
  } | null
  difference_bs: number | string | null
  difference_usd: number | string | null
  note: string | null
  status: ShiftStatus
  created_at: string
  cuts?: ShiftCut[]
}

export interface ShiftCut {
  id: string
  shift_id: string
  cut_type: CutType
  cut_at: string
  totals: {
    sales_count: number
    total_bs: number
    total_usd: number
    by_payment_method: Record<string, number>
    cash_bs: number
    cash_usd: number
    pago_movil_bs: number
    transfer_bs: number
    other_bs: number
  }
  sales_count: number
  printed_at: string | null
  created_by: string
  created_at: string
}

export interface OpenShiftRequest {
  opening_amount_bs: number
  opening_amount_usd: number
  note?: string
}

export interface CloseShiftRequest {
  counted_bs: number
  counted_usd: number
  counted_pago_movil_bs?: number
  counted_transfer_bs?: number
  counted_other_bs?: number
  note?: string
}

export interface ShiftSummary {
  shift: Shift
  sales_count: number
  cuts_count: number
  summary: {
    opening: {
      bs: number | string
      usd: number | string
    }
    expected: {
      cash_bs: number
      cash_usd: number
      pago_movil_bs: number
      transfer_bs: number
      other_bs: number
      total_bs: number
      total_usd: number
    } | null
    counted: {
      cash_bs: number
      cash_usd: number
      pago_movil_bs: number
      transfer_bs: number
      other_bs: number
    } | null
    difference: {
      bs: number | string | null
      usd: number | string | null
    }
  }
}

export interface ShiftsResponse {
  shifts: Shift[]
  total: number
}

export const shiftsService = {
  /**
   * Abre un nuevo turno para el cajero autenticado
   */
  async openShift(data: OpenShiftRequest): Promise<Shift> {
    const response = await api.post<Shift>('/shifts/open', data)
    return response.data
  },

  /**
   * Obtiene el turno actual abierto del cajero autenticado
   */
  async getCurrentShift(): Promise<Shift | null> {
    const response = await api.get<Shift | null>('/shifts/current')
    return response.data
  },

  /**
   * Cierra un turno con arqueo
   */
  async closeShift(shiftId: string, data: CloseShiftRequest): Promise<Shift> {
    const response = await api.post<Shift>(`/shifts/${shiftId}/close`, data)
    return response.data
  },

  /**
   * Crea un corte X (intermedio) para un turno
   */
  async createCutX(shiftId: string): Promise<ShiftCut> {
    const response = await api.post<ShiftCut>(`/shifts/${shiftId}/cut-x`)
    return response.data
  },

  /**
   * Crea un corte Z (final) para un turno cerrado
   */
  async createCutZ(shiftId: string): Promise<ShiftCut> {
    const response = await api.post<ShiftCut>(`/shifts/${shiftId}/cut-z`)
    return response.data
  },

  /**
   * Obtiene todos los cortes de un turno
   */
  async getCuts(shiftId: string): Promise<ShiftCut[]> {
    const response = await api.get<ShiftCut[]>(`/shifts/${shiftId}/cuts`)
    return response.data
  },

  /**
   * Marca un corte como impreso (reimpresión)
   */
  async reprintCut(shiftId: string, cutId: string): Promise<ShiftCut> {
    const response = await api.post<ShiftCut>(`/shifts/${shiftId}/cuts/${cutId}/reprint`)
    return response.data
  },

  /**
   * Obtiene el resumen completo de un turno
   */
  async getShiftSummary(shiftId: string): Promise<ShiftSummary> {
    const response = await api.get<ShiftSummary>(`/shifts/${shiftId}/summary`)
    return response.data
  },

  /**
   * Lista los turnos del cajero autenticado
   */
  async listShifts(params?: {
    limit?: number
    offset?: number
  }): Promise<ShiftsResponse> {
    const response = await api.get<ShiftsResponse>('/shifts', { params })
    return response.data
  },
}

