/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare let self: ServiceWorkerGlobalScope

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

async function syncEvents() {
    console.log('[SW] Iniciando sincronización de fondo...')

    try {
        // 1. Obtener configuración
        const apiUrlEntry = await db.kv.get('api_url')
        const tokenEntry = await db.kv.get('auth_token')

        const apiUrl = apiUrlEntry?.value
        const token = tokenEntry?.value

        if (!apiUrl || !token) {
            console.warn('[SW] No hay API URL o token configurado. Abortando sync.')
            return
        }

        // 2. Obtener eventos pendientes
        const pendingEvents = await db.getPendingEvents(50)

        if (pendingEvents.length === 0) {
            console.log('[SW] No hay eventos pendientes.')
            return
        }

        console.log(`[SW] Sincronizando ${pendingEvents.length} eventos...`)

        // 3. Preparar payload (igual que SyncService)
        const storeIdEntry = await db.kv.get('store_id')
        const deviceId = await getDeviceId()

        const payload = {
            store_id: storeIdEntry?.value,
            device_id: deviceId,
            client_version: 'pwa-1.0.0', // Podría venir de config
            events: pendingEvents.map(e => {
                const { id, sync_status, sync_attempts, synced_at, ...rest } = e
                return rest
            })
        }

        // 4. Enviar a API
        const response = await fetch(`${apiUrl}/sync/push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        })

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`)
        }

        const result = await response.json()

        // 5. Procesar respuesta (actualizar estados en DB)
        // Marcar aceptados
        if (result.accepted && result.accepted.length > 0) {
            const updates = result.accepted.map((ack: any) => {
                // Buscar el evento local por event_id
                return db.localEvents.where('event_id').equals(ack.event_id).modify({
                    sync_status: 'synced',
                    synced_at: Date.now()
                })
            })
            await Promise.all(updates)
        }

        // Marcar rechazados/conflictos
        if (result.rejected && result.rejected.length > 0) {
            const updates = result.rejected.map((rej: any) => {
                return db.localEvents.where('event_id').equals(rej.event_id).modify({
                    sync_status: 'failed', // O manejar error específico
                    last_error: rej.message
                })
            })
            await Promise.all(updates)
        }

        if (result.conflicted && result.conflicted.length > 0) {
            // Manejar conflictos
            // ... (lógica simplificada para SW, idealmente marcar como 'conflict')
            const updates = result.conflicted.map((conf: any) => {
                return db.localEvents.where('event_id').equals(conf.event_id).modify({
                    sync_status: 'conflict'
                })
            })
            await Promise.all(updates)
        }

        console.log('[SW] Sincronización completada.')

        // Si hay más eventos, volver a intentar (recursivo o loop)
        // El navegador puede matar el SW, pero 'waitUntil' ayuda.
        const remaining = await db.getPendingEvents(1)
        if (remaining.length > 0) {
            await syncEvents() // Procesar siguiente batch
        }

    } catch (error) {
        console.error('[SW] Error en sincronización:', error)
        // No relanzar error para evitar reintentos infinitos inmediatos del navegador
    }
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
