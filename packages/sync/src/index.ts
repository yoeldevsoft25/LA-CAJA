/**
 * Sync engine - Queue, states, conflict rules
 * Motor de sincronización robusto y escalable con Offline-First World-Class
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

// ===== OFFLINE-FIRST WORLD-CLASS =====
export type { VectorClock } from './vector-clock';
export { VectorClockManager } from './vector-clock';
export { CircuitBreaker, CircuitState } from './circuit-breaker';
export type { CircuitBreakerConfig } from './circuit-breaker';
export { CacheManager, CacheLevel } from './cache-manager';
export type { CacheEntry } from './cache-manager';
