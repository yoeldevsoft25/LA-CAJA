/**
 * Servicio de Sincronización Mejorado
 * Integra el sistema de sincronización robusto con la base de datos local y API
 */

import { BaseEvent } from '@la-caja/domain';
import { SyncQueue, SyncQueueConfig, SyncMetricsCollector } from '@la-caja/sync';
import { api } from '@/lib/api';
import { db, LocalEvent } from '@/db/database';

export interface PushSyncDto {
  store_id: string;
  device_id: string;
  client_version: string;
  events: BaseEvent[];
}

export interface PushSyncResponseDto {
  accepted: Array<{ event_id: string; seq: number }>;
  rejected: Array<{ event_id: string; seq: number; code: string; message: string }>;
  server_time: number;
  last_processed_seq: number;
}

export interface SyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  lastError: string | null;
}

class SyncServiceClass {
  private syncQueue: SyncQueue | null = null;
  private metrics: SyncMetricsCollector;
  private isInitialized = false;
  private deviceId: string | null = null;
  private storeId: string | null = null;
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly SYNC_INTERVAL_MS = 30000; // Sincronizar cada 30 segundos
  private onlineListener: (() => void) | null = null;
  private offlineListener: (() => void) | null = null;

  constructor() {
    this.metrics = new SyncMetricsCollector();
    this.setupConnectivityListeners();
  }

  /**
   * Configura listeners para cambios de conectividad
   */
  private setupConnectivityListeners(): void {
    this.onlineListener = () => {
      // Cuando vuelve la conexión, sincronizar inmediatamente
      if (this.isInitialized && this.syncQueue) {
        console.log('[SyncService] online -> flush queue');
        this.syncQueue.flush().then(() => {
          console.log('[SyncService] flush complete (online event)');
        }).catch((err: any) => {
          console.error('[SyncService] flush error (online event)', err);
          // Silenciar errores, el sync periódico lo intentará de nuevo
        });
      }
    };

    this.offlineListener = () => {
      // Cuando se pierde la conexión, pausar sincronización periódica
      // Los eventos seguirán guardándose localmente
    };

    window.addEventListener('online', this.onlineListener);
    window.addEventListener('offline', this.offlineListener);
  }

  /**
   * Valida un UUID simple
   */
  private isUUID(value: string | undefined | null): boolean {
    if (!value || typeof value !== 'string') return false;
    // Aceptar UUIDs con cualquier variante/version (más permisivo para device/store placeholders)
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  /**
   * Asegura que el servicio esté inicializado (idempotente)
   * Útil para rehidratar después de un reload con sesión guardada.
   */
  async ensureInitialized(storeId: string): Promise<void> {
    if (this.isInitialized && this.storeId === storeId && this.syncQueue) {
      return;
    }
    const deviceId = this.getOrCreateDeviceId();
    await this.initialize(storeId, deviceId);
  }

  /**
   * Inicializa el servicio de sincronización
   * Debe llamarse después de que el usuario esté autenticado
   */
  async initialize(storeId: string, deviceId: string, config?: SyncQueueConfig): Promise<void> {
    if (this.isInitialized && this.storeId === storeId && this.syncQueue) {
      return;
    }
    this.storeId = storeId;
    this.deviceId = deviceId;

    // Crear la cola de sincronización con callback personalizado
    this.syncQueue = new SyncQueue(
      this.syncBatchToServer.bind(this),
      config || {},
      this.metrics
    );

    // Cargar eventos pendientes de la base de datos
    await this.loadPendingEventsFromDB();

    // Iniciar sincronización periódica
    this.startPeriodicSync();

    this.isInitialized = true;
  }

  /**
   * Agrega un evento a la cola de sincronización
   * También lo guarda en la base de datos local
   * Si no está inicializado, guarda directamente en la BD (modo offline seguro)
   */
  async enqueueEvent(event: BaseEvent): Promise<void> {
    // Siempre guardar en base de datos local primero (incluso si no está inicializado)
    await this.saveEventToDB(event);
    console.log('[SyncService] Evento guardado/encolado', {
      event_id: event.event_id,
      type: event.type,
      store_id: event.store_id,
      device_id: event.device_id,
      seq: event.seq,
    });

    // Si está inicializado, agregar a la cola de sincronización
    if (this.isInitialized && this.syncQueue) {
      this.syncQueue.enqueue(event);
      console.log('[SyncService] enqueue -> flush attempt');
      this.syncQueue.flush().catch(() => {
        // Silenciar, ya hay flush periódico
      });
    } else {
      // Si no está inicializado, intentar inicializar automáticamente si tenemos los datos necesarios
      if (event.store_id && event.device_id) {
        try {
          // Obtener deviceId del evento o del localStorage
          const deviceId = event.device_id || this.getOrCreateDeviceId();
          await this.initialize(event.store_id, deviceId);
          // Después de inicializar, agregar a la cola
          if (this.syncQueue) {
    this.syncQueue.enqueue(event);
          }
        } catch (error) {
          // Si falla la inicialización, el evento ya está guardado en la BD
          // Se sincronizará cuando el servicio se inicialice correctamente
          console.warn('[SyncService] No se pudo inicializar automáticamente, pero el evento está guardado:', error);
        }
      }
    }
  }

  /**
   * Obtiene o crea un deviceId
   */
  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Agrega múltiples eventos a la cola
   */
  async enqueueEvents(events: BaseEvent[]): Promise<void> {
    if (!this.isInitialized || !this.syncQueue) {
      throw new Error('SyncService no está inicializado. Llama a initialize() primero.');
    }

    // Guardar todos en la base de datos
    await db.localEvents.bulkPut(
      events.map((event) => this.eventToLocalEvent(event))
    );

    // Agregar a la cola
    this.syncQueue.enqueueBatch(events);
  }

  /**
   * Fuerza la sincronización inmediata de eventos pendientes
   */
  async syncNow(): Promise<void> {
    if (!this.syncQueue) {
      throw new Error('SyncService no está inicializado');
    }

    await this.syncQueue.flush();
  }

  /**
   * Obtiene el estado actual de sincronización
   */
  getStatus(): SyncStatus {
    const stats = this.syncQueue?.getStats() || {
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
      conflict: 0,
    };

    const metrics = this.metrics.getMetrics();

    return {
      isSyncing: stats.syncing > 0,
      pendingCount: stats.pending,
      lastSyncAt: metrics.lastSyncAt || null,
      lastError: metrics.lastError || null,
    };
  }

  /**
   * Obtiene las métricas de sincronización
   */
  getMetrics() {
    return this.metrics.getMetrics();
  }

  /**
   * Limpia eventos antiguos sincronizados (para liberar espacio)
   */
  async cleanupSyncedEvents(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.syncQueue) return;

    const cutoff = Date.now() - maxAge;
    const oldEvents = await db.localEvents
      .where('sync_status')
      .equals('synced')
      .and((e) => (e.synced_at || 0) < cutoff)
      .toArray();

    if (oldEvents.length > 0) {
      await db.localEvents.bulkDelete(oldEvents.map((e) => e.id!));
      this.syncQueue.clearSynced(maxAge);
    }
  }

