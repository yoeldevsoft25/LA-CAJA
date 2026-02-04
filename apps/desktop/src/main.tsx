import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/mobile-optimizations.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import ErrorBoundary from './components/errors/ErrorBoundary'
import { registerSW } from 'virtual:pwa-register'

const BUILD_ID = __PWA_BUILD_ID__
let buildCheckInFlight = false

const clearServiceWorkerCaches = async () => {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }

  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }
}

const fetchServerBuildId = async (): Promise<string | null> => {
  try {
    const response = await fetch('/version.json', { cache: 'no-store' })
    if (!response.ok) return null
    const data = await response.json().catch(() => null)
    return typeof data?.buildId === 'string' ? data.buildId : null
  } catch {
    return null
  }
}

const hardRefreshIfBuildMismatch = async () => {
  if (!navigator.onLine || buildCheckInFlight) return
  buildCheckInFlight = true

  try {
    const serverBuildId = await fetchServerBuildId()
    if (!serverBuildId || serverBuildId === BUILD_ID) return

    console.warn('[PWA] Build mismatch detected. Purging caches and reloading.', {
      localBuildId: BUILD_ID,
      serverBuildId,
    })
    await clearServiceWorkerCaches()
    window.location.reload()
  } finally {
    buildCheckInFlight = false
  }
}



// ✅ OFFLINE-FIRST: Solicitar persistencia de almacenamiento para evitar borrado automático
const enablePersistentStorage = async () => {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted();
    console.log(`[Storage] Persisted: ${isPersisted}`);
    if (!isPersisted) {
      const result = await navigator.storage.persist();
      console.log(`[Storage] Request Persist Result: ${result}`);
    }
  }
};

const registerPeriodicSync = async (registration: ServiceWorkerRegistration) => {
  if ('periodicSync' in registration && registration.active) {
    try {
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync' as any,
      });
      if (status.state === 'granted') {
        // @ts-ignore
        await registration.periodicSync.register('update-catalogs', {
          minInterval: 24 * 60 * 60 * 1000, // 24 horas
        });
        console.log('[PWA] Periodic Sync registrado: update-catalogs');
      } else {
        console.warn('[PWA] Permiso para Periodic Sync no otorgado');
      }
    } catch (error) {
      console.error('[PWA] Error registrando Periodic Sync:', error);
    }
  }
};

const setupPwaUpdates = () => {
  if (!('serviceWorker' in navigator)) return

  let updateSW: (reloadPage?: boolean) => void = () => undefined

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] Service Worker update detected. Waiting for idle moment...')
      if (confirm('Nueva versión disponible. ¿Actualizar ahora para asegurar funciones offline?')) {
        updateSW(true)
      }
    },
    onOfflineReady() {
      console.log('[PWA] App lista para usar offline')
    },
    onRegisteredSW(_swUrl, registration) {
      void hardRefreshIfBuildMismatch()
      // Chequear actualizaciones periódicamente (cada hora)
      if (registration) {
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)

        // Registrar Periodic Sync
        void registerPeriodicSync(registration);
      }
    },
    onRegisterError(error: unknown) {
      console.warn('[PWA] Error registrando Service Worker:', error)
    },
  })

  void hardRefreshIfBuildMismatch()
  window.addEventListener('online', () => void hardRefreshIfBuildMismatch())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void hardRefreshIfBuildMismatch()
    }
  })
}

void enablePersistentStorage();
setupPwaUpdates()


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutos por defecto - aprovechar vistas materializadas para datos más frescos
      gcTime: 1000 * 60 * 10, // 10 minutos - mantener en caché tiempo razonable
      retry: (failureCount, error: any) => {
        // ✅ OFFLINE-FIRST: NUNCA reintentar errores de autenticación (401)
        if (error?.response?.status === 401 || error?.isAuthError) {
          console.warn('[React Query] 401 detected - NO RETRY');
          return false;
        }

        // ✅ OFFLINE-FIRST: NUNCA reintentar errores offline (ya están manejados)
        if (error?.isOffline || error?.code === 'ERR_INTERNET_DISCONNECTED') {
          console.warn('[React Query] Offline detected - NO RETRY');
          return false;
        }

        // Para otros errores, reintentar máximo 2 veces
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: false, // No refetch automático al cambiar de ventana (evitar refetches innecesarios)
      refetchOnReconnect: true, // Refetch cuando se recupera conexión
      refetchOnMount: false, // No refetch al montar si hay datos en caché (usar cache primero)
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // ✅ OFFLINE-FIRST: NUNCA reintentar mutations con errores de auth
        if (error?.response?.status === 401 || error?.isAuthError) {
          return false;
        }

        // ✅ OFFLINE-FIRST: Mutations offline se manejan con sync service
        if (error?.isOffline || error?.code === 'ERR_INTERNET_DISCONNECTED') {
          return false;
        }

        // Reintentar una vez para otros errores
        return failureCount < 1;
      },
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App />
        <Toaster />
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>,
)
