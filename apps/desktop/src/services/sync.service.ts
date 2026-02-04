/**
 * Servicio de Sincronización Mejorado
 * Integra el sistema de sincronización robusto con la base de datos local y API
 */

import { BaseEvent } from '@la-caja/domain';
import {
  SyncQueue,
  SyncQueueConfig,
  SyncMetricsCollector,
} from '@la-caja/sync';
import {
  VectorClockManager,
  CircuitBreaker,
  CacheManager,
  CircuitState,
} from '@la-caja/offline-core';
import { ReconnectSyncOrchestrator } from '@la-caja/sync';
import { api } from '@/lib/api';
import { db, LocalEvent } from '@/db/database';
import { createLogger } from '@/lib/logger';
import { projectionManager } from './projection.manager';
import toast from '@/lib/toast';

export interface PushSyncDto {
  store_id: string;
  device_id: string;
  client_version: string;
  // ⚡ Los eventos no incluyen store_id/device_id (van en el DTO principal)
  events: Omit<BaseEvent, 'store_id' | 'device_id'>[];
}

export interface PushSyncResponseDto {
  accepted: Array<{ event_id: string; seq: number }>;
  rejected: Array<{ event_id: string; seq: number; code: string; message: string }>;
  conflicted?: Array<{
    event_id: string;
    seq: number;
    conflict_id: string;
    reason: string;
    requires_manual_review: boolean;
    conflicting_with?: string[];
  }>;
  server_time: number;
  last_processed_seq: number;
  server_vector_clock?: Record<string, number>;
}

export interface SyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  lastError: string | null;
  isServerAvailable: boolean;
  serverStatus: CircuitState;
}

class SyncServiceClass {
  private syncQueue: SyncQueue | null = null;
  private metrics: SyncMetricsCollector;
  private isInitialized = false;
  private deviceId: string | null = null;
  private storeId: string | null = null;
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly SYNC_INTERVAL_MS = 30000; // Sincronizar cada 30 segundos
  // Config: casi tiempo real, pero con batching pequeño para reducir requests
  private readonly SYNC_BATCH_SIZE = 100; // ✅ Increased to 100 (Max Capacity for Ryzen 7700X Server)
  private readonly SYNC_BATCH_TIMEOUT_MS = 150; // ms
  private readonly SYNC_PRIORITIZE_CRITICAL = false; // Agrupar eventos crítica mejora rendimiento (evita 1 request por venta)
  private onlineListener: (() => void) | null = null;
  private offlineListener: (() => void) | null = null;
  private pendingSyncOnInit = false; // Bandera para sincronizar después de inicializar si hubo evento online
  private readonly logger = createLogger('SyncService');

  // ===== OFFLINE-FIRST COMPONENTS =====
  private vectorClockManager: VectorClockManager | null = null;
  private circuitBreaker: CircuitBreaker;
  private cacheManager: CacheManager;
  private reconnectOrchestrator: ReconnectSyncOrchestrator | null = null;
  private isRecoveryRunning = false;
  private lastRecoveryTime = 0;
  private readonly RECOVERY_COOLDOWN_MS = 8000;

  // ===== CALLBACKS PARA INVALIDAR CACHE Y NOTIFICAR =====
  private onSyncCompleteCallbacks: Array<(syncedCount: number) => void> = [];
  private onSyncErrorCallbacks: Array<(error: Error) => void> = [];

  constructor() {
    this.metrics = new SyncMetricsCollector();
    this.circuitBreaker = new CircuitBreaker();
    this.cacheManager = new CacheManager('la-caja-cache');
    this.setupConnectivityListeners();
  }