  /**
   * Detiene el servicio de sincronización
   */
  stop(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    
    // Remover listeners de conectividad
    if (this.onlineListener) {
      window.removeEventListener('online', this.onlineListener);
      this.onlineListener = null;
    }
    if (this.offlineListener) {
      window.removeEventListener('offline', this.offlineListener);
      this.offlineListener = null;
    }
    
    this.syncQueue?.flush();
    this.isInitialized = false;
  }

  /**
   * Callback para sincronizar un batch de eventos con el servidor
   */
  private async syncBatchToServer(events: BaseEvent[]): Promise<{ success: boolean; error?: Error }> {
    console.log('[SyncService] syncBatchToServer start', {
      events_count: events.length,
      first_event: events[0],
      online: navigator.onLine,
      store_id: this.storeId,
      device_id: this.deviceId,
    });

    if (!this.storeId || !this.deviceId) {
      return {
        success: false,
        error: new Error('storeId o deviceId no están configurados'),
      };
    }

    // Verificar conectividad antes de intentar sincronizar
    if (!navigator.onLine) {
      console.warn('[SyncService] Aborting sync, navigator.offline');
      return {
        success: false,
        error: new Error('Sin conexión a internet'),
      };
    }

    // Validar storeId y deviceId antes de enviar
    if (!this.storeId || !this.isUUID(this.storeId)) {
      console.error('[SyncService] storeId inválido antes de sync', this.storeId);
      const err = new Error(`storeId inválido para sync: ${this.storeId}`);
      return { success: false, error: err };
    }
    if (!this.deviceId || !this.isUUID(this.deviceId)) {
      console.error('[SyncService] deviceId inválido antes de sync', this.deviceId);
      const err = new Error(`deviceId inválido para sync: ${this.deviceId}`);
      return { success: false, error: err };
    }

    // Filtrar y sanear eventos (backend no quiere store_id/device_id dentro de cada evento)
    const invalidActorEventIds: string[] = [];
    const sanitizedEvents = events
      .map((evt) => {
        const actorUserId = evt.actor?.user_id;
        if (!this.isUUID(actorUserId)) {
          invalidActorEventIds.push(evt.event_id);
          return null;
        }
        // Remover store_id y device_id del payload individual
        // El backend los recibe en el DTO principal
        const { store_id: _s, device_id: _d, ...rest } = evt as any;
        return {
          ...rest,
          payload: {
            ...((rest as any).payload || {}),
            store_id: undefined,
            device_id: undefined,
          },
        };
      })
      .filter(Boolean) as BaseEvent[];

    console.log('[SyncService] Sanitized events', {
      original_count: events.length,
      sanitized_count: sanitizedEvents.length,
      invalid_actor_count: invalidActorEventIds.length,
      first_sanitized_event: sanitizedEvents[0],
    });

    if (invalidActorEventIds.length > 0) {
      const error = new Error('Eventos inválidos (falta actor.user_id UUID). Se marcan como failed.');
      for (const evtId of invalidActorEventIds) {
        await this.markEventAsFailed(evtId, error);
      }
      this.syncQueue?.markAsFailed(invalidActorEventIds, error);
    }

    if (sanitizedEvents.length === 0) {
      return { success: true };
    }

    try {
      console.log('[SyncService] Enviando /sync/push', {
        store_id: this.storeId,
        device_id: this.deviceId,
        events_count: sanitizedEvents.length,
        first_event: sanitizedEvents[0],
      });

      const dto: PushSyncDto = {
        store_id: this.storeId,
        device_id: this.deviceId,
        client_version: '1.0.0', // TODO: Obtener de package.json
        events: sanitizedEvents,
      };

      const response = await api.post<PushSyncResponseDto>('/sync/push', dto);

      // Marcar eventos aceptados como sincronizados
      if (response.data.accepted.length > 0) {
        const acceptedIds = response.data.accepted.map((a) => a.event_id);
        await this.markEventsAsSynced(acceptedIds);
        this.syncQueue?.markAsSynced(acceptedIds);
      }

      // Manejar eventos rechazados
      if (response.data.rejected.length > 0) {
        for (const rejected of response.data.rejected) {
          const error = new Error(`${rejected.code}: ${rejected.message}`);
          error.name = rejected.code;
          await this.markEventAsFailed(rejected.event_id, error);
          this.syncQueue?.markAsFailed([rejected.event_id], error);
        }
      }

      return { success: true };
    } catch (error) {
      // Log detallado para depurar 400/validaciones
      const anyErr: any = error;
      const status = anyErr?.response?.status;
      const data = anyErr?.response?.data;
      console.error('[SyncService] ❌ Error sincronizando /sync/push', {
        status,
        data,
        eventsCount: events.length,
      });

      const message =
        status && data?.message
          ? `HTTP ${status}: ${data.message}`
          : anyErr?.message || 'Error desconocido al sincronizar';
      const err = new Error(message);
      if (status && status >= 400 && status < 500) {
        err.name = 'ValidationError';
      }
      return { success: false, error: err };
    }
  }

