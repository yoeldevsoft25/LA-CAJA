/**
 * Background Sync Handler para Service Worker
 * 
 * Este archivo se importa en el Service Worker generado por Workbox
 * para manejar sincronización de eventos cuando la app está cerrada
 */

declare const self: ServiceWorkerGlobalScope;

/**
 * Handler para Background Sync API
 * Se ejecuta cuando el navegador determina que hay conexión disponible
 */
self.addEventListener('sync', (event: Event) => {
  const syncEvent = event as any as { tag: string; waitUntil: (promise: Promise<any>) => void };
  if (syncEvent.tag === 'sync-events') {
    syncEvent.waitUntil(flushOutboxFromServiceWorker());
  }
});

/**
 * Lee eventos pendientes de IndexedDB y los sincroniza con el servidor
 * Este código se ejecuta en el contexto del Service Worker
 */
async function flushOutboxFromServiceWorker(): Promise<void> {
  console.log('[SW] Background sync: sincronizando eventos pendientes...');

  try {
    // Abrir IndexedDB desde Service Worker
    const dbName = 'la-caja-db';
    const dbVersion = 1;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);

      request.onsuccess = async () => {
        const db = request.result;
        
        try {
          // Obtener todos los eventos pendientes
          const transaction = db.transaction(['localEvents'], 'readonly');
          const store = transaction.objectStore('localEvents');
          const index = store.index('sync_status');
          const pendingQuery = index.getAll('pending');

          pendingQuery.onsuccess = async () => {
            const pendingEvents = pendingQuery.result;
            
            if (pendingEvents.length === 0) {
              console.log('[SW] No hay eventos pendientes para sincronizar');
              resolve();
              return;
            }

            console.log(`[SW] Encontrados ${pendingEvents.length} eventos pendientes`);

            // Agrupar eventos por store_id y device_id
            const eventsByDevice = new Map<string, any[]>();
            
            for (const event of pendingEvents) {
              const key = `${event.store_id}:${event.device_id}`;
              if (!eventsByDevice.has(key)) {
                eventsByDevice.set(key, []);
              }
              eventsByDevice.get(key)!.push(event);
            }

            // Sincronizar cada grupo
            const syncPromises: Promise<void>[] = [];
            
            for (const [key, events] of eventsByDevice.entries()) {
              const [storeId, deviceId] = key.split(':');
              
              const syncPromise = syncEventsBatch(storeId, deviceId, events);
              syncPromises.push(syncPromise);
            }

            await Promise.all(syncPromises);
            console.log('[SW] ✅ Background sync completado');
            resolve();
          };

          pendingQuery.onerror = () => {
            console.error('[SW] Error leyendo eventos pendientes:', pendingQuery.error);
            reject(pendingQuery.error);
          };
        } catch (error) {
          console.error('[SW] Error en background sync:', error);
          reject(error);
        } finally {
          db.close();
        }
      };

      request.onerror = () => {
        console.error('[SW] Error abriendo IndexedDB:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[SW] Error en flushOutboxFromServiceWorker:', error);
    throw error;
  }
}

/**
 * Sincroniza un batch de eventos con el servidor
 */
async function syncEventsBatch(
  storeId: string,
  deviceId: string,
  events: any[]
): Promise<void> {
  // Convertir eventos local a formato BaseEvent
  const baseEvents = events.map((le: any) => {
    const { id, sync_status, sync_attempts, synced_at, ...baseEvent } = le;
    return baseEvent;
  });

  try {
    // Obtener el origen de la API desde el cliente
    // En el Service Worker, usamos la primera opción disponible
    const apiOrigin = self.location.origin.includes('localhost') 
      ? 'http://localhost:3001' 
      : 'https://la-caja-api.onrender.com';

    const response = await fetch(`${apiOrigin}/api/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Nota: En un Service Worker real, necesitarías obtener el token del cliente
        // Por ahora, esto puede fallar sin autenticación, pero el intento de sync
        // es mejor que no intentar nada
      },
      body: JSON.stringify({
        store_id: storeId,
        device_id: deviceId,
        client_version: '1.0.0',
        events: baseEvents,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    // Actualizar estado de eventos sincronizados
    if (result.accepted && result.accepted.length > 0) {
      await updateEventsStatus(result.accepted.map((a: any) => a.event_id), 'synced');
    }

    if (result.rejected && result.rejected.length > 0) {
      // Marcar como failed solo si no es un error de conexión
      for (const rejected of result.rejected) {
        if (!rejected.message?.includes('Sin conexión') && !rejected.message?.includes('offline')) {
          await updateEventStatus(rejected.event_id, 'failed');
        }
      }
    }

    console.log(`[SW] Sincronizados ${result.accepted?.length || 0} eventos`);
  } catch (error: any) {
    console.error('[SW] Error sincronizando batch:', error);
    // No actualizar estado si es error de conexión - se reintentará más tarde
    if (!error.message?.includes('Failed to fetch') && !error.message?.includes('network')) {
      // Error de validación u otro error: marcar como failed
      for (const event of events) {
        await updateEventStatus(event.event_id, 'failed');
      }
    }
    throw error;
  }
}

/**
 * Actualiza el estado de múltiples eventos
 */
async function updateEventsStatus(eventIds: string[], status: 'synced' | 'failed'): Promise<void> {
  const dbName = 'la-caja-db';
  const dbVersion = 1;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['localEvents'], 'readwrite');
      const store = transaction.objectStore('localEvents');
      const index = store.index('event_id');

      let completed = 0;
      const total = eventIds.length;

      if (total === 0) {
        resolve();
        return;
      }

      for (const eventId of eventIds) {
        const getRequest = index.get(eventId);
        
        getRequest.onsuccess = () => {
          const event = getRequest.result;
          if (event) {
            const update = {
              sync_status: status,
              synced_at: status === 'synced' ? Date.now() : event.synced_at,
            };
            store.put({ ...event, ...update });
          }
          
          completed++;
          if (completed === total) {
            resolve();
          }
        };

        getRequest.onerror = () => {
          completed++;
          if (completed === total) {
            resolve(); // Continuar aunque haya errores individuales
          }
        };
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Actualiza el estado de un evento
 */
async function updateEventStatus(eventId: string, status: 'synced' | 'failed'): Promise<void> {
  await updateEventsStatus([eventId], status);
}

// Exportar para uso en Service Worker (si se importa como módulo)
export { flushOutboxFromServiceWorker };
