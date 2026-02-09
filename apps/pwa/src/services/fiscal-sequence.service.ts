import { api } from '@/lib/api'
import { db, type LocalFiscalRange } from '@/db/database'
import { createLogger } from '@/lib/logger'
import { useAuth } from '@/stores/auth.store'

const logger = createLogger('FiscalSequence')

export interface FiscalRangeResponse {
    id: string
    store_id: string
    series_id: string
    device_id: string
    range_start: number
    range_end: number
    expires_at: string
}

export const fiscalSequenceService = {
    /**
     * Reserva un nuevo rango fiscal desde el servidor
     */
    async reserveRange(seriesId: string): Promise<LocalFiscalRange> {
        const deviceId = localStorage.getItem('device_id')
        if (!deviceId) throw new Error('Device ID not found')

        try {
            const response = await api.post<FiscalRangeResponse>('/fiscal/reserve-range', {
                series_id: seriesId,
                device_id: deviceId,
            })

            const range = response.data
            const localRange: LocalFiscalRange = {
                id: range.id,
                store_id: range.store_id,
                series_id: range.series_id,
                device_id: range.device_id,
                range_start: range.range_start,
                range_end: range.range_end,
                used_up_to: range.range_start - 1,
                status: 'active',
                granted_at: Date.now(),
                expires_at: new Date(range.expires_at).getTime(),
            }

            await db.fiscalRanges.put(localRange)
            logger.info(`🛡️ Rango fiscal reservado: ${localRange.range_start} - ${localRange.range_end}`)
            return localRange
        } catch (error: any) {
            logger.error('Error reservando rango fiscal:', error)
            throw error
        }
    },

    /**
     * Obtiene el siguiente número fiscal disponible para una serie (Offline-Safe)
     */
    async consumeNext(seriesId: string): Promise<number> {
        const deviceId = localStorage.getItem('device_id')
        const storeId = useAuth.getState().user?.store_id

        if (!deviceId) throw new Error('Device ID not found')
        if (!storeId) throw new Error('Store ID not found in session')

        // 1. Buscar rango activo en IndexedDB
        const activeRange = await db.fiscalRanges
            .where('[store_id+series_id+device_id+status]')
            .equals([storeId, seriesId, deviceId, 'active'])
            .first()

        if (!activeRange) {
            // Intentar reservar uno nuevo si estamos online
            if (navigator.onLine) {
                logger.info('No hay rango activo local, intentando reservar uno nuevo...')
                const newRange = await this.reserveRange(seriesId)
                return this.consumeFromRange(newRange)
            }
            throw new Error('Sin números fiscales disponibles offline. Por favor, conéctate a internet para obtener más.')
        }

        // 2. Verificar vencimiento
        if (activeRange.expires_at < Date.now()) {
            logger.warn(`Rango fiscal ${activeRange.id} ha expirado. Marcando como expirado.`)
            await db.fiscalRanges.update(activeRange.id, { status: 'expired' })
            return this.consumeNext(seriesId) // Reintentar (buscará otro activo o reservará)
        }

        return this.consumeFromRange(activeRange)
    },

    /**
     * Procesa el consumo de un número dentro de un rango
     */
    async consumeFromRange(range: LocalFiscalRange): Promise<number> {
        const nextValue = range.used_up_to + 1

        if (nextValue > range.range_end) {
            logger.warn(`Rango fiscal ${range.id} agotado (${range.range_end}).`)
            await db.fiscalRanges.update(range.id, { status: 'exhausted' })
            // Si se agotó, intentamos el siguiente (recursivo)
            return this.consumeNext(range.series_id)
        }

        // Actualizar uso localmente
        await db.fiscalRanges.update(range.id, { used_up_to: nextValue })

        // 🚀 Optimización: Si queda poco espacio (e.g. 20%), precargar el siguiente rango en background si estamos online
        const remaining = range.range_end - nextValue
        const total = range.range_end - range.range_start + 1
        if (navigator.onLine && remaining < total * 0.2) {
            // Verificar si ya hay otro rango activo o pendiente (esto es opcional pero bueno por seguridad)
            this.reserveRange(range.series_id).catch(() => {
                // No bloqueamos el flujo principal si la precarga falla
                logger.warn('Precarga de rango fiscal en background fallida (se reintentará luego)')
            })
        }

        return nextValue
    },

    /**
     * Obtiene estadísticas de rangos locales
     */
    async getLocalStatus(seriesId: string) {
        const deviceId = localStorage.getItem('device_id')
        const storeId = useAuth.getState().user?.store_id
        if (!deviceId || !storeId) return null

        const ranges = await db.fiscalRanges
            .where('[store_id+series_id+device_id+status]')
            .equals([storeId, seriesId, deviceId, 'active'])
            .toArray()

        let totalRemaining = 0
        ranges.forEach(r => {
            totalRemaining += Math.max(0, r.range_end - r.used_up_to)
        })

        return {
            activeRangesCount: ranges.length,
            totalRemaining,
            isLow: totalRemaining < 5, // Alerta si quedan menos de 5
        }
    }
}
