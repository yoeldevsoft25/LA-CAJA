/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute, matchPrecache } from 'workbox-precaching'
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'
import { db } from '@/db/database'

declare let self: ServiceWorkerGlobalScope

// ==============================================================================
// 0. CONFIGURACIÓN & CANALES DE COMUNICACIÓN
// ==============================================================================
const SW_VERSION = '3.0.1-elite-fix';
const SYNC_CHANNEL_NAME = 'sw_sync_channel';
const SYNC_LOCK_NAME = 'sw_sync_process_lock';
const BROADCAST = new BroadcastChannel(SYNC_CHANNEL_NAME);

// Tipos de mensajes para la UI
type SyncMessage =
    | { type: 'SYNC_START' }
    | { type: 'SYNC_PROGRESS'; payload: { processed: number; remaining: boolean } }
    | { type: 'SYNC_SUCCESS'; payload: { count: number } }
    | { type: 'SYNC_ERROR'; payload: { error: string } }
    | { type: 'OFFLINE_MODE' };

const notifyUI = (msg: SyncMessage) => {
    BROADCAST.postMessage({ ...msg, timestamp: Date.now() });
};

// Activar inmediatamente
self.skipWaiting();
clientsClaim();

// ==============================================================================
// 1. GESTIÓN DE CACHÉ & RUTAS (WORKBOX)
// ==============================================================================

// Limpieza de caches viejos y precacheo de assets de Vite
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// --- A. Navegación Principal (HTML) con Fallback Offline ---
registerRoute(
    new NavigationRoute(
        new NetworkFirst({
            cacheName: 'html-nav-v1',
            plugins: [
                new CacheableResponsePlugin({ statuses: [200] }),
                new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 24 * 60 * 60 }), // 24h
            ]
        }),
        {
            // Excluir rutas de API y Sockets
            denylist: [/^\/api\//, /^\/socket\.io\//, /^\/auth\//]
        }
    )
);

// Fallback Crítico: Si falla la red Y la caché
setCatchHandler(async ({ event }) => {
    // Solución al Error 1: TypeScript necesita garantía de retorno de Response
    if ((event as any).request.destination === 'document') {
        notifyUI({ type: 'OFFLINE_MODE' });
        const precachedResponse = await matchPrecache('/offline.html');
        return precachedResponse || Response.error();
    }
    return Response.error();
});

// --- B. Assets Estáticos (Imágenes) ---
registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
        cacheName: 'images-v1',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }) // 30 días
        ]
    })
);

// --- C. API Read (Lecturas críticas pero no Sync) ---
registerRoute(
    ({ url }) => url.pathname.startsWith('/api/') && !url.pathname.includes('/sync'),
    new NetworkFirst({
        cacheName: 'api-read-v1',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 })
        ],
        networkTimeoutSeconds: 10
    })
);

// --- D. Google Fonts ---
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

// ==============================================================================
// 2. MOTOR DE SINCRONIZACIÓN (SYNC ENGINE)
// ==============================================================================

class SyncEngine {
    private readonly BATCH_SIZE = 50;

    // Prepara el evento para cumplir con el DTO del Backend
    private preparePayload(event: any) {
        const { store_id, device_id, sync_status, ...rest } = event;

        return {
            event_id: rest.event_id,
            seq: rest.seq,
            type: rest.type,
            version: rest.version,
            created_at: rest.created_at,
            actor: rest.actor,
            payload: rest.payload || {},
            ...(rest.vector_clock && { vector_clock: rest.vector_clock }),
            ...(rest.causal_dependencies && { causal_dependencies: rest.causal_dependencies }),
        };
    }

    private getHeaders(token: string, apiUrl: string): HeadersInit {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
        if (apiUrl.includes('ngrok')) {
            headers['ngrok-skip-browser-warning'] = '1';
        }
        return headers;
    }

    /**
     * Ejecuta la sincronización usando Web Locks API.
     */
    async run() {
        if (!navigator.locks) {
            console.warn('[SyncEngine] Web Locks no soportado. Ejecutando modo legacy.');
            return this.processBatch();
        }

        await navigator.locks.request(SYNC_LOCK_NAME, { ifAvailable: true }, async (lock) => {
            if (!lock) {
                console.log('[SyncEngine] 🔒 Lock ocupado. Sincronización en curso por otro agente.');
                return;
            }
            await this.processBatch();
        });
    }

