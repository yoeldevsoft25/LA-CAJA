import { api } from '@/lib/api'
import { db } from '@/db/database'
import { syncService } from './sync.service'
import { BaseEvent } from '@la-caja/domain'
import { createLogger } from '@/lib/logger'
import { randomUUID } from '@/lib/uuid'

const logger = createLogger('CashService')

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
    const isOnline = navigator.onLine
    const sessionId = randomUUID()
    const now = Date.now()

    if (!isOnline) {
      logger.info('Modo OFFLINE - Encolando apertura de sesión de caja')
      const storeId = localStorage.getItem('store_id') || ''
      const userId = localStorage.getItem('user_id') || ''

      const session: CashSession = {
        id: sessionId,
        store_id: storeId,
        opened_by: userId,
        opened_at: new Date(now).toISOString(),
        closed_by: null,
        closed_at: null,
        opening_amount_bs: data.cash_bs,
        opening_amount_usd: data.cash_usd,
        expected: null,
        counted: null,
        note: data.note || null,
      }

      const event: BaseEvent = {
        event_id: randomUUID(),
        store_id: storeId,
        device_id: localStorage.getItem('device_id') || 'unknown',
        seq: 0,
        type: 'CashSessionOpened',
        version: 1,
        created_at: now,
        actor: { user_id: userId, role: 'cashier' },
        payload: {
          session_id: sessionId,
          opened_at: session.opened_at,
          opening_amount_bs: data.cash_bs,
          opening_amount_usd: data.cash_usd,
          note: data.note,
        },
      }

      await syncService.enqueueEvent(event)
      await saveCurrentSessionCache(session)
      return session
    }

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
    const isOnline = navigator.onLine

    if (!isOnline) {
      logger.info('Modo OFFLINE - Encolando cierre de sesión de caja')
      const storeId = localStorage.getItem('store_id') || ''
      const userId = localStorage.getItem('user_id') || ''

      // Obtener sesión actual para el mock de retorno
      const currentSession = await getCurrentSessionFromCache()
      const closedSession: CashSession = {
        ...(currentSession || {
          id: sessionId,
          store_id: storeId,
          opened_by: userId,
          opened_at: new Date().toISOString(),
          opening_amount_bs: 0,
          opening_amount_usd: 0,
          expected: null,
          counted: null,
          note: null,
        }),
        closed_by: userId,
        closed_at: new Date().toISOString(),
        expected: currentSession?.expected || null,
        counted: {
          cash_bs: data.counted_bs,
          cash_usd: data.counted_usd,
        },
        note: data.note || null,
      }

      const event: BaseEvent = {
        event_id: randomUUID(),
        store_id: storeId,
        device_id: localStorage.getItem('device_id') || 'unknown',
        seq: 0,
        type: 'CashSessionClosed',
        version: 1,
        created_at: Date.now(),
        actor: { user_id: userId, role: 'cashier' },
        payload: {
          session_id: sessionId,
          closed_at: closedSession.closed_at,
          counted: closedSession.counted,
          note: data.note,
        },
      }

      await syncService.enqueueEvent(event)
      await saveCurrentSessionCache(null)
      return closedSession
    }

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
