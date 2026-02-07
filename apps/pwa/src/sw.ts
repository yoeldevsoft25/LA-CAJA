/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

// Activar nueva version del SW sin esperar al siguiente hard refresh.
self.skipWaiting()
clientsClaim()

// Precachear assets generados por Vite
precacheAndRoute(self.__WB_MANIFEST)

// Limpiar caches antiguos
cleanupOutdatedCaches()

// 1. Estrategia para Navegación (HTML)
registerRoute(
    new NavigationRoute(new NetworkFirst({
        cacheName: 'html-cache',
        plugins: [
            new CacheableResponsePlugin({ statuses: [200] }),
            new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 })
        ]
    }), {
        denylist: [/^\/api\//, /^\/socket\.io\//]
    })
)

// 2. Caché para Imágenes
registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
        cacheName: 'image-cache',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }) // 30 días
        ]
    })
)

// 3. Caché para API (Lecturas críticas)
registerRoute(
    ({ url }) => url.pathname.startsWith('/api/') && !url.pathname.includes('/auth/'),
    new NetworkFirst({
        cacheName: 'api-read-cache',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 24 * 60 * 60 }) // 1 día
        ],
        networkTimeoutSeconds: 15 // Incrementado para manejar latencia de Render/Supabase
    })
)

// 4. Google Fonts Caching (StaleWhileRevalidate/CacheFirst)
registerRoute(
    ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
    new CacheFirst({
        cacheName: 'google-fonts',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }),
        ],
    })
);


// ===== BACKGROUND SYNC =====

interface SyncEvent extends ExtendableEvent {
    readonly tag: string;
    readonly lastChance: boolean;
}

self.addEventListener('sync', (event: Event) => {
    const syncEvent = event as SyncEvent;
    if (syncEvent.tag === 'sync-events') {
        console.log('[SW] Background Sync triggered: sync-events');
        syncEvent.waitUntil(syncEvents())
    }
})

// ===== PERIODIC BACKGROUND SYNC =====
interface PeriodicSyncEvent extends ExtendableEvent {
    readonly tag: string;
}

// @ts-ignore - periodicSync types might be missing
self.addEventListener('periodicsync', (event: Event) => {
    const periodicEvent = event as PeriodicSyncEvent;
    if (periodicEvent.tag === 'update-catalogs') {
        console.log('[SW] Periodic Sync triggered: update-catalogs');
        periodicEvent.waitUntil(updateCatalogs())
    }
})

async function updateCatalogs() {
    console.log('[SW] Updating catalogs...');
    try {
        const apiUrlEntry = await db.kv.get('api_url')
        const apiUrl = apiUrlEntry?.value
        if (!apiUrl) return;

        // Fetch products, prices, customers logic here...
        // For now, simple logging as placeholder for full logic
        console.log('[SW] Catalog update simulation complete');
    } catch (err) {
        console.error('[SW] Catalog update failed', err);
    }
}


// Simulación de sync de eventos (se integrará con SyncService más tarde)
// Integración real con Dexie y API
// Importamos db desde database (Vite lo bundlizará)
import { db } from '@/db/database'

const PUSH_LOCK_KEY = 'sync_push_lock'
const PUSH_LOCK_TTL_MS = 15_000
const SW_PUSH_LOCK_OWNER = `sw-${crypto.randomUUID()}`

const CRITICAL_EVENT_TYPES = [
    'SaleCreated',
    'StockReceived',
    'StockAdjusted',
    'CashSessionOpened',
    'CashSessionClosed',
    'DebtPaymentRecorded',
    'SaleVoided',
    'CashLedgerEntryCreated',
];

async function generatePayloadHash(payload: any): Promise<string> {
    try {
        const json = JSON.stringify(payload, Object.keys(payload || {}).sort());
        const msgUint8 = new TextEncoder().encode(json);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
        console.error('[SW] Error generando hash de payload', error);
        return 'hash_error';
    }
}

async function prepareEventsForPush(events: any[]) {
    const prepared = [];
    for (const event of events) {
        const payload = { ...(event?.payload || {}) };
        delete payload.store_id;
        delete payload.device_id;

        const baseEvent: any = {
            event_id: event.event_id,
            seq: event.seq,
            type: event.type,
            version: event.version,
            created_at: event.created_at,
            actor: event.actor,
            payload,
            ...(event.vector_clock ? { vector_clock: event.vector_clock } : {}),
            ...(event.causal_dependencies ? { causal_dependencies: event.causal_dependencies } : {}),
        };

        // ⚡ CRDT MAX: Asegurar delta_payload y full_payload_hash para eventos críticos
        if (CRITICAL_EVENT_TYPES.includes(baseEvent.type)) {
            baseEvent.delta_payload = event.delta_payload || payload;
            baseEvent.full_payload_hash = event.full_payload_hash || await generatePayloadHash(baseEvent.delta_payload);
        }

        prepared.push(baseEvent);
    }
    return prepared;
}

