/**
 * Sistema de Batching Inteligente para Sincronización
 * Agrupa eventos en batches para sincronización eficiente
 */

import { BaseEvent } from '@la-caja/domain';
import { getEventPriority, EventPriority, compareByPriority } from './event-priority';

export interface BatchConfig {
  batchSize: number;        // Tamaño máximo del batch (default: 50)
  batchTimeout: number;     // Timeout en ms antes de enviar batch parcial (default: 5000)
  prioritizeCritical: boolean; // Si true, envía eventos críticos inmediatamente (default: true)
}

export type BatchSyncCallback = (events: BaseEvent[]) => Promise<{ success: boolean; error?: Error }>;

export class BatchSync {
  private config: Required<BatchConfig>;
  private pendingBatch: BaseEvent[] = [];
  private timeoutId?: ReturnType<typeof setTimeout>;
  private flushCallback?: BatchSyncCallback;
  private isFlushing = false;

  constructor(
    flushCallback: BatchSyncCallback,
    config: Partial<BatchConfig> = {}
  ) {
    this.flushCallback = flushCallback;
    this.config = {
      batchSize: config.batchSize ?? 50,
      batchTimeout: config.batchTimeout ?? 5000,
      prioritizeCritical: config.prioritizeCritical ?? true,
    };
  }

  /**
   * Agrega un evento al batch
   * Envía inmediatamente si el batch está lleno o si es crítico y prioritizeCritical está activado
   */
  async addEvent(event: BaseEvent): Promise<void> {
    // Si es evento crítico y prioritizeCritical está activado, enviar inmediatamente
    if (this.config.prioritizeCritical) {
      const priority = getEventPriority(event.type);
      if (priority === EventPriority.CRITICAL) {
        await this.flushImmediate([event]);
        return;
      }
    }

    this.pendingBatch.push(event);

    // Ordenar por prioridad
    this.pendingBatch.sort(compareByPriority);

    // Enviar inmediatamente si el batch está lleno
    if (this.pendingBatch.length >= this.config.batchSize) {
      await this.flush();
      return;
    }

    // Programar envío después del timeout si no hay uno programado
    if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => {
        this.flush();
      }, this.config.batchTimeout);
    }
  }

  /**
   * Agrega múltiples eventos al batch
   */
  async addEvents(events: BaseEvent[]): Promise<void> {
    for (const event of events) {
      await this.addEvent(event);
    }
  }

  /**
   * Envía el batch actual inmediatamente
   */
  async flush(): Promise<void> {
    if (this.isFlushing) {
      return; // Ya hay un flush en progreso
    }

    // Limpiar timeout si existe
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }

    if (this.pendingBatch.length === 0) {
      return;
    }

    this.isFlushing = true;

    try {
      const batch = [...this.pendingBatch];
      this.pendingBatch = [];

      if (this.flushCallback) {
        await this.flushCallback(batch);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Envía eventos críticos inmediatamente sin esperar batch
   */
  private async flushImmediate(events: BaseEvent[]): Promise<void> {
    if (!this.flushCallback || events.length === 0) {
      return;
    }

    try {
      await this.flushCallback(events);
    } catch (error) {
      // Si falla, agregar de vuelta al batch para reintento
      this.pendingBatch.push(...events);
      this.pendingBatch.sort(compareByPriority);
      throw error;
    }
  }

  /**
   * Obtiene el número de eventos pendientes en el batch
   */
  getPendingCount(): number {
    return this.pendingBatch.length;
  }

  /**
   * Limpia el batch pendiente (útil para testing o reset)
   */
  clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    this.pendingBatch = [];
  }
}
