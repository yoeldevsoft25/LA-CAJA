import { api } from '@/lib/api'

export interface CashSession {
  id: string
  store_id: string
  opened_by: string | null
  opened_at: string
  closed_by: string | null
  closed_at: string | null
  opening_amount_bs: number | string
  opening_amount_usd: number | string
  expected: {
    cash_bs: number
    cash_usd: number
    by_method?: Record<string, number>
  } | null
  counted: {
    cash_bs: number
    cash_usd: number
  } | null
  note: string | null
}

export interface OpenCashSessionRequest {
  cash_bs: number
  cash_usd: number
  note?: string
}

export interface CloseCashSessionRequest {
  counted_bs: number
  counted_usd: number
  note?: string
}

export interface CashSessionSummary {
  session: CashSession
  sales_count: number
  sales: {
    total_bs: number
    total_usd: number
    by_method: {
      CASH_BS: number
      CASH_USD: number
      PAGO_MOVIL: number
      TRANSFER: number
      OTHER: number
      FIAO: number
      SPLIT: number
    }
  }
  cash_flow: {
    opening_bs: number
    opening_usd: number
    sales_bs: number
    sales_usd: number
    movements_bs: number
    movements_usd: number
    expected_bs: number
    expected_usd: number
  }
  closing?: {
    expected: {
      cash_bs: number
      cash_usd: number
    }
    counted: {
      cash_bs: number
      cash_usd: number
    }
    difference_bs: number
    difference_usd: number
    note: string | null
  }
}

export interface CashSessionsResponse {
  sessions: CashSession[]
  total: number
}

export const cashService = {
  async openSession(data: OpenCashSessionRequest): Promise<CashSession> {
    const response = await api.post<CashSession>('/cash/sessions/open', data)
    return response.data
  },

  async getCurrentSession(): Promise<CashSession | null> {
    const response = await api.get<CashSession | null>('/cash/sessions/current')
    return response.data
  },

  async closeSession(sessionId: string, data: CloseCashSessionRequest): Promise<CashSession> {
    const response = await api.post<CashSession>(`/cash/sessions/${sessionId}/close`, data)
    return response.data
  },

  async getSessionSummary(sessionId: string): Promise<CashSessionSummary> {
    const response = await api.get<CashSessionSummary>(`/cash/sessions/${sessionId}/summary`)
    return response.data
  },

  async listSessions(params?: {
    limit?: number
    offset?: number
  }): Promise<CashSessionsResponse> {
    const response = await api.get<CashSessionsResponse>('/cash/sessions', { params })
    return response.data
  },
}