    private async processBatch() {
        console.log('[SyncEngine] 🚀 Iniciando ciclo de sincronización...');

        try {
            // 1. Cargar Contexto Crítico
            const [apiUrl, token, storeId, deviceId] = await Promise.all([
                db.kv.get('api_url').then(x => x?.value),
                db.kv.get('auth_token').then(x => x?.value),
                db.kv.get('store_id').then(x => x?.value),
                db.kv.get('device_id').then(x => x?.value)
            ]);

            if (!apiUrl || !token || !storeId) {
                console.warn('[SyncEngine] ⚠️ Falta contexto (URL/Token). Abortando.');
                return;
            }

            notifyUI({ type: 'SYNC_START' });

            // 2. Procesamiento por Lotes
            let totalProcessed = 0;
            let hasMore = true;
            let loopGuard = 0;

            while (hasMore && loopGuard < 100) {
                loopGuard++;
                const pendingEvents = await db.getPendingEvents(this.BATCH_SIZE);

                if (pendingEvents.length === 0) {
                    hasMore = false;
                    break;
                }

                console.log(`[SyncEngine] 📤 Enviando lote de ${pendingEvents.length} eventos...`);

                // 3. Payload
                const payload = {
                    store_id: storeId,
                    device_id: deviceId || 'sw-unknown',
                    client_version: SW_VERSION,
                    events: pendingEvents.map(e => this.preparePayload(e))
                };

                // 4. Request
                const response = await fetch(`${apiUrl}/sync/push`, {
                    method: 'POST',
                    headers: this.getHeaders(token, apiUrl),
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const status = response.status;
                    if (status >= 500) {
                        throw new Error(`Server Error ${status} - Aborting Sync`);
                    }
                    const errorText = await response.text();
                    console.error('[SyncEngine] ❌ Client Error:', errorText);
                    throw new Error(`Validation Error ${status}: ${errorText}`);
                }

                // 5. Procesar Respuesta (ACKs)
                const result = await response.json();

                // Actualización Atómica en Dexie
                await db.transaction('rw', db.localEvents, async () => {
                    // Solución al Error 2 y 3: Tipado explícito del array de Promesas
                    const updates: Promise<any>[] = [];

                    // Aceptados
                    if (result.accepted?.length) {
                        result.accepted.forEach((ack: any) => {
                            updates.push(db.localEvents.update(ack.event_id, {
                                sync_status: 'synced',
                                synced_at: Date.now()
                            }));
                        });
                    }

                    // Rechazados
                    if (result.rejected?.length) {
                        result.rejected.forEach((rej: any) => {
                            updates.push(db.localEvents.update(rej.event_id, {
                                sync_status: 'dead',
                                last_error: rej.message || 'Server rejected',
                                last_error_code: rej.code || 'REJECTED'
                            }));
                        });
                    }

                    // Conflictos
                    if (result.conflicted?.length) {
                        result.conflicted.forEach((conf: any) => {
                            updates.push(db.localEvents.update(conf.event_id, {
                                sync_status: 'conflict'
                            }));
                        });
                    }

                    await Promise.all(updates);
                });

                totalProcessed += pendingEvents.length;

                notifyUI({
                    type: 'SYNC_PROGRESS',
                    payload: { processed: totalProcessed, remaining: true }
                });

                await new Promise(r => setTimeout(r, 50));
            }

            if (totalProcessed > 0) {
                console.log(`[SyncEngine] ✅ Sincronización finalizada. Total: ${totalProcessed}`);
                notifyUI({ type: 'SYNC_SUCCESS', payload: { count: totalProcessed } });
            } else {
                console.log(`[SyncEngine] ✅ Nada pendiente.`);
            }

        } catch (error: any) {
            console.error('[SyncEngine] 💥 Error Crítico:', error);
            notifyUI({ type: 'SYNC_ERROR', payload: { error: error.message || 'Unknown error' } });
        }
    }
}

const engine = new SyncEngine();

// ==============================================================================
// 3. LISTENERS DEL SERVICE WORKER
// ==============================================================================

self.addEventListener('sync', (event: any) => {
    if (event.tag === 'sync-events') {
        console.log('[SW] Background Sync Triggered');
        event.waitUntil(engine.run());
    }
});

self.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'FORCE_SYNC') {
        console.log('[SW] Force Sync Triggered via Message');
        engine.run();
    }
});

self.addEventListener('push', (event) => {
    const data = event.data?.json();
    if (data?.type === 'SYNC_REQUEST') {
        console.log('[SW] Push Triggered Sync');
        event.waitUntil(engine.run());
    }
});