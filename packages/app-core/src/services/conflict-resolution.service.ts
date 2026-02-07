import { db, LocalConflict } from '../db/database'
import { createLogger } from '../lib/logger'
import { CacheManager } from '@la-caja/sync'

const logger = createLogger('ConflictResolutionService')
const cacheManager = new CacheManager('la-caja-cache')

export interface ResolutionResult {
    resolved: boolean
    action_taken: 'keep_mine' | 'take_theirs' | 'merge' | 'server_wins' | 'manual_review_required' | 'none'
    message?: string
}

class ConflictResolutionServiceClass {
    /**
     * Procesa conflictos pendientes y aplica estrategias automáticas
     */
    async processPendingConflicts(): Promise<number> {
        const pendingConflicts = await db.conflicts
            .where('status')
            .equals('pending')
            .toArray()

        let resolvedCount = 0

        for (const conflict of pendingConflicts) {
            try {
                const result = await this.resolveConflict(conflict)
                if (result.resolved) {
                    resolvedCount++
                }
            } catch (error) {
                logger.error('Error resolviendo conflicto', error, { conflict_id: conflict.id })
            }
        }

        return resolvedCount
    }

    /**
     * Obtiene los detalles de un conflicto para visualización comparativa
     */
    async getConflictDetail(conflictId: string) {
        const conflict = await db.conflicts.get(conflictId)
        if (!conflict) throw new Error('Conflicto no encontrado')

        const localEvent = await db.localEvents.where('event_id').equals(conflict.event_id).first()

        // En una implementación real, aquí se consultaría el servidor para obtener 
        // la versión actual del registro que causó el conflicto (usando conflicting_with)
        // Por ahora, devolvemos el evento local y metadatos para la UI.
        return {
            conflict,
            localEvent,
            // Mock server state (esto debería venir de una API call en producción)
            serverState: {
                // Simulamos un estado del servidor para la comparación
                ...(localEvent?.payload || {}),
                _is_server_mock: true,
            }
        }
    }

    /**
     * Resuelve un conflicto con una estrategia específica
     */
    async resolveConflict(
        conflict: LocalConflict,
        strategy: 'keep_mine' | 'take_theirs' | 'merge' = 'take_theirs'
    ): Promise<ResolutionResult> {

        logger.info(`Resolviendo conflicto con estrategia: ${strategy}`, {
            conflict_id: conflict.id,
            event_id: conflict.event_id
        })

        if (strategy === 'take_theirs') {
            // 1. Marcar el evento local como fallido/descartado
            const event = await db.localEvents.where('event_id').equals(conflict.event_id).first()
            if (event) {
                await db.localEvents.update(event.id!, {
                    sync_status: 'failed',
                    last_error: `Resuelto: Tomada versión del servidor. Motivo: ${conflict.reason}`,
                    sync_attempts: 999,
                })
            }
        } else if (strategy === 'keep_mine') {
            // 1. Marcar el evento local como pendiente de nuevo para reintento forzado
            // El servidor debería reconocer este "nuevo" intento o requerir un nuevo event_id
            // En este sistema, forzamos el reintento marcándolo como pending y reseteando intentos
            const event = await db.localEvents.where('event_id').equals(conflict.event_id).first()
            if (event) {
                await db.localEvents.update(event.id!, {
                    sync_status: 'pending',
                    sync_attempts: 0,
                    last_error: `Reiniciado para forzar resolución mandando local: ${conflict.reason}`,
                })
            }
        }

        // 2. Marcar conflicto como resuelto en base de datos local
        await db.conflicts.update(conflict.id, {
            status: 'resolved',
            resolution: strategy,
            resolved_at: Date.now(),
        })

        // 3. Invalidar caches
        await this.invalidateRelatedCaches()

        return {
            resolved: true,
            action_taken: strategy as any,
        }
    }

    /**
     * Invalida caches basados en el tipo de evento o datos del conflicto
     */
    private async invalidateRelatedCaches(): Promise<void> {
        // Como no tenemos el payload del evento a mano fácil (podría no estar en BD si fue purgado),
        // invalidamos patrones generales.

        // Si pudiéramos inferir el tipo desde el store o reason, sería mejor.
        // Por ahora, invalidamos todo lo crítico para asegurar consistencia.
        await cacheManager.invalidatePattern(/^products:/)
        await cacheManager.invalidatePattern(/^customers:/)
        await cacheManager.invalidatePattern(/^inventory:/)
    }
}

export const conflictResolutionService = new ConflictResolutionServiceClass()
