/**
 * Sync engine - Queue, states, conflict rules
 * Motor de sincronización robusto y escalable
 */

// Exportar tipos y enums
export { EventPriority, getEventPriority, compareByPriority } from './event-priority';
export type { RetryConfig } from './retry-strategy';
export { RetryStrategy } from './retry-strategy';
export type { BatchConfig, BatchSyncCallback } from './batch-sync';
export { BatchSync } from './batch-sync';
export type { SyncMetrics, MetricsListener } from './sync-metrics';
export { SyncMetricsCollector } from './sync-metrics';
export type { SyncStatus, QueuedEvent, SyncQueueConfig } from './sync-queue';
export { SyncQueue } from './sync-queue';