  /**
   * Configura listeners para cambios de conectividad
   */
  private setupConnectivityListeners(): void {
    // Inicializar orquestador de reconexión
    this.reconnectOrchestrator = new ReconnectSyncOrchestrator({
      debounceMs: 2000, // Esperar 2s de estabilidad
      throttleMs: 10000, // No sincronizar más de una vez cada 10s por reconexión
    });

    this.reconnectOrchestrator.init(
      async () => {
        // Callback de sincronización
        if (this.isInitialized) {
          this.logger.info('Orquestador disparó sincronización');
          // ✅ HARD RECOVERY: Route through requestRecovery to respect mutex/cooldown
          await this.requestRecovery('orchestrator');
        } else {
          this.logger.debug('Orquestador disparó sync, pero no está inicializado. Marcando pendiente.');
          this.pendingSyncOnInit = true;
        }

        // Intentar registrar background sync
        this.registerBackgroundSync().catch(() => { });
      },
      {
        onReconnectDetected: (source) => {
          this.logger.debug(`Reconexión detectada vía ${source}`);
        },
        onSyncStarted: (source) => {
          this.logger.info(`Iniciando sync por reconexión (${source})`);
          this.metrics.recordEvent('reconnect_sync_started', { source });
        },
        onSyncSuccess: (source) => {
          this.logger.info(`Sync por reconexión exitoso (${source})`);
          this.metrics.recordEvent('reconnect_sync_success', { source });
        },
        onSyncFailed: (source, error) => {
          this.logger.warn(`Sync por reconexión falló (${source})`, { error: error.message });
          this.metrics.recordEvent('reconnect_sync_failed', { source, error: error.message });
        },
      }
    );

    // Legacy listeners
    window.addEventListener('offline', () => {
      this.logger.warn('Conexión perdida');
      this.registerBackgroundSync().catch(() => { });
    });

    window.addEventListener('online', () => {
      if (this.isInitialized) {
        void this.requestRecovery('online');
      } else {
        this.pendingSyncOnInit = true;
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine && this.isInitialized) {
        void this.requestRecovery('visibility');
      }
    });

    window.addEventListener('focus', () => {
      if (navigator.onLine && this.isInitialized) {
        void this.requestRecovery('focus');
      }
    });
  }

  private async requestRecovery(source: 'online' | 'visibility' | 'focus' | 'orchestrator'): Promise<void> {
    if (!this.isInitialized || !this.syncQueue) {
      this.pendingSyncOnInit = true;
      return;
    }

    const now = Date.now();
    const timeSinceLastRecovery = now - this.lastRecoveryTime;
    if (timeSinceLastRecovery < this.RECOVERY_COOLDOWN_MS) {
      this.logger.debug(
        `Recovery skipped (cooldown), source=${source}, wait=${this.RECOVERY_COOLDOWN_MS - timeSinceLastRecovery}ms`
      );
      this.metrics.recordEvent('recovery_skipped_cooldown', {
        source,
        time_remaining: this.RECOVERY_COOLDOWN_MS - timeSinceLastRecovery,
      });
      return;
    }

    if (this.isRecoveryRunning) {
      this.logger.debug(`Recovery skipped (already running), source=${source}`);
      this.metrics.recordEvent('recovery_skipped_duplicate', { source });
      return;
    }

    const stats = this.syncQueue.getStats();
    const dbPending = await db.getPendingEvents(1).then((events) => events.length).catch(() => 0);
    if (stats.pending === 0 && dbPending === 0) {
      this.logger.debug(`Recovery skipped (nothing pending), source=${source}`);
      return;
    }

    this.isRecoveryRunning = true;
    this.lastRecoveryTime = now;
    this.metrics.recordEvent('recovery_started', { source });

    try {
      await this.hardRecoverySync();
    } catch (error) {
      this.logger.error(`Recovery failed, source=${source}`, error);
    } finally {
      this.isRecoveryRunning = false;
    }
  }

  /**
   * Registra un background sync tag para sincronizar cuando vuelva la conexión
   */
  /**
   * Registra un background sync tag para sincronizar cuando vuelva la conexión
   */
  private async registerBackgroundSync(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      this.logger.debug('Service Worker no está disponible');
      return;
    }

    // Background Sync API no está en tipos estándar de TypeScript
    interface ServiceWorkerRegistrationWithSync extends ServiceWorkerRegistration {
      sync?: {
        register(tag: string): Promise<void>;
        getTags(): Promise<string[]>;
      };
    }

