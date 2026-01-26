import { db, LocalConflict } from '@/db/database'
import { createLogger } from '@/lib/logger'
import { CacheManager } from '@la-caja/sync'

const logger = createLogger('ConflictResolutionService')
const cacheManager = new CacheManager('la-caja-cache')

export interface ResolutionResult {
    resolved: boolean
    action_taken: 'server_wins' | 'manual_review_required' | 'none'
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
     * Intenta resolver un conflicto individualmente
     */
    async resolveConflict(conflict: LocalConflict): Promise<ResolutionResult> {
        // Si requiere revisión manual, no hacemos nada automáticamente
        if (conflict.requires_manual_review) {
            return {
                resolved: false,
                action_taken: 'manual_review_required',
                message: 'El conflicto requiere intervención manual',
            }
        }

        // ESTRATEGIA: Server Wins (Default)
        // Si no requiere revisión manual, asumimos que el servidor tiene la razón
        // y descartamos nuestros cambios pendientes (que ya fueron rechazados/conflicto por el servidor)

        logger.info('Resolviendo conflicto automáticamente (Server Wins)', {
            conflict_id: conflict.id,
            event_id: conflict.event_id
        })

        // 1. Marcar el evento local como fallido/descartado por conflicto
        // Buscamos el evento que causó el conflicto
        const event = await db.localEvents.where('event_id').equals(conflict.event_id).first()

        if (event) {
            // Lo marcamos como 'conflict_resolved' (o simplemente failed con nota)
            // En este caso, lo eliminamos de la cola de pendientes actualizándolo
            await db.localEvents.update(event.id!, {
                sync_status: 'failed', // Lo sacamos de pending
                last_error: `Auto-resolved: Server Wins. Reason: ${conflict.reason}`,
                sync_attempts: 999, // Para que no se reintente
            })
        }

        // 2. Marcar conflicto como resuelto
        await db.conflicts.update(conflict.id, {
            status: 'resolved',
            resolution: 'take_theirs', // Tomamos la versión del servidor (que ya está allá)
            resolved_at: Date.now(),
        })

        // 3. Invalidar caches relacionados para asegurar que la UI muestre lo del servidor
        // Esto es un enfoque "martillo", se podría ser más granular según el tipo de evento
        await this.invalidateRelatedCaches()

        return {
            resolved: true,
            action_taken: 'server_wins',
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
