export { type StorageAdapter } from './storage/adapter';
export { WebStorageAdapter } from './storage/web.adapter';

// Offline-first utilities
export type { VectorClock } from './vector-clock';
export { VectorClockManager } from './vector-clock';
export { CircuitBreaker, CircuitState } from './circuit-breaker';
export type { CircuitBreakerConfig } from './circuit-breaker';
export { CacheManager, CacheLevel } from './cache-manager';
export type { CacheEntry } from './cache-manager';

