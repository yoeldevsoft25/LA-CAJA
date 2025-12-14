import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

// En desarrollo, desregistrar cualquier Service Worker existente para evitar problemas de cache
// Esto es especialmente importante cuando se accede desde diferentes hostnames (localhost vs IP)
if (import.meta.env.DEV) {
  // Desregistrar Service Workers de cualquier scope
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      console.log(`[DEV] Hostname: ${window.location.hostname}`)
      console.log(`[DEV] Encontrados ${registrations.length} Service Worker(s) registrados`)
      registrations.forEach((registration) => {
        registration.unregister().then((success) => {
          if (success) {
            console.log(`[DEV] Service Worker desregistrado: ${registration.scope}`)
          } else {
            console.warn(`[DEV] No se pudo desregistrar: ${registration.scope}`)
          }
        })
      })
    })
    
    // Limpiar todos los caches
    if ('caches' in window) {
      caches.keys().then((cacheNames) => {
        console.log(`[DEV] Limpiando ${cacheNames.length} cache(s)`)
        cacheNames.forEach((cacheName) => {
          caches.delete(cacheName).then((deleted) => {
            if (deleted) {
              console.log(`[DEV] Cache eliminado: ${cacheName}`)
            }
          })
        })
      })
    }
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
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