async function syncEvents() {
    // 1. Web Locks API: Garantizar que solo un proceso de sincronización ocurra a la vez
    if (!navigator.locks) {
        console.warn('[SW] Web Locks API no disponible, procediendo sin lock');
        return performSync();
    }

    return navigator.locks.request('velox_sync_lock', { ifAvailable: true }, async (lock) => {
        if (!lock) {
            console.log('[SW] ⏭️ Sync omitido: lock "velox_sync_lock" ocupado');
            return;
        }
        return performSync();
    });
}

async function performSync() {
    const startTime = Date.now();
    console.log('[SW] 🚀 Iniciando sincronización de fondo...')

    // Mantener el acquirePushLock legacy por compatibilidad
    const hasPushLock = await acquirePushLock()
    if (!hasPushLock) {
        console.log('[SW] ⏭️ Sync omitido: lock legacy ocupado')
        return
    }

    let batchCount = 0;
    const MAX_BATCHES = 20; // ⚡ SEGURIDAD: Máximo 1000 eventos (20 * 50) por sesión de lock

    try {
        while (batchCount < MAX_BATCHES) {
            batchCount++;

            // 1. Obtener configuración y validar contexto completo
            const apiUrlEntry = await db.kv.get('api_url')
            const tokenEntry = await db.kv.get('auth_token')
            const storeIdEntry = await db.kv.get('store_id')
            const deviceIdEntry = await db.kv.get('device_id')

            const apiUrl = apiUrlEntry?.value
            const token = tokenEntry?.value
            const storeId = storeIdEntry?.value
            const deviceId = deviceIdEntry?.value || await getDeviceId()

            // ✅ Validación completa de contexto
            const missingContext = [];
            if (!apiUrl) missingContext.push('api_url');
            if (!token) missingContext.push('auth_token');
            if (!storeId) missingContext.push('store_id');
            if (!deviceId) missingContext.push('device_id');

            if (missingContext.length > 0) {
                console.warn(`[SW] ⚠️ Contexto incompleto. Faltantes: ${missingContext.join(', ')}. Abortando sync.`)
                console.log('[SW] 📊 Telemetría: sync_aborted', {
                    reason: 'missing_context',
                    missing: missingContext,
                    duration_ms: Date.now() - startTime
                });
                return
            }

            // 2. Obtener eventos pendientes
            const pendingEvents = await db.getPendingEvents(50)

            if (pendingEvents.length === 0) {
                if (batchCount === 1) console.log('[SW] ✅ No hay eventos pendientes.');
                else console.log(`[SW] ✅ Backlog vaciado tras ${batchCount - 1} lotes.`);
                console.log('[SW] 📊 Telemetría: sync_completed', {
                    synced_count: 0, // This might need adjustment if we want total synced across batches
                    duration_ms: Date.now() - startTime
                });
                break;
            }

            console.log(`[SW] 📤 Lote ${batchCount}: Sincronizando ${pendingEvents.length} eventos...`)
            if (batchCount === 1) { // Only log this telemetry for the first batch
                console.log('[SW] 📊 Telemetría: sync_started', {
                    pending_count: pendingEvents.length,
                    queue_depth: pendingEvents.length
                });
            }


            const sanitizedEvents = await prepareEventsForPush(pendingEvents)
            const payload = {
                store_id: storeId,
                device_id: deviceId,
                client_version: 'pwa-sw-1.1.0', // Updated version
                events: sanitizedEvents
            }

            // 4. Enviar a API con TIMEOUT
            const fetchStartTime = Date.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

            let response: Response;
            try {
                response = await fetch(`${apiUrl}/sync/push`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        ...getNgrokHeaders(apiUrl),
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeoutId);
            }

            const fetchDuration = Date.now() - fetchStartTime;

            if (!response.ok) {
                const errorBody = await response.text().catch(() => 'No response body');
                const errorMessage = `HTTP ${response.status}: ${response.statusText}`;

                console.error(`[SW] ❌ Error en /sync/push (lote ${batchCount})`, {
                    status: response.status,
                    statusText: response.statusText,
                    endpoint: `${apiUrl}/sync/push`,
                    body: errorBody,
                    duration_ms: fetchDuration
                });

                console.log('[SW] 📊 Telemetría: sync_failed', {
                    error: errorMessage,
                    status: response.status,
                    endpoint: '/sync/push',
                    pending_count: pendingEvents.length,
                    duration_ms: Date.now() - startTime
                });

                // Si es 400, loguear payload para debugging
                if (response.status === 400) {
                    console.error('[SW] 🔍 Payload que causó 400:', JSON.stringify(payload, null, 2));
                    console.log('[SW] 📊 Telemetría: validation_error', {
                        status: 400,
                        events_count: payload.events.length,
                        store_id: payload.store_id,
                        device_id: payload.device_id
                    });
                }
                throw new Error(errorMessage); // Propagate error to outer catch
            }

            const result = await response.json()

            // 5. Procesar respuesta
            let acceptedCount = 0;
            let rejectedCount = 0;
            let conflictedCount = 0;

            if (result.accepted && result.accepted.length > 0) {
                acceptedCount = result.accepted.length;
                await Promise.all(result.accepted.map((ack: any) =>
                    db.localEvents.where('event_id').equals(ack.event_id).modify({
                        sync_status: 'synced',
                        synced_at: Date.now()
                    })
                ));
            }

            if (result.rejected && result.rejected.length > 0) {
                rejectedCount = result.rejected.length;
                await Promise.all(result.rejected.map((rej: any) =>
                    db.localEvents.where('event_id').equals(rej.event_id).modify({
                        sync_status: 'dead',
                        last_error: rej.message,
                        last_error_code: rej.code || 'REJECTED',
                        next_retry_at: 0,
                    })
                ));
                console.warn('[SW] ⚠️ Eventos rechazados en servidor:', result.rejected);
            }

            if (result.conflicted && result.conflicted.length > 0) {
                conflictedCount = result.conflicted.length;
                await Promise.all(result.conflicted.map((conf: any) =>
                    db.localEvents.where('event_id').equals(conf.event_id).modify({
                        sync_status: 'conflict'
                    })
                ));
                console.warn('[SW] ⚠️ Eventos en conflicto:', result.conflicted);
            }

            const totalDuration = Date.now() - startTime; // Duration up to this point
            console.log(`[SW] ✅ Lote ${batchCount} completado en ${Date.now() - fetchStartTime}ms`);
            console.log('[SW] 📊 Telemetría: sync_batch_success', {
                batch_num: batchCount,
                accepted_count: acceptedCount,
                rejected_count: rejectedCount,
                conflicted_count: conflictedCount,
                batch_duration_ms: Date.now() - fetchStartTime,
                total_duration_ms: totalDuration
            });

            // 6. Verificar si quedan más eventos para continuar el bucle
            const remaining = await db.getPendingEvents(1)
            if (remaining.length === 0) {
                console.log(`[SW] ✅ Sincronización terminada con éxito (${batchCount} lotes).`);
                console.log('[SW] 📊 Telemetría: sync_completed', {
                    total_batches: batchCount,
                    total_duration_ms: totalDuration
                });
                break;
            }
        }

        if (batchCount >= MAX_BATCHES) {
            console.warn(`[SW] ⚠️ Límite de ${MAX_BATCHES} lotes alcanzado. Pausando para evitar bucles infinitos.`);
            console.log('[SW] 📊 Telemetría: sync_limit_reached', {
                max_batches: MAX_BATCHES,
                total_duration_ms: Date.now() - startTime
            });
        }

    } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error('[SW] ❌ Error fatal en proceso de sync:', error);
        console.log('[SW] 📊 Telemetría: sync_error', {
            error: error?.message || 'Unknown error',
            error_name: error?.name,
            duration_ms: duration
        });
        // No relanzar error para evitar reintentos infinitos inmediatos del navegador
    } finally {
        await releasePushLock()
    }
}

