/**
 * Cola de Sincronización Inteligente
 * Gestiona eventos pendientes de sincronización con prioridades y estados
 */

import { BaseEvent } from '@la-caja/domain';
import { getEventPriority, EventPriority, compareByPriority } from './event-priority';
import { RetryStrategy } from './retry-strategy';
import { BatchSync, BatchSyncCallback } from './batch-sync';
import { SyncMetricsCollector } from './sync-metrics';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

export interface QueuedEvent {
  event: BaseEvent;
  priority: EventPriority;
  status: SyncStatus;
  createdAt: number;
  attemptCount: number;
  lastAttemptAt?: number;
  lastError?: string;
}

export interface SyncQueueConfig {
  batchSize?: number;
  batchTimeout?: number;
  retryStrategy?: RetryStrategy;
  prioritizeCritical?: boolean;
}

export class SyncQueue {
  private queue: Map<string, QueuedEvent> = new Map(); // key: event_id
  private batchSync: BatchSync;
  private retryStrategy: RetryStrategy;
  private metrics: SyncMetricsCollector;
  private syncCallback?: BatchSyncCallback;

  constructor(
    syncCallback: BatchSyncCallback,
    config: SyncQueueConfig = {},
    metrics?: SyncMetricsCollector
  ) {
    this.syncCallback = syncCallback;
    this.retryStrategy = config.retryStrategy || new RetryStrategy();
    this.metrics = metrics || new SyncMetricsCollector();

    this.batchSync = new BatchSync(
      this.handleBatchSync.bind(this),
      {
        batchSize: config.batchSize,
        batchTimeout: config.batchTimeout,
        prioritizeCritical: config.prioritizeCritical,
      }
    );
  }

  /**
   * Agrega un evento a la cola
   */
  enqueue(event: BaseEvent): void {
    const priority = getEventPriority(event.type);

    const queuedEvent: QueuedEvent = {
      event,
      priority,
      status: 'pending',
      createdAt: Date.now(),
      attemptCount: 0,
    };

    this.queue.set(event.event_id, queuedEvent);
    this.updateMetricsPendingCount();

    // Agregar al batch sync para procesamiento
    this.batchSync.addEvent(event);
  }

  /**
   * Agrega múltiples eventos a la cola
   */
  enqueueBatch(events: BaseEvent[]): void {
    for (const event of events) {
      this.enqueue(event);
    }
  }

  /**
   * Obtiene eventos pendientes ordenados por prioridad
   */
  getPendingEvents(limit?: number): QueuedEvent[] {
    const pending = Array.from(this.queue.values())
      .filter((qe) => qe.status === 'pending')
      .sort((a, b) => compareByPriority(a.event, b.event));

    return limit ? pending.slice(0, limit) : pending;
  }

  /**
   * Obtiene un evento por ID
   */
  getEvent(eventId: string): QueuedEvent | undefined {
    return this.queue.get(eventId);
  }

  /**
   * Marca eventos como sincronizados
   */
  markAsSynced(eventIds: string[]): void {
    for (const eventId of eventIds) {
      const queuedEvent = this.queue.get(eventId);
      if (queuedEvent) {
        queuedEvent.status = 'synced';
        queuedEvent.lastAttemptAt = Date.now();
      }
    }
    this.updateMetricsPendingCount();
  }

  /**
   * Marca eventos como fallidos y programa reintento si es apropiado
   */
  markAsFailed(eventIds: string[], error: Error): void {
    for (const eventId of eventIds) {
      const queuedEvent = this.queue.get(eventId);
      if (queuedEvent) {
        queuedEvent.attemptCount++;
        queuedEvent.lastAttemptAt = Date.now();
        queuedEvent.lastError = error.message;

        if (this.retryStrategy.shouldRetry(queuedEvent.attemptCount, error)) {
          queuedEvent.status = 'pending';
          // Programar reintento
          this.scheduleRetry(queuedEvent);
        } else {
          queuedEvent.status = 'failed';
          this.metrics.recordError(error, queuedEvent.attemptCount);
        }
      }
    }
    this.updateMetricsPendingCount();
  }

  /**
   * Marca eventos como conflictos
   */
  markAsConflict(eventIds: string[]): void {
    for (const eventId of eventIds) {
      const queuedEvent = this.queue.get(eventId);
      if (queuedEvent) {
        queuedEvent.status = 'conflict';
        this.metrics.recordConflict();
      }
    }
    this.updateMetricsPendingCount();
  }

