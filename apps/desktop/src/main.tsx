import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/mobile-optimizations.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import ErrorBoundary from './components/errors/ErrorBoundary'

// Desktop app doesn't need PWA registration or SW logic

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401 || error?.isAuthError) {
          console.warn('[React Query] 401 detected - NO RETRY');
          return false;
        }
        if (error?.isOffline || error?.code === 'ERR_INTERNET_DISCONNECTED') {
          console.warn('[React Query] Offline detected - NO RETRY');
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
    },
    mutations: {
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401 || error?.isAuthError) {
          return false;
        }
        if (error?.isOffline || error?.code === 'ERR_INTERNET_DISCONNECTED') {
          return false;
        }
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
