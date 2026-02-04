import { api } from '@/lib/api'
import { db } from '@/db/database'

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

const STORE_ID_KEY = 'store_id'
const CASH_CURRENT_SESSION_PREFIX = 'cash:current-session'
const CASH_CURRENT_SESSION_LAST_KEY = `${CASH_CURRENT_SESSION_PREFIX}:last`

type CachedCashSessionValue = {
  store_id: string | null
  session: CashSession | null
  cached_at: number
}

function getStoreCacheKey(storeId: string): string {
  return `${CASH_CURRENT_SESSION_PREFIX}:${storeId}`
}

async function getCurrentStoreIdFromKV(): Promise<string | null> {
  try {
    const kv = await db.kv.get(STORE_ID_KEY)
    return typeof kv?.value === 'string' && kv.value.trim().length > 0 ? kv.value : null
  } catch {
    return null
  }
}

async function saveCurrentSessionCache(session: CashSession | null): Promise<void> {
  const storeId = session?.store_id || await getCurrentStoreIdFromKV()
  const payload: CachedCashSessionValue = {
    store_id: storeId,
    session,
    cached_at: Date.now(),
  }

  if (storeId) {
    await db.kv.put({
      key: getStoreCacheKey(storeId),
      value: payload,
    })
  }

  await db.kv.put({
    key: CASH_CURRENT_SESSION_LAST_KEY,
    value: payload,
  })
}

async function getCurrentSessionFromCache(): Promise<CashSession | null> {
  const storeId = await getCurrentStoreIdFromKV()

  if (storeId) {
    const byStore = await db.kv.get(getStoreCacheKey(storeId))
    const value = byStore?.value as CachedCashSessionValue | undefined
    if (value && value.store_id === storeId) {
      return value.session
    }
  }

  const last = await db.kv.get(CASH_CURRENT_SESSION_LAST_KEY)
  const fallback = last?.value as CachedCashSessionValue | undefined
  return fallback?.session ?? null
}

function isTransientNetworkError(error: any): boolean {
  if (!error) return false
  const code = typeof error?.code === 'string' ? error.code : ''
  if (code === 'ERR_NETWORK' || code === 'ERR_INTERNET_DISCONNECTED' || code === 'ECONNABORTED') {
    return true
  }

  if (!error?.response) return true

  const status = Number(error.response?.status || 0)
  return status >= 500
}

export const cashService = {
  async openSession(data: OpenCashSessionRequest): Promise<CashSession> {
    const response = await api.post<CashSession>('/cash/sessions/open', data)
    try {
      await saveCurrentSessionCache(response.data)
    } catch {
      // Ignore cache errors: opening cash on server already succeeded.
    }
    return response.data
  },

  async getCurrentSession(): Promise<CashSession | null> {
    try {
      const response = await api.get<CashSession | null>('/cash/sessions/current')
      try {
        await saveCurrentSessionCache(response.data)
      } catch {
        // Ignore cache write failures.
      }
      return response.data
    } catch (error) {
      if (isTransientNetworkError(error)) {
        return getCurrentSessionFromCache()
      }
      throw error
    }
  },

  async closeSession(sessionId: string, data: CloseCashSessionRequest): Promise<CashSession> {
    const response = await api.post<CashSession>(`/cash/sessions/${sessionId}/close`, data)
    try {
      await saveCurrentSessionCache(null)
    } catch {
      // Ignore cache errors: closing cash on server already succeeded.
    }
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