  /**
   * Limpia eventos sincronizados de la cola (opcional, para liberar memoria)
   */
  clearSynced(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    const toDelete: string[] = [];

    for (const [eventId, queuedEvent] of this.queue.entries()) {
      if (
        queuedEvent.status === 'synced' &&
        queuedEvent.lastAttemptAt &&
        queuedEvent.lastAttemptAt < cutoff
      ) {
        toDelete.push(eventId);
      }
    }

    for (const eventId of toDelete) {
      this.queue.delete(eventId);
    }

    this.updateMetricsPendingCount();
  }

  /**
   * Obtiene estadísticas de la cola
   */
  getStats() {
    const stats = {
      total: this.queue.size,
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
      conflict: 0,
    };

    for (const queuedEvent of this.queue.values()) {
      stats[queuedEvent.status]++;
    }

    return stats;
  }

  /**
   * Maneja la sincronización de un batch de eventos
   */
  private async handleBatchSync(events: BaseEvent[]): Promise<{ success: boolean; error?: Error }> {
    if (!this.syncCallback) {
      return { success: false, error: new Error('No sync callback configured') };
    }

    const eventIds = events.map((e) => e.event_id);
    const startTime = Date.now();

    // Marcar como sincrando
    for (const eventId of eventIds) {
      const queuedEvent = this.queue.get(eventId);
      if (queuedEvent) {
        queuedEvent.status = 'syncing';
      }
    }

    try {
      const result = await this.syncCallback(events);

      const duration = Date.now() - startTime;
      const bytes = JSON.stringify(events).length;

      if (result.success) {
        // Permite callback con resultado parcial (aceptados/rechazados) sin pisar estados ya actualizados.
        const stillSyncingIds = eventIds.filter(
          (eventId) => this.queue.get(eventId)?.status === 'syncing'
        );
        if (stillSyncingIds.length > 0) {
          this.markAsSynced(stillSyncingIds);
        } else {
          this.updateMetricsPendingCount();
        }
        this.metrics.recordSync(duration, stillSyncingIds.length, bytes);
        return { success: true };
      } else {
        const error = result.error || new Error('Unknown sync error');
        // Si es error offline, mantener en pending (no marcar failed)
        if (error?.name === 'OfflineError' || error?.message?.includes('Sin conexión')) {
          for (const eventId of eventIds) {
            const queuedEvent = this.queue.get(eventId);
            if (queuedEvent) {
              queuedEvent.status = 'pending';
            }
          }
          this.updateMetricsPendingCount();
          return { success: false, error };
        }
        this.markAsFailed(eventIds, error);
        return { success: false, error };
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.markAsFailed(eventIds, err);
      this.metrics.recordError(err);
      return { success: false, error: err };
    }
  }

  /**
   * Programa un reintento para un evento fallido
   */
  private async scheduleRetry(queuedEvent: QueuedEvent): Promise<void> {
    const delay = this.retryStrategy.calculateDelay(queuedEvent.attemptCount);

    setTimeout(async () => {
      // Verificar que el evento todavía existe y está pendiente
      const current = this.queue.get(queuedEvent.event.event_id);
      if (current && current.status === 'pending') {
        await this.batchSync.addEvent(queuedEvent.event);
      }
    }, delay);
  }

  /**
   * Actualiza el conteo de eventos pendientes en métricas
   */
  private updateMetricsPendingCount(): void {
    const pendingCount = Array.from(this.queue.values()).filter(
      (qe) => qe.status === 'pending' || qe.status === 'syncing'
    ).length;
    this.metrics.updatePendingCount(pendingCount);
  }

  /**
   * Obtiene el collector de métricas
   */
  getMetrics(): SyncMetricsCollector {
    return this.metrics;
  }

  /**
   * Fuerza el flush del batch actual (útil para testing o cierre de app)
   */
  async flush(): Promise<void> {
    await this.rehydrateBatchFromPendingQueue();
    await this.batchSync.flush();
  }

  /**
   * Limpia completamente la cola (para reconciliación)
   */
  clear(): void {
    this.queue.clear();
    this.updateMetricsPendingCount();
  }

  /**
   * Rehidrata el batch desde la cola en memoria para evitar eventos "atascados"
   * en estado pending cuando el batch interno quedó vacío tras un error transitorio.
   */
  private async rehydrateBatchFromPendingQueue(): Promise<void> {
    if (this.batchSync.getPendingCount() > 0) {
      return;
    }

    const now = Date.now();
    const pending = this.getPendingEvents().filter((queuedEvent) => {
      if (!queuedEvent.lastAttemptAt || queuedEvent.attemptCount <= 0) {
        return true;
      }

      const retryDelay = this.retryStrategy.calculateDelay(queuedEvent.attemptCount);
      return now - queuedEvent.lastAttemptAt >= retryDelay;
    });

    if (pending.length === 0) {
      return;
    }

    await this.batchSync.addEvents(pending.map((queuedEvent) => queuedEvent.event));
  }
}