async function acquirePushLock(): Promise<boolean> {
    const now = Date.now()
    const expiresAt = now + PUSH_LOCK_TTL_MS
    let acquired = false

    await db.transaction('rw', db.kv, async () => {
        const current = await db.kv.get(PUSH_LOCK_KEY)
        const lock = current?.value as { owner?: string; expiresAt?: number } | undefined
        const isExpired = !lock?.expiresAt || lock.expiresAt <= now
        const isMine = lock?.owner === SW_PUSH_LOCK_OWNER

        if (!lock || isExpired || isMine) {
            await db.kv.put({
                key: PUSH_LOCK_KEY,
                value: {
                    owner: SW_PUSH_LOCK_OWNER,
                    context: 'sw',
                    acquiredAt: now,
                    expiresAt,
                },
            })
            acquired = true
        }
    })

    return acquired
}

async function releasePushLock(): Promise<void> {
    await db.transaction('rw', db.kv, async () => {
        const current = await db.kv.get(PUSH_LOCK_KEY)
        const lock = current?.value as { owner?: string } | undefined
        if (lock?.owner === SW_PUSH_LOCK_OWNER) {
            await db.kv.delete(PUSH_LOCK_KEY)
        }
    })
}

function getNgrokHeaders(url: string): Record<string, string> {
    return url.includes('ngrok-free.dev') ? { 'ngrok-skip-browser-warning': '1' } : {}
}

async function getDeviceId(): Promise<string> {
    // Intentar leer de IndexedDB si lo guardamos (no lo guardamos explícitamente en KV, pero podríamos)
    // O leer de algún evento existente.
    // Hack: leer del primer evento pendiente si existe
    const event = await db.localEvents.toCollection().first()
    if (event?.device_id) return event.device_id
    return 'unknown-device-sw'
}

// Escuchar skipWaiting
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting()
    }
})
