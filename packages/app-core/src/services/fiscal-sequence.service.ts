import { api } from '../runtime/api'
import { db, type LocalFiscalRange } from '../db/database'
import { createLogger } from '../lib/logger'
import { useAuth } from '../stores/auth.store'

const logger = createLogger('FiscalSequence')

export interface FiscalRangeResponse {
    id?: string
    store_id?: string
    series_id?: string
    device_id?: string
    range_start: number
    range_end: number
    used_up_to?: number
    status?: 'active' | 'exhausted' | 'expired'
    granted_at?: string
    expires_at: string
}

interface FiscalContext {
    storeId: string
    deviceId: string
}

interface ActiveRangeResponse {
    has_range: boolean
    id?: string
    store_id?: string
    series_id?: string
    device_id?: string
    range_start?: number
    range_end?: number
    used_up_to?: number
    status?: 'active' | 'exhausted' | 'expired'
    granted_at?: string
    expires_at?: string
}

const reserveInFlight = new Map<string, Promise<LocalFiscalRange | null>>()

export const fiscalSequenceService = {
    getSessionContext(): FiscalContext {
        if (typeof localStorage === 'undefined') throw new Error('localStorage is required')
        const deviceId = localStorage.getItem('device_id')
        const storeId = useAuth.getState().user?.store_id

        if (!deviceId) throw new Error('Device ID not found')
        if (!storeId) throw new Error('Store ID not found in session')

        return { storeId, deviceId }
    },

    buildFallbackRangeId(
        context: FiscalContext,
        seriesId: string,
        rangeStart: number,
        rangeEnd: number,
    ): string {
        return `local-${context.storeId}-${seriesId}-${context.deviceId}-${rangeStart}-${rangeEnd}`
    },

    normalizeRangeFromServer(
        context: FiscalContext,
        seriesId: string,
        range: FiscalRangeResponse,
    ): LocalFiscalRange {
        const rangeStart = Number(range.range_start)
        const rangeEnd = Number(range.range_end)
        const expiresAt = new Date(range.expires_at).getTime()

        if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd < rangeStart) {
            throw new Error('Respuesta inválida de rango fiscal (range_start/range_end)')
        }
        if (!Number.isFinite(expiresAt)) {
            throw new Error('Respuesta inválida de rango fiscal (expires_at)')
        }

        const resolvedStoreId = range.store_id || context.storeId
        const resolvedSeriesId = range.series_id || seriesId
        const resolvedDeviceId = range.device_id || context.deviceId

        const requestedUsedUpTo = Number(range.used_up_to)
        const usedUpTo = Number.isFinite(requestedUsedUpTo)
            ? Math.max(rangeStart - 1, Math.min(requestedUsedUpTo, rangeEnd))
            : rangeStart - 1

        const grantedAt = range.granted_at ? new Date(range.granted_at).getTime() : Date.now()

        return {
            id: range.id || this.buildFallbackRangeId(context, resolvedSeriesId, rangeStart, rangeEnd),
            store_id: resolvedStoreId,
            series_id: resolvedSeriesId,
            device_id: resolvedDeviceId,
            range_start: rangeStart,
            range_end: rangeEnd,
            used_up_to: usedUpTo,
            status: 'active',
            granted_at: Number.isFinite(grantedAt) ? grantedAt : Date.now(),
            expires_at: expiresAt,
        }
    },

    async getBestActiveLocalRange(seriesId: string, context: FiscalContext): Promise<LocalFiscalRange | null> {
        const now = Date.now()
        const activeRanges = await db.fiscalRanges
            .where('[store_id+series_id+device_id+status]')
            .equals([context.storeId, seriesId, context.deviceId, 'active'])
            .toArray()

        if (activeRanges.length === 0) return null

        const expired = activeRanges.filter((range) => range.expires_at < now)
        if (expired.length > 0) {
            await Promise.all(expired.map((range) => db.fiscalRanges.update(range.id, { status: 'expired' })))
        }

        const valid = activeRanges
            .filter((range) => range.expires_at >= now)
            .sort((a, b) => {
                const remainingA = a.range_end - a.used_up_to
                const remainingB = b.range_end - b.used_up_to
                if (remainingA !== remainingB) return remainingB - remainingA
                return Number(b.granted_at || 0) - Number(a.granted_at || 0)
            })

        return valid[0] || null
    },

    async hydrateActiveRangeFromServer(seriesId: string): Promise<LocalFiscalRange | null> {
        const context = this.getSessionContext()
        const response = await api.get<ActiveRangeResponse>('/fiscal/active-range', {
            params: {
                store_id: context.storeId,
                series_id: seriesId,
                device_id: context.deviceId,
            },
        })

        const data = response.data
        if (!data?.has_range) return null
        if (
            data.range_start == null
            || data.range_end == null
            || data.expires_at == null
        ) {
            throw new Error('Respuesta inválida de /fiscal/active-range')
        }

        const localRange = this.normalizeRangeFromServer(context, seriesId, {
            id: data.id,
            store_id: data.store_id,
            series_id: data.series_id,
            device_id: data.device_id,
            range_start: data.range_start,
            range_end: data.range_end,
            used_up_to: data.used_up_to,
            status: data.status,
            granted_at: data.granted_at,
            expires_at: data.expires_at,
        })

        await db.fiscalRanges.put(localRange)
        return localRange
    },

    /**
     * Reserva un nuevo rango fiscal desde el servidor
     */
    async reserveRange(seriesId: string): Promise<LocalFiscalRange> {
        const context = this.getSessionContext()

        try {
            const response = await api.post<FiscalRangeResponse>('/fiscal/reserve-range', {
                store_id: context.storeId,
                series_id: seriesId,
                device_id: context.deviceId,
            })

            const localRange = this.normalizeRangeFromServer(context, seriesId, response.data)

            await db.fiscalRanges.put(localRange)
            logger.info(`🛡️ Rango fiscal reservado: ${localRange.range_start} - ${localRange.range_end}`)
            return localRange
        } catch (error: unknown) {
            const httpError = error as {
                response?: { status?: number; data?: { message?: string } };
                message?: string;
            }
            const status = Number(httpError?.response?.status || 0)
            const message = String(httpError?.response?.data?.message || httpError?.message || '')

            if (status === 400 && message.toLowerCase().includes('already has an active range')) {
                logger.warn('Rango activo ya existe en servidor; hidratando estado local')
                const hydrated = await this.hydrateActiveRangeFromServer(seriesId)
                if (hydrated) return hydrated
            }

            logger.error('Error reservando rango fiscal:', error)
            throw error
        }
    },

    async ensureAvailability(
        seriesId: string,
        minRemaining: number = 5,
    ): Promise<{ available: boolean; remaining: number; source: 'local' | 'reserved' | 'none' }> {
        const normalizedMin = Math.max(1, Math.floor(minRemaining))
        const initialStatus = await this.getLocalStatus(seriesId)
        if (initialStatus && initialStatus.totalRemaining >= normalizedMin) {
            return {
                available: true,
                remaining: initialStatus.totalRemaining,
                source: 'local',
            }
        }

        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false
        if (!isOnline) {
            return {
                available: Boolean(initialStatus && initialStatus.totalRemaining > 0),
                remaining: initialStatus?.totalRemaining || 0,
                source: 'none',
            }
        }

        const context = this.getSessionContext()
        const lockKey = `${context.storeId}:${seriesId}:${context.deviceId}`
        const existingJob = reserveInFlight.get(lockKey)
        const reserveJob = existingJob || (async () => {
            try {
                return await this.reserveRange(seriesId)
            } catch (reserveError) {
                logger.warn('No se pudo reservar rango fiscal en ensureAvailability', {
                    seriesId,
                    error: reserveError instanceof Error ? reserveError.message : String(reserveError),
                })
                return await this.hydrateActiveRangeFromServer(seriesId).catch(() => null)
            }
        })()

        if (!existingJob) {
            reserveInFlight.set(lockKey, reserveJob)
        }

        try {
            await reserveJob
        } finally {
            if (!existingJob) {
                reserveInFlight.delete(lockKey)
            }
        }

        const afterStatus = await this.getLocalStatus(seriesId)
        return {
            available: Boolean(afterStatus && afterStatus.totalRemaining > 0),
            remaining: afterStatus?.totalRemaining || 0,
            source: afterStatus ? 'reserved' : 'none',
        }
    },

    async prefetchForSeries(seriesIds: string[], minRemaining: number = 5): Promise<void> {
        if (!Array.isArray(seriesIds) || seriesIds.length === 0) return
        const uniqueSeriesIds = Array.from(
            new Set(seriesIds.filter((seriesId): seriesId is string => typeof seriesId === 'string' && seriesId.length > 0)),
        )
        if (uniqueSeriesIds.length === 0) return
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false
        if (!isOnline) return

        await Promise.allSettled(uniqueSeriesIds.map((seriesId) => this.ensureAvailability(seriesId, minRemaining)))
    },

    /**
     * Obtiene el siguiente número fiscal disponible para una serie (Offline-Safe)
     */
    async consumeNext(seriesId: string): Promise<number> {
        const context = this.getSessionContext()

        for (let attempt = 0; attempt < 3; attempt++) {
            const activeRange = await this.getBestActiveLocalRange(seriesId, context)
            if (!activeRange) {
                const ensured = await this.ensureAvailability(seriesId, 1)
                if (!ensured.available) {
                    throw new Error('Sin números fiscales disponibles offline. Por favor, conéctate a internet para obtener más.')
                }
                continue
            }

            if (activeRange.expires_at < Date.now()) {
                logger.warn(`Rango fiscal ${activeRange.id} ha expirado. Marcando como expirado.`)
                await db.fiscalRanges.update(activeRange.id, { status: 'expired' })
                continue
            }

            return this.consumeFromRange(activeRange)
        }

        throw new Error('Sin números fiscales disponibles offline. Por favor, conéctate a internet para obtener más.')
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
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false

        if (isOnline && remaining < total * 0.2) {
            this.ensureAvailability(range.series_id, Math.max(5, Math.ceil(total * 0.3))).catch(() => {
                logger.warn('Precarga de rango fiscal en background fallida')
            })
        }

        return nextValue
    },

    /**
     * Obtiene estadísticas de rangos locales
     */
    async getLocalStatus(seriesId: string) {
        let context: FiscalContext
        try {
            context = this.getSessionContext()
        } catch {
            return null
        }

        const now = Date.now()
        const activeRanges = await db.fiscalRanges
            .where('[store_id+series_id+device_id+status]')
            .equals([context.storeId, seriesId, context.deviceId, 'active'])
            .toArray()

        const expiredRanges = activeRanges.filter((range) => range.expires_at < now)
        if (expiredRanges.length > 0) {
            await Promise.all(expiredRanges.map((range) => db.fiscalRanges.update(range.id, { status: 'expired' })))
        }

        const ranges = activeRanges.filter((range) => range.expires_at >= now)

        let totalRemaining = 0
        ranges.forEach(r => {
            totalRemaining += Math.max(0, r.range_end - r.used_up_to)
        })

        return {
            activeRangesCount: ranges.length,
            totalRemaining,
            isLow: totalRemaining < 5,
        }
    }
}
