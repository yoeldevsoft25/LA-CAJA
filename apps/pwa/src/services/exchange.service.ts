import { api } from '@/lib/api'
import { db } from '@/db/database'

export interface BCVRateResponse {
  rate: number | null
  source: 'api' | 'manual' | null
  timestamp: string | null
  available: boolean
  message?: string
}

const EXCHANGE_RATE_KEY = 'bcv_exchange_rate'
const EXCHANGE_RATE_TIMESTAMP_KEY = 'bcv_exchange_rate_timestamp'

export const exchangeService = {
  async getBCVRate(force = false): Promise<BCVRateResponse> {
    const isOnline = navigator.onLine

    // Si está offline, intentar obtener del cache local
    if (!isOnline) {
      try {
        const cachedRate = await db.kv.get(EXCHANGE_RATE_KEY)
        const cachedTimestamp = await db.kv.get(EXCHANGE_RATE_TIMESTAMP_KEY)

        if (cachedRate?.value && cachedTimestamp?.value) {
          return {
            rate: cachedRate.value,
            source: 'api',
            timestamp: cachedTimestamp.value,
            available: true,
            message: 'Tasa obtenida del cache local (modo offline)',
          }
        }

        // Si no hay cache, retornar no disponible
        return {
          rate: null,
          source: null,
          timestamp: null,
          available: false,
          message: 'No hay tasa de cambio guardada. Necesitas conexión para obtenerla.',
        }
      } catch (error) {
        console.error('Error obteniendo tasa del cache:', error)
        return {
          rate: null,
          source: null,
          timestamp: null,
          available: false,
          message: 'Error al acceder al cache local',
        }
      }
    }

    // Si está online, obtener del API y guardar en cache
    try {
      const response = await api.get<BCVRateResponse>('/exchange/bcv', {
        params: force ? { force: 'true' } : {},
      })

      // CRÍTICO: Guardar en cache local SIEMPRE si la tasa está disponible
      // Esto asegura que esté disponible offline
      if (response.data.available && response.data.rate) {
        try {
          await Promise.all([
            db.kv.put({ key: EXCHANGE_RATE_KEY, value: response.data.rate }),
            db.kv.put({
            key: EXCHANGE_RATE_TIMESTAMP_KEY,
            value: response.data.timestamp || new Date().toISOString(),
            }),
          ])
          console.log('[Exchange] ✅ Tasa BCV guardada en IndexedDB:', response.data.rate)
        } catch (error) {
          console.error('[Exchange] ❌ Error guardando tasa en IndexedDB:', error)
          // No fallar si no se puede guardar en cache, pero loguear el error
        }
      }

      return response.data
    } catch (error: any) {
      // Si falla la llamada pero tenemos cache, usar el cache
      if (!force) {
        try {
          const cachedRate = await db.kv.get(EXCHANGE_RATE_KEY)
          const cachedTimestamp = await db.kv.get(EXCHANGE_RATE_TIMESTAMP_KEY)

          if (cachedRate?.value && cachedTimestamp?.value) {
            return {
              rate: cachedRate.value,
              source: 'api',
              timestamp: cachedTimestamp.value,
              available: true,
              message: 'Tasa obtenida del cache local (fallo de conexión)',
            }
          }
        } catch (cacheError) {
          console.error('Error obteniendo tasa del cache después de fallo:', cacheError)
        }
      }

      // Si no hay cache o force=true, retornar error
      return {
        rate: null,
        source: null,
        timestamp: null,
        available: false,
        message: error.response?.data?.message || 'Error al obtener la tasa de cambio',
      }
    }
  },

  /**
   * Obtiene la tasa de cambio del cache local (sin intentar obtener del API)
   */
  async getCachedRate(): Promise<BCVRateResponse> {
    try {
      const cachedRate = await db.kv.get(EXCHANGE_RATE_KEY)
      const cachedTimestamp = await db.kv.get(EXCHANGE_RATE_TIMESTAMP_KEY)

      if (cachedRate?.value && cachedTimestamp?.value) {
        return {
          rate: cachedRate.value,
          source: 'api',
          timestamp: cachedTimestamp.value,
          available: true,
          message: 'Tasa obtenida del cache local',
        }
      }

      return {
        rate: null,
        source: null,
        timestamp: null,
        available: false,
        message: 'No hay tasa de cambio guardada en cache',
      }
    } catch (error) {
      console.error('Error obteniendo tasa del cache:', error)
      return {
        rate: null,
        source: null,
        timestamp: null,
        available: false,
        message: 'Error al acceder al cache local',
      }
    }
  },
}

