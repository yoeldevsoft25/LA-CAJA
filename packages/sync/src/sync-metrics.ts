/**
 * Sistema de Métricas y Observabilidad para Sincronización
 * Recolecta métricas sobre el proceso de sincronización
 */

export interface SyncMetrics {
  // Estado
  pendingEvents: number;
  syncedEvents: number;
  failedEvents: number;
  conflictedEvents: number;

  // Performance
  avgSyncDuration: number;
  lastSyncDuration: number;
  lastSyncAt: number;

  // Errores
  errorRate: number;
  lastError?: string;
  lastErrorAt?: number;

  // Throughput
  eventsPerMinute: number;
  bytesPerSecond: number;

  // Reintentos
  totalRetries: number;
  avgRetriesPerEvent: number;
}

export type MetricsListener = (metrics: SyncMetrics) => void;

export class SyncMetricsCollector {
  private metrics: SyncMetrics;
  private listeners: MetricsListener[] = [];
  private syncHistory: Array<{ duration: number; eventCount: number; bytes: number; timestamp: number }> = [];
  private readonly maxHistorySize = 100;

  constructor() {
    this.metrics = {
      pendingEvents: 0,
      syncedEvents: 0,
      failedEvents: 0,
      conflictedEvents: 0,
      avgSyncDuration: 0,
      lastSyncDuration: 0,
      lastSyncAt: 0,
      errorRate: 0,
      eventsPerMinute: 0,
      bytesPerSecond: 0,
      totalRetries: 0,
      avgRetriesPerEvent: 0,
    };
  }

  /**
   * Registra una sincronización exitosa
   */
  recordSync(duration: number, eventCount: number, bytes: number, retryCount: number = 0): void {
    const now = Date.now();

    // Actualizar métricas básicas
    this.metrics.lastSyncDuration = duration;
    this.metrics.lastSyncAt = now;
    this.metrics.syncedEvents += eventCount;
    this.metrics.totalRetries += retryCount;

    // Calcular promedio móvil de duración (exponential moving average)
    if (this.metrics.avgSyncDuration === 0) {
      this.metrics.avgSyncDuration = duration;
    } else {
      this.metrics.avgSyncDuration = this.metrics.avgSyncDuration * 0.9 + duration * 0.1;
    }

    // Agregar a historial
    this.syncHistory.push({ duration, eventCount, bytes, timestamp: now });
    if (this.syncHistory.length > this.maxHistorySize) {
      this.syncHistory.shift();
    }

    // Calcular throughput
    this.updateThroughput();

    // Calcular promedio de reintentos
    if (this.metrics.syncedEvents > 0) {
      this.metrics.avgRetriesPerEvent = this.metrics.totalRetries / this.metrics.syncedEvents;
    }

    // Notificar listeners
    this.notifyListeners();
  }

  /**
   * Registra un error de sincronización
   */
  recordError(error: Error | string, retryCount: number = 0): void {
    const now = Date.now();
    this.metrics.failedEvents++;
    this.metrics.lastError = error instanceof Error ? error.message : error;
    this.metrics.lastErrorAt = now;
    this.metrics.totalRetries += retryCount;

    // Calcular error rate
    const total = this.metrics.syncedEvents + this.metrics.failedEvents;
    if (total > 0) {
      this.metrics.errorRate = this.metrics.failedEvents / total;
    }

    // Notificar listeners
    this.notifyListeners();
  }

  /**
   * Registra un conflicto
   */
  recordConflict(): void {
    this.metrics.conflictedEvents++;
    this.notifyListeners();
  }

  /**
   * Actualiza el conteo de eventos pendientes
   */
  updatePendingCount(count: number): void {
    this.metrics.pendingEvents = count;
    this.notifyListeners();
  }

  /**
   * Obtiene las métricas actuales
   */
  getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  /**
   * Resetea todas las métricas
   */
  reset(): void {
    this.metrics = {
      pendingEvents: 0,
      syncedEvents: 0,
      failedEvents: 0,
      conflictedEvents: 0,
      avgSyncDuration: 0,
      lastSyncDuration: 0,
      lastSyncAt: 0,
      errorRate: 0,
      eventsPerMinute: 0,
      bytesPerSecond: 0,
      totalRetries: 0,
      avgRetriesPerEvent: 0,
    };
    this.syncHistory = [];
    this.notifyListeners();
  }

  /**
   * Agrega un listener para cambios en las métricas
   */
  addListener(listener: MetricsListener): () => void {
    this.listeners.push(listener);
    // Retorna función para remover listener
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Actualiza métricas de throughput basadas en historial
   */
  private updateThroughput(): void {
    if (this.syncHistory.length === 0) {
      this.metrics.eventsPerMinute = 0;
      this.metrics.bytesPerSecond = 0;
      return;
    }

    // Calcular basado en últimos 10 sincronizaciones o últimos 60 segundos
    const now = Date.now();
    const windowMs = 60000; // 1 minuto
    const recentSyncs = this.syncHistory.filter(
      (entry) => now - entry.timestamp < windowMs
    ).slice(-10);

    if (recentSyncs.length === 0) {
      this.metrics.eventsPerMinute = 0;
      this.metrics.bytesPerSecond = 0;
      return;
    }

    const totalEvents = recentSyncs.reduce((sum, entry) => sum + entry.eventCount, 0);
    const totalBytes = recentSyncs.reduce((sum, entry) => sum + entry.bytes, 0);
    const totalDuration = recentSyncs.reduce((sum, entry) => sum + entry.duration, 0);

    // Calcular eventos por minuto
    const windowMinutes = (now - recentSyncs[0].timestamp) / 60000;
    this.metrics.eventsPerMinute = windowMinutes > 0 ? totalEvents / windowMinutes : 0;

    // Calcular bytes por segundo
    this.metrics.bytesPerSecond = totalDuration > 0 ? totalBytes / (totalDuration / 1000) : 0;
  }

  /**
   * Notifica a todos los listeners de cambios en métricas
   */
  private notifyListeners(): void {
    const metrics = this.getMetrics();
    this.listeners.forEach((listener) => {
      try {
        listener(metrics);
      } catch (error) {
        console.error('Error in metrics listener:', error);
      }
    });
  }
}