    try {
      const registration = await navigator.serviceWorker.ready as ServiceWorkerRegistrationWithSync;
      if (!registration.sync) {
        this.logger.warn('Service Worker no soporta Background Sync (API no presente)');
        return;
      }

      // Verificar si ya está registrado para evitar overhead
      const tags = await registration.sync.getTags();
      if (tags.includes('sync-events')) {
        this.logger.debug('Background sync ya registrado: sync-events');
        return;
      }

      await registration.sync.register('sync-events');
      this.logger.info('Background sync registrado exitosamente: sync-events');
    } catch (error) {
      // Si falla, verificar permisos (a veces requiere permisos explícitos en algunos navegadores)
      if (error instanceof Error && error.name === 'NotAllowedError') {
        this.logger.warn('Permiso denegado para Background Sync', { error: error.message });
      } else {
        this.logger.error('Error registrando background sync', error);
      }
    }
  }

  /**
   * Valida un UUID simple
   */
  private isUUID(value: string | undefined | null): boolean {
    if (!value || typeof value !== 'string') return false;
    // Aceptar UUIDs con cualquier variante/version (más permisivo para device/store placeholders)
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  private initPromise: Promise<void> | null = null;
  // private isStopping = false;

  /**
   * Asegura que el servicio esté inicializado (idempotente)
   * Útil para rehidratar después de un reload con sesión guardada.
   */
  async ensureInitialized(storeId: string): Promise<void> {
    if (this.isInitialized && this.storeId === storeId && this.syncQueue) {
      return;
    }
    if (this.initPromise) {
      await this.initPromise;
      if (this.isInitialized && this.storeId === storeId) return;
    }
    const deviceId = this.getOrCreateDeviceId();
    await this.initialize(storeId, deviceId);
  }

  /**
   * Inicializa el servicio de sincronización
   * Debe llamarse después de que el usuario esté autenticado
   */
  async initialize(storeId: string, deviceId: string, config?: SyncQueueConfig): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        if (this.isInitialized && this.storeId === storeId && this.syncQueue) {
          this.logger.debug('Ya está inicializado para este store/device', { storeId, deviceId });
          return;
        }

        this.logger.info('Inicializando servicio de sincronización', {
          storeId,
          deviceId,
          isOnline: navigator.onLine,
        });

        this.storeId = storeId;
        this.deviceId = deviceId;

        // ✅ OFFLINE-FIRST: Inicializar Vector Clock Manager
        this.vectorClockManager = new VectorClockManager(deviceId);

        // Reintentar eventos fallidos (por validaciones previas) marcándolos como pendientes
        try {
          const resetCount = await db.resetFailedEventsToPending();
          if (resetCount > 0) {
            this.logger.info('Eventos fallidos reseteados a pendiente', { resetCount });
          }
        } catch (error) {
          this.logger.warn('No se pudieron resetear eventos fallidos', { error });
        }

        // Crear la cola de sincronización con callback personalizado
        this.syncQueue = new SyncQueue(
          this.syncBatchToServer.bind(this),
          config || {
            batchSize: this.SYNC_BATCH_SIZE,
            batchTimeout: this.SYNC_BATCH_TIMEOUT_MS,
            prioritizeCritical: this.SYNC_PRIORITIZE_CRITICAL,
          },
          this.metrics
        );

        // Cargar eventos pendientes de la base de datos
        await this.loadPendingEventsFromDB();

        // Iniciar sincronización periódica
        this.startPeriodicSync();

        this.isInitialized = true;
        this.logger.info('Servicio de sincronización inicializado correctamente');

        // Si había un evento online pendiente antes de inicializar, sincronizar ahora
        if ((this.pendingSyncOnInit || navigator.onLine)) {
          await this.hardRecoverySync();
          this.pendingSyncOnInit = false;
        }

        await this.persistSwContext(storeId, deviceId);
      } catch (err: any) {
        this.logger.error('Error initialize', err);
        throw err;
      } finally {
        this.initPromise = null;
      }
    })();
    return this.initPromise;
  }

  async fullSync(): Promise<void> {
    if (!this.isInitialized) return;
    try {
      if (this.syncQueue) await this.syncQueue.flush();
      // pull logic placeholder
    } catch (err) {
      this.logger.error('Full Sync Error', err);
    }
  }

  private async persistSwContext(storeId: string, deviceId: string): Promise<void> {
    try {
      if (api.defaults.baseURL) {
        await db.kv.put({ key: 'api_url', value: api.defaults.baseURL });
      }
      await db.kv.put({ key: 'device_id', value: deviceId });
      await db.kv.put({ key: 'store_id', value: storeId });

      const authHeader = api.defaults.headers.common['Authorization'];
      if (authHeader && typeof authHeader === 'string') {
        const token = authHeader.replace('Bearer ', '');
        await db.kv.put({ key: 'auth_token', value: token });
      } else {
        this.logger.warn('No se encontró auth token en headers de API');
      }
    } catch (error) {
      this.logger.warn('Error persistiendo contexto SW', error);
    }
  }

  private async hardRecoverySync(): Promise<void> {
    if (!this.isInitialized || !this.syncQueue || !navigator.onLine) return;

    const startedAt = Date.now();
    const pendingEvents = await db.getPendingEvents(1000);
    const queuePending = this.syncQueue.getStats().pending;

    this.logger.info(`Hard recovery: db_pending=${pendingEvents.length}, queue_pending=${queuePending}`);

    if (pendingEvents.length > queuePending) {
      const baseEvents = pendingEvents.map((event) => this.localEventToBaseEvent(event));
      this.syncQueue.enqueueBatch(baseEvents);
    }

    await this.syncQueue.flush();
    await this.pullFromServer();
    await this.reconcileQueueState();

    this.metrics.recordEvent('hard_recovery_completed', {
      duration_ms: Date.now() - startedAt,
      queue_depth_after: this.syncQueue.getStats().pending,
    });
  }

  private async reconcileQueueState(): Promise<void> {
    if (!this.syncQueue) return;

    const memoryPending = this.syncQueue.getStats().pending;
    try {
      // Use getPendingEvents which is optimized with index
      const dbPendingEvents = await db.getPendingEvents(1000);
      const dbPendingCount = dbPendingEvents.length;

      // Case 1: DB has 0 pending but memory has some.
      if (dbPendingCount === 0 && memoryPending > 0) {
        this.logger.warn(`[Reconcile] Phantom pending detected! DB=0, Mem=${memoryPending}. Clearing memory queue.`);
        this.syncQueue.clear();
        this.metrics.recordEvent('queue_reconciled', { action: 'cleared_phantom', memory_before: memoryPending, db: 0 });
        return;
      }

      // Case 2: Count mismatch (DB vs Memory).
      if (dbPendingCount !== memoryPending) {
        this.logger.warn(`[Reconcile] Count mismatch! DB=${dbPendingCount}, Mem=${memoryPending}. Rebuilding memory queue.`);
        this.syncQueue.clear();

        if (dbPendingCount > 0) {
          const baseEvents = dbPendingEvents.map((le) => this.localEventToBaseEvent(le));
          this.syncQueue.enqueueBatch(baseEvents);
        }

        this.metrics.recordEvent('queue_reconciled', {
          action: 'rebuilt_mismatch',
          memory_before: memoryPending,
          db: dbPendingCount,
          memory_after: this.syncQueue.getStats().pending
        });
      }
    } catch (error) {
      this.logger.error('[Reconcile] Failed to reconcile queue state', error);
    }
  }

  /**
   * Agrega un evento a la cola de sincronización
   * También lo guarda en la base de datos local
   * Si no está inicializado, guarda directamente en la BD (modo offline seguro)
   */
  async enqueueEvent(event: BaseEvent): Promise<void> {
    // ✅ OFFLINE-FIRST: Agregar vector clock al evento
    if (this.vectorClockManager) {
      const vectorClock = this.vectorClockManager.tick();
      event.vector_clock = vectorClock;
    }

    // Siempre guardar en base de datos local primero (incluso si no está inicializado)
    await this.saveEventToDB(event);
    this.logger.debug('Evento guardado/encolado', {
      event_id: event.event_id,
      type: event.type,
      store_id: event.store_id,
      device_id: event.device_id,
      seq: event.seq,
    });

    // Si está inicializado, agregar a la cola de sincronización
    if (this.isInitialized && this.syncQueue) {
      this.syncQueue.enqueue(event);
      this.logger.debug('Evento encolado, esperando batching automático');

      // Si estamos offline, registrar background sync
      if (!navigator.onLine) {
        await this.registerBackgroundSync();
      }

      // ❌ REMOVED: this.syncQueue.flush()
      // Rely on batchTimeout (150ms) or batchSize (50) to trigger flush.
      // This ensures true batching for rapid-fire events.
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
            // Si estamos offline, registrar background sync
            if (!navigator.onLine) {
              await this.registerBackgroundSync();
            }
          }
        } catch (error) {
          // Si falla la inicialización, el evento ya está guardado en la BD
          // Se sincronizará cuando el servicio se inicialice correctamente
          this.logger.warn('No se pudo inicializar automáticamente, pero el evento está guardado', { error });
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
   * Si el servicio no está inicializado, retorna silenciosamente (no lanza error)
   */
  async syncNow(): Promise<void> {
    if (!this.isInitialized || !this.syncQueue) {
      this.logger.warn('syncNow() llamado pero el servicio no está inicializado');
      // No lanzar error, simplemente retornar silenciosamente
      // El sync periódico lo intentará cuando el servicio esté listo
      return;
    }

    if (!navigator.onLine) {
      this.logger.debug('syncNow() omitido: sin conexión');
      return;
    }

    await this.syncQueue.flush();
  }

  /**
   * Fuerza la sincronización y resetea contadores de error
   */
  async forceSync(): Promise<void> {
    await db.resetFailedEventsToPending();
    await this.syncNow();
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
      isServerAvailable: this.circuitBreaker.getState() !== CircuitState.OPEN,
      serverStatus: this.circuitBreaker.getState(),
    };
  }

  /**
   * Obtiene las métricas de sincronización
   */
  getMetrics() {
    return this.metrics.getMetrics();
  }

  /**
   * Registra un callback para ejecutar cuando se completa la sincronización
   * Útil para invalidar cache de React Query
   */
  onSyncComplete(callback: (syncedCount: number) => void): () => void {
    this.onSyncCompleteCallbacks.push(callback);
    // Retornar función para desuscribirse
    return () => {
      const index = this.onSyncCompleteCallbacks.indexOf(callback);
      if (index > -1) {
        this.onSyncCompleteCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Registra un callback para ejecutar cuando hay un error de sincronización
   */
  onSyncError(callback: (error: Error) => void): () => void {
    this.onSyncErrorCallbacks.push(callback);
    // Retornar función para desuscribirse
    return () => {
      const index = this.onSyncErrorCallbacks.indexOf(callback);
      if (index > -1) {
        this.onSyncErrorCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notifica a todos los callbacks registrados que se completó la sincronización
   */
  private notifySyncComplete(syncedCount: number): void {
    // Invalidar cache de entidades críticas después de sincronizar
    // Esto asegura que los datos se refresquen cuando se sincronizan eventos
    this.invalidateCriticalCaches().catch((error) => {
      this.logger.error('Error invalidating caches', error);
    });

    this.onSyncCompleteCallbacks.forEach((callback) => {
      try {
        callback(syncedCount);
      } catch (error) {
        this.logger.error('Error en callback onSyncComplete', error);
      }
    });
  }

  /**
   * Invalida cache de entidades críticas después de sincronización
   */
  private async invalidateCriticalCaches(): Promise<void> {
    // Invalidar cache de productos activos
    await this.cacheManager.invalidatePattern(/^products:/);
    // Invalidar cache de clientes
    await this.cacheManager.invalidatePattern(/^customers:/);
    // Invalidar cache de configuración de tienda
    await this.cacheManager.invalidatePattern(/^store:/);
    this.logger.debug('Cache invalidado después de sincronización');
  }

  /**
   * Notifica a todos los callbacks registrados que hubo un error
   */
  private notifySyncError(error: Error): void {
    this.onSyncErrorCallbacks.forEach((callback) => {
      try {
        callback(error);
      } catch (err) {
        this.logger.error('Error en callback onSyncError', err);
      }
    });
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

    if (this.reconnectOrchestrator) {
      this.reconnectOrchestrator.destroy();
      this.reconnectOrchestrator = null;
    }

    this.syncQueue?.flush();
    this.isInitialized = false;
  }

  /**
   * Callback para sincronizar un batch de eventos con el servidor
   */
  private async syncBatchToServer(events: BaseEvent[]): Promise<{ success: boolean; error?: Error }> {
    this.logger.debug('syncBatchToServer start', {
      events_count: events.length,
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
      this.logger.warn('Aborting sync, navigator.offline');
      const offlineError = new Error('Sin conexión a internet');
      offlineError.name = 'OfflineError';
      return {
        success: false,
        error: offlineError,
      };
    }

    // Validar storeId y deviceId antes de enviar
    if (!this.storeId || !this.isUUID(this.storeId)) {
      this.logger.error('storeId inválido antes de sync', undefined, { storeId: this.storeId });
      const err = new Error(`storeId inválido para sync: ${this.storeId}`);
      return { success: false, error: err };
    }
    if (!this.deviceId || !this.isUUID(this.deviceId)) {
      this.logger.error('deviceId inválido antes de sync', undefined, { deviceId: this.deviceId });
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
        // Remover store_id, device_id y last_error del payload individual
        // El backend los recibe en el DTO principal o no los espera (last_error)
        const { store_id, device_id, last_error, payload, ...rest } = evt as any;
        void store_id;
        void device_id;
        void last_error;
        // Crear evento sin store_id y device_id para enviar al backend
        // El backend los espera solo en el DTO principal, no en cada evento
        // Remover store_id y device_id del evento (van en el DTO principal)
        return {
          ...rest,
          payload: {
            ...(payload || {}),
            store_id: undefined,
            device_id: undefined,
          },
        } as Omit<BaseEvent, 'store_id' | 'device_id'>;
      })
      .filter((evt): evt is Omit<BaseEvent, 'store_id' | 'device_id'> => evt !== null);

    this.logger.debug('Sanitized events', {
      original_count: events.length,
      sanitized_count: sanitizedEvents.length,
      invalid_actor_count: invalidActorEventIds.length,
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
      this.logger.debug('Enviando /sync/push', {
        store_id: this.storeId,
        device_id: this.deviceId,
        events_count: sanitizedEvents.length,
      });

      const dto: PushSyncDto = {
        store_id: this.storeId,
        device_id: this.deviceId,
        client_version: '1.0.0', // TODO: Obtener de package.json
        events: sanitizedEvents,
      };

      // ✅ OFFLINE-FIRST: Ejecutar request con Circuit Breaker
      const response = await this.circuitBreaker.execute(async () => {
        return await api.post<PushSyncResponseDto>('/sync/push', dto, {
          timeout: 60000,
        });
      });

      // ✅ OFFLINE-FIRST: Mergear vector clock del servidor
      if (response.data.server_vector_clock && this.vectorClockManager) {
        this.vectorClockManager.merge(response.data.server_vector_clock);
      }

      // Marcar eventos aceptados como sincronizados
      if (response.data.accepted.length > 0) {
        const acceptedIds = response.data.accepted.map((a: { event_id: string }) => a.event_id);
        await this.markEventsAsSynced(acceptedIds);
        this.syncQueue?.markAsSynced(acceptedIds);

        // 🔔 Notificar que se completó la sincronización para invalidar cache
        this.logger.info('Sincronización completada', { acceptedCount: acceptedIds.length });
        this.notifySyncComplete(acceptedIds.length);
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

      // ✅ OFFLINE-FIRST: Manejar eventos en conflicto
      if (response.data.conflicted && response.data.conflicted.length > 0) {
        for (const conflict of response.data.conflicted) {
          await this.handleConflict(conflict);
        }

        // Intentar resolver conflictos automáticamente
        try {
          const { conflictResolutionService } = await import('./conflict-resolution.service');
          const resolved = await conflictResolutionService.processPendingConflicts();
          if (resolved > 0) {
            this.logger.info('Conflictos resueltos automáticamente', { count: resolved });
            // Si resolvimos conflictos, invalidamos cache para refrescar datos del servidor
            await this.invalidateCriticalCaches();
          }
        } catch (err) {
          this.logger.error('Error ejecutando resolución automática de conflictos', err);
        }
      }

      return { success: true };
    } catch (error) {
      // Log detallado para depurar 400/validaciones
      const axiosError = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = axiosError?.response?.status;
      const data = axiosError?.response?.data;
      this.logger.error('Error sincronizando /sync/push', error, {
        status,
        eventsCount: events.length,
      });

      const message =
        status && data?.message
          ? `HTTP ${status}: ${data.message}`
          : axiosError?.message || 'Error desconocido al sincronizar';
      const err = new Error(message);
      if (status && status >= 400 && status < 500) {
        err.name = 'ValidationError';
      }

      // 🔔 Notificar error de sincronización
      this.notifySyncError(err);

      return { success: false, error: err };
    }
  }

  /**
   * Maneja un conflicto detectado por el servidor
   */
  private async handleConflict(conflict: {
    event_id: string;
    seq: number;
    conflict_id: string;
    reason: string;
    requires_manual_review: boolean;
    conflicting_with?: string[];
  }): Promise<void> {
    // ✅ SPRINT 6.1B: Telemetría de UX
    this.recordUXTelemetry('conflict_detected', {
      conflict_id: conflict.conflict_id,
      event_id: conflict.event_id,
      reason: conflict.reason
    });

    // Guardar conflicto en IndexedDB para mostrar en UI
    try {
      await db.conflicts.add({
        id: conflict.conflict_id,
        event_id: conflict.event_id,
        reason: conflict.reason,
        conflicting_with: conflict.conflicting_with || [],
        created_at: Date.now(),
        status: 'pending',
        requires_manual_review: conflict.requires_manual_review,
      });
    } catch (error) {
      this.logger.error('Error guardando conflicto en DB', error);
    }

    // 🔔 SPRINT 6.1B: Notificación mejorada para el usuario
    if (conflict.requires_manual_review) {
      this.logger.warn('Conflicto requiere resolución manual', { conflict_id: conflict.conflict_id });

      toast.error('Conflicto Crítico Detectado', {
        description: 'Se requiere tu intervención para resolver una discrepancia de datos.',
        duration: 8000,
        action: {
          label: 'Revisar Ahora',
          onClick: () => {
            // Esto asume que window.location.href o similar se puede usar para navegar
            // o que hay un evento global de navegación.
            window.dispatchEvent(new CustomEvent('app:navigate', { detail: '/app/conflicts' }));
          }
        }
      });
    }
  }

  /**
   * ✅ SPRINT 6.1B: Helper para telemetría de UX
   */
  private recordUXTelemetry(event: string, metadata: Record<string, any> = {}): void {
    this.logger.info(`[UX Telemetry] ${event}`, metadata);
    // En una implementación real, esto se enviaría a Sentry, Mixpanel, etc.
    // analytics.track(event, { ...metadata, platform: 'pwa', version: '1.0.0' });
  }

  /**
   * Carga eventos pendientes de la base de datos a la cola
   */
  private async loadPendingEventsFromDB(): Promise<void> {
    if (!this.syncQueue) return;

    try {
      // Cargar TODOS los eventos pendientes, no solo 100
      const pendingEvents = await db.getPendingEvents(1000); // Aumentado a 1000
      const baseEvents = pendingEvents.map((le) => this.localEventToBaseEvent(le));

      if (baseEvents.length > 0) {
        this.logger.info('Cargando eventos pendientes desde IndexedDB', {
          count: baseEvents.length,
          store_id: this.storeId,
          device_id: this.deviceId,
        });
        this.syncQueue.enqueueBatch(baseEvents);

        // Intentar sincronizar inmediatamente si hay conexión
        if (navigator.onLine) {
          this.logger.info('Conexión disponible, iniciando sincronización inmediata');
          this.syncQueue.flush().then(() => {
            this.logger.info('Sincronización inicial completada');
          }).catch((err) => {
            this.logger.warn('Error en sincronización inicial (se reintentará)', { error: err });
          });
        } else {
          this.logger.debug('Sin conexión, esperando para sincronizar');
        }
      } else {
        this.logger.debug('No hay eventos pendientes de sincronización');
      }
    } catch (error) {
      this.logger.error('Error cargando eventos pendientes', error);
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
  private async markEventAsFailed(eventId: string, error: Error): Promise<void> {
    // No persistir como failed si es un error de conectividad; se mantiene pendiente
    if (error?.name === 'OfflineError' || error?.message?.includes('Sin conexión')) {
      return;
    }
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

    this.logger.info(`Iniciando sincronización periódica cada ${this.SYNC_INTERVAL_MS}ms`);

    this.syncIntervalId = setInterval(async () => {
      // 1. PUSH: Enviar pendientes si hay conexión
      if (navigator.onLine && this.syncQueue) {
        const stats = this.syncQueue.getStats();
        if (stats.pending > 0) {
          await this.syncQueue.flush().catch((err) => {
            this.logger.debug('Error en flush periódico (ignorable)', err);
          });
        }
      }

      // 2. PULL: Traer nuevos eventos si hay conexión
      if (navigator.onLine && this.storeId && this.deviceId) {
        await this.pullFromServer().catch((err) => {
          this.logger.debug('Error en pull periódico', err);
        });
      }

      // 3. PRUNE: Limpiar eventos viejos (cada ciclo, operación barata en IndexedDB)
      await this.pruneSyncedEvents();
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * Elimina eventos sincronizados hace más de 7 días para mantener DB liviana
   */
  private async pruneSyncedEvents(): Promise<void> {
    try {
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - SEVEN_DAYS_MS;

      const deleteCount = await db.localEvents
        .where('[sync_status+created_at]')
        .between(['synced', 0], ['synced', cutoff])
        .delete();

      if (deleteCount > 0) {
        this.logger.info(`[Prune] Eliminados ${deleteCount} eventos sincronizados antiguos`);
      }
    } catch (error) {
      this.logger.warn('Error durante pruning de eventos', error);
    }
  }

  /**
   * Obtiene eventos nuevos del servidor y los aplica localmente
   */
  async pullFromServer(): Promise<void> {
    if (!this.storeId || !this.deviceId || !navigator.onLine) return;

    // Obtener último checkpoint (timestamp de recepción del último evento pull)
    // Usamos KV store para persistir este cursor
    const kvKey = 'last_pull_checkpoint';
    const lastCheckpointItem = await db.kv.get(kvKey);
    const lastCheckpoint = lastCheckpointItem?.value || 0;

    try {
      this.logger.debug('Iniciando Pull Sync', { lastCheckpoint });

      const response = await api.get<{ events: BaseEvent[]; last_server_time: number }>('/sync/pull', {
        params: {
          last_checkpoint: lastCheckpoint,
          device_id: this.deviceId // Para excluir eventos propios
        }
      });

      const events = response.data?.events ?? [];
      const last_server_time = response.data?.last_server_time ?? lastCheckpoint;

      if (events.length > 0) {
        this.logger.info(`Recibidos ${events.length} eventos nuevos del servidor`);

        // Aplicar eventos a la DB local
        await projectionManager.applyEvents(events);

        // Actualizar checkpoint solo si procesamos con éxito
        // Usamos last_server_time que nos devuelve el servidor para ser precisos
        await db.kv.put({ key: kvKey, value: last_server_time });

        // Notificar cambios (invalidar caches)
        // Esto refrescará las UI que dependen de useQuery
        await this.invalidateCriticalCaches();
      }

    } catch (error) {
      this.logger.error('Error en pullFromServer', error);
      // No lanzamos error para no detener el intervalo
    }
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
    void id;
    void sync_status;
    void sync_attempts;
    void synced_at;
    return baseEvent;
  }
}

// Exportar instancia singleton
export const syncService = new SyncServiceClass();
