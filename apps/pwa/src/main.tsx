import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/mobile-optimizations.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

// VitePWA registra automáticamente el Service Worker
// No registrar manualmente para evitar conflictos y loops infinitos

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
