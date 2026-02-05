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
        networkTimeoutSeconds: 5 // increased timeout
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

function sanitizeEventForPush(event: any) {
    const payload = { ...(event?.payload || {}) }
    delete payload.store_id
    delete payload.device_id

    return {
        event_id: event.event_id,
        seq: event.seq,
        type: event.type,
        version: event.version,
        created_at: event.created_at,
        actor: event.actor,
        payload,
        // Optional fields accepted by backend DTO
        ...(event.vector_clock ? { vector_clock: event.vector_clock } : {}),
        ...(event.causal_dependencies ? { causal_dependencies: event.causal_dependencies } : {}),
        ...(event.delta_payload ? { delta_payload: event.delta_payload } : {}),
        ...(event.full_payload_hash ? { full_payload_hash: event.full_payload_hash } : {}),
    }
}

async function syncEvents() {
    const startTime = Date.now();
    console.log('[SW] 🚀 Iniciando sincronización de fondo...')

    try {
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
            console.log('[SW] ✅ No hay eventos pendientes.')
            console.log('[SW] 📊 Telemetría: sync_completed', {
                synced_count: 0,
                duration_ms: Date.now() - startTime
            });
            return
        }

        console.log(`[SW] 📤 Sincronizando ${pendingEvents.length} eventos...`)
        console.log('[SW] 📊 Telemetría: sync_started', {
            pending_count: pendingEvents.length,
            queue_depth: pendingEvents.length
        });

        // 3. Preparar payload (igual que SyncService)
        // ⚡ IMPORTANTE: El backend NO espera store_id/device_id dentro de cada evento
        // Solo en el DTO principal. Removerlos explícitamente.
        const payload = {
            store_id: storeId,
            device_id: deviceId,
            client_version: 'pwa-sw-1.0.0',
            // Canonicalizar a esquema del backend (forbidNonWhitelisted=true)
            events: pendingEvents.map((e) => sanitizeEventForPush(e))
        }

        // 4. Enviar a API con telemetría
        const fetchStartTime = Date.now();
        const response = await fetch(`${apiUrl}/sync/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...getNgrokHeaders(apiUrl),
            },
            body: JSON.stringify(payload)
        })

        const fetchDuration = Date.now() - fetchStartTime;

        // ✅ Manejo mejorado de errores HTTP
        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'No response body');
            const errorMessage = `HTTP ${response.status}: ${response.statusText}`;

            console.error(`[SW] ❌ Error en /sync/push`, {
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

            throw new Error(errorMessage)
        }

        const result = await response.json()

        // 5. Procesar respuesta (actualizar estados en DB)
        let acceptedCount = 0;
        let rejectedCount = 0;
        let conflictedCount = 0;

        // Marcar aceptados
        if (result.accepted && result.accepted.length > 0) {
            acceptedCount = result.accepted.length;
            const updates = result.accepted.map((ack: any) => {
                return db.localEvents.where('event_id').equals(ack.event_id).modify({
                    sync_status: 'synced',
                    synced_at: Date.now()
                })
            })
            await Promise.all(updates)
        }

        // Marcar rechazados
        if (result.rejected && result.rejected.length > 0) {
            rejectedCount = result.rejected.length;
            const updates = result.rejected.map((rej: any) => {
                return db.localEvents.where('event_id').equals(rej.event_id).modify({
                    // Rechazo del servidor = error permanente (DLQ local)
                    sync_status: 'dead',
                    last_error: rej.message,
                    last_error_code: rej.code || 'REJECTED',
                    next_retry_at: 0,
                })
            })
            await Promise.all(updates)

            console.warn('[SW] ⚠️ Eventos rechazados:', result.rejected);
        }

        // Marcar conflictos
        if (result.conflicted && result.conflicted.length > 0) {
            conflictedCount = result.conflicted.length;
            const updates = result.conflicted.map((conf: any) => {
                return db.localEvents.where('event_id').equals(conf.event_id).modify({
                    sync_status: 'conflict'
                })
            })
            await Promise.all(updates)

            console.warn('[SW] ⚠️ Eventos en conflicto:', result.conflicted);
        }

        const totalDuration = Date.now() - startTime;
        console.log(`[SW] ✅ Sincronización completada en ${totalDuration}ms`)
        console.log('[SW] 📊 Telemetría: sync_success', {
            accepted_count: acceptedCount,
            rejected_count: rejectedCount,
            conflicted_count: conflictedCount,
            total_duration_ms: totalDuration,
            fetch_duration_ms: fetchDuration
        });

        // Si hay más eventos, volver a intentar (recursivo o loop)
        const remaining = await db.getPendingEvents(1)
        if (remaining.length > 0) {
            console.log(`[SW] 🔄 Quedan ${remaining.length} eventos, continuando...`);
            // Evita recursión profunda en backlogs grandes.
            setTimeout(() => {
                void syncEvents();
            }, 0);
        }

    } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error('[SW] ❌ Error en sincronización:', error)
        console.log('[SW] 📊 Telemetría: sync_error', {
            error: error?.message || 'Unknown error',
            error_name: error?.name,
            duration_ms: duration
        });
        // No relanzar error para evitar reintentos infinitos inmediatos del navegador
    }
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
