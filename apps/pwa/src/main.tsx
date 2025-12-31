import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/mobile-optimizations.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

// Registrar Service Worker para soporte offline robusto
if ('serviceWorker' in navigator) {
  // Limpiar Service Workers antiguos de scopes diferentes
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    const currentScope = window.location.origin + '/';
    registrations.forEach((registration) => {
      if (registration.scope !== currentScope) {
        console.log(`[SW] Desregistrando Service Worker de scope diferente: ${registration.scope}`)
        registration.unregister().catch(() => {
          // Ignorar errores
        })
      }
    })
  })

  // Registrar Service Worker cuando la página carga
  window.addEventListener('load', () => {
    // El plugin VitePWA debería registrar automáticamente, pero lo hacemos manualmente como respaldo
    if ('serviceWorker' in navigator) {
      // Esperar un momento para que VitePWA lo registre primero
      setTimeout(() => {
        navigator.serviceWorker.getRegistration().then((registration) => {
          if (!registration) {
            console.warn('[SW] Service Worker no registrado por VitePWA, intentando registro manual...')
            // Intentar registrar manualmente como último recurso
            navigator.serviceWorker.register('/sw.js', { scope: '/' })
              .then((reg) => {
                console.log('[SW] Service Worker registrado manualmente:', reg.scope)
              })
              .catch((err) => {
                console.error('[SW] Error al registrar Service Worker:', err)
              })
          } else {
            console.log('[SW] Service Worker ya registrado:', registration.scope)
          }
        })
      }, 1000)
    }
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutos por defecto - aprovechar vistas materializadas para datos más frescos
      gcTime: 1000 * 60 * 10, // 10 minutos - mantener en caché tiempo razonable
      retry: 2, // Menos reintentos para fallar rápido y usar caché
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: false, // No refetch automático al cambiar de ventana (evitar refetches innecesarios)
      refetchOnReconnect: true, // Refetch cuando se recupera conexión
      refetchOnMount: false, // No refetch al montar si hay datos en caché (usar cache primero)
    },
    mutations: {
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
)