  /**
   * Carga eventos pendientes de la base de datos a la cola
   */
  private async loadPendingEventsFromDB(): Promise<void> {
    if (!this.syncQueue) return;

    try {
      const pendingEvents = await db.getPendingEvents(100); // Cargar hasta 100 eventos
      const baseEvents = pendingEvents.map((le) => this.localEventToBaseEvent(le));

      if (baseEvents.length > 0) {
        console.log('[SyncService] Cargando pendientes desde DB', {
          count: baseEvents.length,
          first_event: baseEvents[0],
        });
        this.syncQueue.enqueueBatch(baseEvents);
      }
    } catch (error) {
      // Silenciar errores de carga, se reintentará en la próxima inicialización
      console.error('Error cargando eventos pendientes:', error);
    }
  }

  /**
   * Guarda un evento en la base de datos local
   */
  private async saveEventToDB(event: BaseEvent): Promise<void> {
    const localEvent = this.eventToLocalEvent(event);
    await db.localEvents.add(localEvent);
  }

  /**
   * Marca eventos como sincronizados en la base de datos
   */
  private async markEventsAsSynced(eventIds: string[]): Promise<void> {
    const updates = eventIds.map((eventId) => ({
      event_id: eventId,
      sync_status: 'synced' as const,
      synced_at: Date.now(),
    }));

    for (const update of updates) {
      const event = await db.localEvents.where('event_id').equals(update.event_id).first();
      if (event) {
        await db.localEvents.update(event.id!, {
          sync_status: update.sync_status,
          synced_at: update.synced_at,
        });
      }
    }
  }

  /**
   * Marca un evento como fallido en la base de datos
   */
  private async markEventAsFailed(eventId: string, _error: Error): Promise<void> {
    const event = await db.localEvents.where('event_id').equals(eventId).first();
    if (event) {
      await db.localEvents.update(event.id!, {
        sync_status: 'failed',
        sync_attempts: (event.sync_attempts || 0) + 1,
      });
    }
  }

  /**
   * Inicia sincronización periódica
   * Solo sincroniza si hay conexión a internet
   */
  private startPeriodicSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }

    this.syncIntervalId = setInterval(() => {
      // Solo sincronizar si hay conexión
      if (navigator.onLine && this.syncQueue) {
        this.syncQueue.flush().then(() => {
          console.log('[SyncService] flush complete (interval)');
        }).catch((err: any) => {
          console.error('[SyncService] flush error (interval)', err);
          // Silenciar errores, se reintentará en el siguiente intervalo
        });
      }
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * Convierte BaseEvent a LocalEvent
   */
  private eventToLocalEvent(event: BaseEvent): LocalEvent {
    return {
      ...event,
      sync_status: 'pending',
      sync_attempts: 0,
    };
  }

  /**
   * Convierte LocalEvent a BaseEvent
   */
  private localEventToBaseEvent(localEvent: LocalEvent): BaseEvent {
    const { id, sync_status, sync_attempts, synced_at, ...baseEvent } = localEvent;
    return baseEvent;
  }
}

// Exportar instancia singleton
export const syncService = new SyncServiceClass();
