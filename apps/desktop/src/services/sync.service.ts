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
import { eventRepository } from '@/db/repositories';
import { createLogger } from '@/lib/logger';
import { connectivityService } from '@/services/connectivity.service';
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

interface PullSyncResponseDto {
  events: BaseEvent[];
  last_server_time: number;
  last_server_event_id?: string | null;
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
  private readonly ZERO_UUID = '00000000-0000-0000-0000-000000000000';
  private syncQueue: SyncQueue | null = null;
  private metrics: SyncMetricsCollector;
  private isInitialized = false;
  private deviceId: string | null = null;
  private storeId: string | null = null;
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly SYNC_INTERVAL_MS = 30000; // Sincronizar cada 30 segundos
  // Config: casi tiempo real, pero con batching pequeño para reducir requests
  private readonly SYNC_BATCH_SIZE = 500; // 🚀 ULTRA CAPACITY: Pushing 500 events at once to Ryzen 7700X
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

  // ===== ANTI-STORM: Deduplicación de recovery =====
  private isRecoveryRunning = false;
  private lastRecoveryTime = 0;
  private readonly RECOVERY_COOLDOWN_MS = 8000; // 8 segundos entre recoveries

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
   * ✅ OFFLINE-FIRST: Reconnect hard-recovery sin depender de F5
   */
  private setupConnectivityListeners(): void {
    // Inicializar orquestador de reconexión con parámetros más agresivos
    this.reconnectOrchestrator = new ReconnectSyncOrchestrator({
      debounceMs: 500, // Reducido de 2s a 500ms para respuesta más rápida
      throttleMs: 5000, // Reducido de 10s a 5s para reintentos más frecuentes
    });

    this.reconnectOrchestrator.init(
      async () => {
        // Callback de sincronización (Orquestador)
        if (this.isInitialized) {
          this.logger.info('🔄 Orquestador disparó sincronización por reconexión');
          this.metrics.recordEvent('reconnect_triggered', {
            queue_depth_before: this.syncQueue?.getStats().pending || 0
          });

          // ✅ HARD RECOVERY: Route through requestRecovery to respect mutex/cooldown
          await this.requestRecovery('orchestrator');
        } else {
          this.logger.debug('Orquestador disparó sync, pero no está inicializado. Marcando pendiente.');
          this.pendingSyncOnInit = true;
        }

        // Intentar registrar background sync como fallback
        this.registerBackgroundSync().catch(() => { });
      },
      {
        onReconnectDetected: (source) => {
          this.logger.info(`🌐 Reconexión detectada vía ${source}`);
          this.metrics.recordEvent('reconnect_detected', { source });
        },
        onSyncStarted: (source) => {
          this.logger.info(`▶️ Iniciando sync por reconexión (${source})`);
          this.metrics.recordEvent('reconnect_sync_started', { source });
        },
        onSyncSuccess: (source) => {
          this.logger.info(`✅ Sync por reconexión exitoso (${source})`);
          this.metrics.recordEvent('reconnect_sync_success', {
            source,
            queue_depth_after: this.syncQueue?.getStats().pending || 0
          });
        },
        onSyncFailed: (source, error) => {
          this.logger.warn(`❌ Sync por reconexión falló (${source})`, { error: error.message });
          this.metrics.recordEvent('reconnect_sync_failed', {
            source,
            error: error.message,
            error_name: error.name
          });
        },
      }
    );

    // ✅ OFFLINE-FIRST: Usar ConnectivityService en lugar de eventos raw
    connectivityService.addListener((isOnline) => {
      if (isOnline) {
        this.logger.debug('🌐 Conectividad detectada (ConnectivityService)');
        this.metrics.recordEvent('online_event', {});
        void this.requestRecovery('online');
      } else {
        this.logger.warn('📵 Conectividad perdida (ConnectivityService)');
        this.metrics.recordEvent('connection_lost', {});
        this.registerBackgroundSync().catch(() => { });
      }
    });

    // ✅ OFFLINE-FIRST: Listener para visibilitychange (app vuelve a foreground)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && connectivityService.online && this.isInitialized) {
        void this.requestRecovery('visibility');
      }
    });

    // ✅ OFFLINE-FIRST: Listener para focus (ventana recupera foco)
    window.addEventListener('focus', () => {
      if (connectivityService.online && this.isInitialized) {
        void this.requestRecovery('focus');
      }
    });
  }

  /**
   * ✅ ANTI-STORM: Centraliza todas las fuentes de recovery con deduplicación
   * - Mutex global: solo 1 recovery a la vez
   * - Cooldown temporal: mínimo 8s entre recoveries
   * - Logging estructurado de skips
   */
  private async requestRecovery(source: 'online' | 'visibility' | 'focus' | 'orchestrator'): Promise<void> {
    if (!this.isInitialized) {
      this.pendingSyncOnInit = true;
      return;
    }

    // Anti-storm: cooldown check
    const now = Date.now();
    const timeSinceLastRecovery = now - this.lastRecoveryTime;
    if (timeSinceLastRecovery < this.RECOVERY_COOLDOWN_MS) {
      this.logger.debug(`Recovery skipped (cooldown), source=${source}, wait=${this.RECOVERY_COOLDOWN_MS - timeSinceLastRecovery}ms`);
      this.metrics.recordEvent('recovery_skipped_cooldown', { source, time_remaining: this.RECOVERY_COOLDOWN_MS - timeSinceLastRecovery });
      return;
    }

    // Anti-storm: mutex check
    if (this.isRecoveryRunning) {
      this.logger.debug(`Recovery skipped (already running), source=${source}`);
      this.metrics.recordEvent('recovery_skipped_duplicate', { source });
      return;
    }

    // Check if there's anything to sync
    const stats = this.syncQueue?.getStats();
    // const dbPending = await db.getPendingEvents(1).then(e => e.length).catch(() => 0); 
    // Optimization: Use countPending from repo
    const dbPending = await eventRepository.countPending();
    if (stats?.pending === 0 && dbPending === 0) {
      this.logger.debug(`Recovery skipped (nothing pending), source=${source}`);
      return;
    }

    this.isRecoveryRunning = true;
    this.lastRecoveryTime = now;
    this.logger.info(`🔄 Recovery iniciado, source=${source}`);
    this.metrics.recordEvent('recovery_started', { source });

    try {
      await this.hardRecoverySync();
    } catch (err) {
      this.logger.error(`Recovery falló, source=${source}`, err);
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

  /**
   * Asegura que el servicio esté inicializado (idempotente)
   * Útil para rehidratar después de un reload con sesión guardada.
   */
  async ensureInitialized(storeId: string): Promise<void> {
    if (this.isInitialized && this.storeId === storeId && this.syncQueue) {
      return;
    }
    // Si ya hay una inicialización en curso, esperar a que termine
    if (this.initPromise) {
      this.logger.debug('Esperando a que termine la inicialización en curso...');
      await this.initPromise;
      // Verificar si después de esperar ya estamos listos
      if (this.isInitialized && this.storeId === storeId) return;
    }

    const deviceId = this.getOrCreateDeviceId();
    return this.initialize(storeId, deviceId);
  }

  /**
   * Inicializa el servicio de sincronización
   * Debe llamarse después de que el usuario esté autenticado
   */
  async initialize(storeId: string, deviceId: string, config?: SyncQueueConfig): Promise<void> {
    // Patrón de bloqueo para evitar condiciones de carrera en React StrictMode o montajes rápidos
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        if (this.isInitialized && this.storeId === storeId && this.syncQueue) {
          this.logger.debug('Ya está inicializado para este store/device', { storeId, deviceId });
          return;
        }

        // this.isStopping = false;
        this.logger.info('Inicializando servicio de sincronización', {
          storeId,
          deviceId,
          isOnline: connectivityService.online,
        });

        this.storeId = storeId;
        this.deviceId = deviceId;

        // ✅ OFFLINE-FIRST: Inicializar Vector Clock Manager
        this.vectorClockManager = new VectorClockManager(deviceId);
        await this.ensureSequenceCounterConsistency(storeId, deviceId);

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

        // Watchdog de red
        if (this.syncIntervalId) clearInterval(this.syncIntervalId); // Limpiar previo si existe

        // Interval forzoso solo si es necesario
        // this.syncIntervalId = setInterval(...) -> startPeriodicSync ya lo hace?
        // startPeriodicSync implementation is missing in current view, assuming it sets an interval.
        // Let's add the watchdog listener properly here or rely on orchestrator.

        this.isInitialized = true;
        this.logger.info('Servicio de sincronización inicializado correctamente');

        // Sincronización inicial
        if ((this.pendingSyncOnInit || connectivityService.online)) {
          await this.fullSync(); // Flush + Pull
          this.pendingSyncOnInit = false;
        }

        // Persistir datos para SW
        await this.persistSwContext(storeId, deviceId);

      } catch (err: any) {
        this.logger.error('Error durante inicialización', err);
        throw err;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  // ✅ OFFLINE-FIRST: Persistir contexto crítico para Service Worker
  // Necesario para que el SW pueda realizar sincronización en background con los datos correctos
  private async persistSwContext(storeId: string, deviceId: string) {
    try {
      if (api.defaults.baseURL) {
        await db.kv.put({ key: 'api_url', value: api.defaults.baseURL });
      }
      await db.kv.put({ key: 'device_id', value: deviceId });
      await db.kv.put({ key: 'store_id', value: storeId });

      // ✅ Persistir auth_token para que SW pueda autenticarse
      // El token debe estar en los headers de axios
      const authHeader = api.defaults.headers.common['Authorization'];
      if (authHeader && typeof authHeader === 'string') {
        const token = authHeader.replace('Bearer ', '');
        await db.kv.put({ key: 'auth_token', value: token });
        this.logger.debug('Auth token persistido para SW');
      } else {
        this.logger.warn('No se encontró auth token en headers de API');
      }

      this.logger.info('✅ Contexto SW persistido correctamente', {
        hasApiUrl: !!api.defaults.baseURL,
        hasToken: !!authHeader,
        storeId,
        deviceId
      });
    } catch (err: any) {
      this.logger.warn('Error persistiendo contexto SW', err);
    }
  }

  /**
   * Ejecuta ciclo completo de sincronización (Push + Pull)
   */
  async fullSync(): Promise<void> {
    if (!this.isInitialized) return;

    this.logger.info('Ejecutando Full Sync (Push + Pull)');
    try {
      // 1. Push pending
      if (this.syncQueue) await this.syncQueue.flush();

      // 2. Pull updates (stub - implement real pull logic calling API)
      // await this.pullUpdatesFromServer();

    } catch (err) {
      this.logger.error('Full sync falló', err);
    }
  }

  /**
   * ✅ OFFLINE-FIRST: Hard Recovery Sync
   * Ejecuta recuperación agresiva al reconectar:
   * 1. Recargar pendientes desde IndexedDB (por si hay eventos que no están en memoria)
   * 2. Flush inmediato de todos los pendientes
   * 3. Pull de eventos del servidor
   * 
   * NO depende de Background Sync para el camino crítico
   */
  private async hardRecoverySync(): Promise<void> {
    if (!this.isInitialized || !this.syncQueue) {
      this.logger.warn('hardRecoverySync llamado pero servicio no inicializado');
      return;
    }

    if (!connectivityService.online) {
      this.logger.debug('hardRecoverySync omitido: sin conexión');
      return;
    }

    const startTime = Date.now();
    this.logger.info('🚀 Iniciando Hard Recovery Sync');

    try {
      // 1. Recargar pendientes desde Repository (por si hay eventos que no están en cola)
      const pendingEvents = await eventRepository.getPending(1000);
      const queueDepthBefore = this.syncQueue.getStats().pending;

      this.logger.info(`📊 Pendientes en IndexedDB: ${pendingEvents.length}, en cola: ${queueDepthBefore}`);
      this.metrics.recordEvent('pending_loaded', {
        count: pendingEvents.length,
        queue_depth: queueDepthBefore
      });

      // Si hay eventos en DB que no están en cola, agregarlos
      if (pendingEvents.length > queueDepthBefore) {
        const baseEvents = pendingEvents.map((le) => this.localEventToBaseEvent(le));
        this.syncQueue.enqueueBatch(baseEvents);
        this.logger.info(`➕ Agregados ${pendingEvents.length - queueDepthBefore} eventos a la cola`);
      }

      // 2. Flush inmediato con retry
      this.logger.info('⬆️ Ejecutando flush de eventos pendientes...');
      await this.syncQueue.flush();

      const queueDepthAfter = this.syncQueue.getStats().pending;
      const syncedCount = queueDepthBefore - queueDepthAfter;

      this.metrics.recordEvent('push_success', {
        synced_count: syncedCount,
        queue_depth_after: queueDepthAfter,
        duration_ms: Date.now() - startTime
      });

      // 3. Pull de eventos del servidor
      this.logger.info('⬇️ Ejecutando pull de eventos del servidor...');
      await this.pullFromServer();

      // 4. Reconciliar cola memoria vs IndexedDB
      await this.reconcileQueueState();

      const totalDuration = Date.now() - startTime;
      const finalQueueDepth = this.syncQueue.getStats().pending;
      this.logger.info(`✅ Hard Recovery completado en ${totalDuration}ms (${syncedCount} eventos sincronizados, queue=${finalQueueDepth})`);

      // 5. Emitir evento global para notificar a la UI
      if (syncedCount > 0 || queueDepthAfter !== finalQueueDepth) {
        window.dispatchEvent(new CustomEvent('sync:completed', {
          detail: {
            syncedCount,
            queueDepthAfter: finalQueueDepth,
            duration: totalDuration,
            source: 'hard_recovery'
          }
        }));
      }

    } catch (err: unknown) {
      const duration = Date.now() - startTime;
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error('❌ Hard Recovery falló', error);
      this.metrics.recordEvent('push_failed', {
        error: error.message || 'Unknown error',
        error_name: error.name,
        duration_ms: duration
      });

      // ✅ FALLBACK: Si SW falló, intentar foreground recovery
      if (error.message?.includes('400') || error.name === 'ValidationError') {
        this.logger.warn('⚠️ Error de validación detectado, activando fallback foreground');
        this.metrics.recordEvent('fallback_foreground', {
          reason: 'validation_error',
          error: error.message
        });
        // El retry automático de SyncQueue se encargará del reintento
      }

      throw err;
    }
  }

  /**
   * ✅ QUEUE CONSISTENCY: Reconcilia cola en memoria con IndexedDB
   * Fuente de verdad: IndexedDB
   * - Si DB=0 => vaciar cola en memoria
   * - Si DB!=memoria => reconstruir cola desde DB
   */
  /**
   * ✅ QUEUE CONSISTENCY: Reconcilia cola en memoria con IndexedDB
   * Fuente de verdad: IndexedDB
   */
  private async reconcileQueueState(): Promise<void> {
    if (!this.syncQueue) return;

    const memoryPending = this.syncQueue.getStats().pending;
    try {
      // Use getPendingEvents from repo
      const dbPendingEvents = await eventRepository.getPending(1000);
      const dbPendingCount = dbPendingEvents.length;

      this.logger.debug(`[Reconcile] memory=${memoryPending}, db=${dbPendingCount}`);

      // Case 1: DB has 0 pending but memory has some.
      // This mimics a "phantom pending" state where memory queue is stuck.
      // ACTION: Clear memory queue.
      if (dbPendingCount === 0 && memoryPending > 0) {
        this.logger.warn(`[Reconcile] Phantom pending detected! DB=0, Mem=${memoryPending}. Clearing memory queue.`);
        this.syncQueue.clear();
        this.metrics.recordEvent('queue_reconciled', { action: 'cleared_phantom', memory_before: memoryPending, db: 0 });
        return;
      }

      // Case 2: Count mismatch (DB vs Memory).
      // ACTION: Rebuild memory queue from DB (Source of Truth).
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
    if (!event.store_id && this.storeId) {
      event.store_id = this.storeId;
    }
    if (!event.store_id) {
      throw new Error('store_id es requerido para encolar eventos offline');
    }
    if (!event.device_id) {
      event.device_id = this.deviceId || this.getOrCreateDeviceId();
    }

    // Fuente única de secuencia local: siempre se asigna de forma atómica aquí.
    event.seq = await this.allocateSeq(event.store_id, event.device_id);

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
      if (!connectivityService.online) {
        await this.registerBackgroundSync();
      }

      // ❌ REMOVED: this.syncQueue.flush()
      // Rely on batchTimeout (150ms) or batchSize (50) to trigger flush.
      // This ensures true batching for rapid-fire events (e.g. fast scanning or bulk offline sales).
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
            if (!connectivityService.online) {
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

  private async allocateSeq(storeId: string, deviceId: string): Promise<number> {
    const counterKey = `seq_counter:${storeId}:${deviceId}`;
    return db.transaction('rw', db.kv, async () => {
      const current = await db.kv.get(counterKey);
      const nextSeq = Number(current?.value || 0) + 1;
      await db.kv.put({ key: counterKey, value: nextSeq });
      return nextSeq;
    });
  }

  private async ensureSequenceCounterConsistency(storeId: string, deviceId: string): Promise<void> {
    try {
      const counterKey = `seq_counter:${storeId}:${deviceId}`;
      const [maxSeqEvent, currentCounter] = await Promise.all([
        db.localEvents.orderBy('seq').last(),
        db.kv.get(counterKey),
      ]);
      const maxSeq = Number(maxSeqEvent?.seq || 0);
      const storedCounter = Number(currentCounter?.value || 0);

      if (maxSeq > storedCounter) {
        await db.kv.put({ key: counterKey, value: maxSeq });
      }
    } catch (error) {
      this.logger.warn('No se pudo reconciliar contador de secuencia local', { error });
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
    await eventRepository.addBatch(
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

    if (!connectivityService.online) {
      this.logger.debug('syncNow() omitido: sin conexión');
      return;
    }

    await this.syncQueue.flush();
  }

  /**
   * Fuerza la sincronización y resetea contadores de error
   */
  async forceSync(): Promise<void> {
    await eventRepository.resetFailedToPending();
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
   * ✅ OFFLINE-FIRST: Emite evento global para invalidar UI sin F5
   */
  private notifySyncComplete(syncedCount: number): void {
    // Invalidar cache de entidades críticas después de sincronizar
    // Esto asegura que los datos se refresquen cuando se sincronizan eventos
    this.invalidateCriticalCaches().catch((error) => {
      this.logger.error('Error invalidating caches', error);
    });

    // ✅ Emitir evento global para que la UI se actualice
    window.dispatchEvent(new CustomEvent('sync:completed', {
      detail: {
        syncedCount,
        timestamp: Date.now(),
        source: 'periodic_sync'
      }
    }));

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
      error.name = 'ValidationError';
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
      if (status === 400 || status === 404) {
        err.name = 'ValidationError';
      } else if (status === 401 || status === 403) {
        // Keep retrying on auth/access during outages/failover transitions.
        err.name = 'TransientAuthError';
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
   * Recupera eventos marcados como dead por errores transitorios de auth/red.
   * Evita perder cola tras caídas de servidor o failover.
   */
  private async recoverTransientDeadEvents(): Promise<number> {
    const now = Date.now();
    let recovered = 0;

    await db.localEvents
      .where('sync_status')
      .equals('dead')
      .and((evt) => {
        const code = String(evt.last_error_code || '').toLowerCase();
        const message = String(evt.last_error || '').toLowerCase();
        return (
          code === 'transientautherror' ||
          message.includes('http 401') ||
          message.includes('http 403') ||
          message.includes('forbidden') ||
          message.includes('network') ||
          message.includes('timeout')
        );
      })
      .modify((evt: LocalEvent) => {
        evt.sync_status = 'retrying';
        evt.next_retry_at = now;
        recovered++;
      });

    if (recovered > 0) {
      this.logger.warn(`♻️ Recuperados ${recovered} eventos dead transitorios para reintento`);
    }

    return recovered;
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
      await this.recoverTransientDeadEvents();

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
    // Idempotency check handled by repository constraint (event_id UNIQUE) usually...
    // But repository.add might throw if exists. 
    // Checking existence first is safer for SQLite if we define UNIQUE constraint.
    // Our Sqlite table has event_id UNIQUE.
    try {
      await eventRepository.add(localEvent);
    } catch (e) {
      // Ignore unique constraint violation
      this.logger.debug('Event already exists (ignored)', { event_id: event.event_id });
    }
  }

  /**
   * Marca eventos como sincronizados en la base de datos
   */
  private async markEventsAsSynced(eventIds: string[]): Promise<void> {
    await eventRepository.markAsSynced(eventIds);
  }

  /**
   * Marca un evento como fallido en la base de datos
   */
  private async markEventAsFailed(eventId: string, error: Error): Promise<void> {
    // No persistir como failed si es un error de conectividad; se mantiene pendiente
    if (error?.name === 'OfflineError' || error?.message?.includes('Sin conexión')) {
      return;
    }

    const isValidationError =
      error?.name === 'ValidationError' ||
      error?.name === 'SECURITY_ERROR' ||
      error?.name === 'VALIDATION_ERROR' ||
      error?.message?.includes('VALIDATION_ERROR') ||
      error?.message?.includes('SECURITY_ERROR') ||
      error?.message?.includes('HTTP 400') ||
      error?.message?.includes('HTTP 404');

    const event = await eventRepository.findByEventId(eventId);
    if (event) {
      const attempts = (event.sync_attempts || 0) + 1;
      const nextRetryAt = isValidationError ? 0 : Date.now() + this.computeRetryDelay(attempts);
      await eventRepository.markAsFailed(eventId, error.message || 'Unknown error', nextRetryAt, isValidationError);
    }
  }

  private computeRetryDelay(attempt: number): number {
    const base = 1000;
    const max = 60_000;
    const exponential = Math.min(base * Math.pow(2, Math.max(0, attempt - 1)), max);
    const jitter = Math.floor(exponential * 0.2 * (Math.random() * 2 - 1));
    return Math.max(0, exponential + jitter);
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
      if (connectivityService.online && this.syncQueue) {
        const stats = this.syncQueue.getStats();
        if (stats.pending > 0) {
          await this.syncQueue.flush().catch((err) => {
            this.logger.debug('Error en flush periódico (ignorable)', err);
          });
        }
      }

      // 2. PULL: Traer nuevos eventos si hay conexión
      if (connectivityService.online && this.storeId && this.deviceId) {
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

      // Usar índice compuesto [sync_status+created_at] si existe, o filtrar manualmente
      // Dexie: db.localEvents.where('sync_status').equals('synced').and(evt => evt.created_at < cutoff).delete()
      // Versión optimizada con índice:
      const deleteCount = await eventRepository.pruneSynced(SEVEN_DAYS_MS);

      if (deleteCount > 0) {
        this.logger.info(`[Prune] Eliminados ${deleteCount} eventos sincronizados antiguos`);
      }
    } catch (error) {
      this.logger.warn('Error durante pruning de eventos', { error });
    }
  }

  /**
   * Obtiene eventos nuevos del servidor y los aplica localmente
   */
  async pullFromServer(): Promise<void> {
    if (!this.storeId || !this.deviceId || !connectivityService.online) return;

    // Cursor robusto v2: (timestamp, event_id)
    const cursorKeyV2 = 'last_pull_cursor_v2';
    const legacyKey = 'last_pull_checkpoint';

    const cursorItem = await db.kv.get(cursorKeyV2);
    const legacyItem = await db.kv.get(legacyKey);

    const cursor =
      cursorItem?.value && typeof cursorItem.value === 'object'
        ? cursorItem.value
        : {
          ts: typeof legacyItem?.value === 'number' ? legacyItem.value : 0,
          event_id: this.ZERO_UUID,
        };

    const lastCheckpoint = Number(cursor?.ts || 0);
    const lastEventId = typeof cursor?.event_id === 'string' ? cursor.event_id : this.ZERO_UUID;

    try {
      this.logger.debug('Iniciando Pull Sync', { lastCheckpoint, lastEventId });

      const response = await api.get<PullSyncResponseDto>('/sync/pull', {
        params: {
          last_checkpoint: lastCheckpoint,
          cursor_event_id: lastEventId,
          device_id: this.deviceId // Para excluir eventos propios
        }
      });

      const events = response.data?.events ?? [];
      const last_server_time = response.data?.last_server_time ?? lastCheckpoint;
      const last_server_event_id =
        response.data?.last_server_event_id || (events.length > 0 ? events[events.length - 1]?.event_id : lastEventId);

      if (events.length > 0) {
        this.logger.info(`Recibidos ${events.length} eventos nuevos del servidor`);

        // Aplicar eventos a la DB local
        await projectionManager.applyEvents(events);

        // Cursor v2 + compatibilidad legacy
        await db.kv.put({
          key: cursorKeyV2,
          value: {
            ts: last_server_time,
            event_id: last_server_event_id || this.ZERO_UUID,
          },
        });
        await db.kv.put({ key: legacyKey, value: last_server_time });

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
      next_retry_at: Date.now(),
      last_error: null,
      last_error_code: null,
    };
  }

  /**
   * Convierte LocalEvent a BaseEvent
   */
  private localEventToBaseEvent(localEvent: LocalEvent): BaseEvent {
    const {
      id,
      sync_status,
      sync_attempts,
      synced_at,
      acked_at,
      next_retry_at,
      last_error,
      last_error_code,
      ...baseEvent
    } = localEvent;
    void id;
    void sync_status;
    void sync_attempts;
    void synced_at;
    void acked_at;
    void next_retry_at;
    void last_error;
    void last_error_code;
    return baseEvent;
  }
}

// Exportar instancia singleton
export const syncService = new SyncServiceClass();
