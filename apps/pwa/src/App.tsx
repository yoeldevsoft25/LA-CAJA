import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import SimpleLoader from './components/loader/SimpleLoader'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/layout/ProtectedRoute'
import MainLayout from './components/layout/MainLayout'
import POSPage from './pages/POSPage'
import ProductsPage from './pages/ProductsPage'
import InventoryPage from './pages/InventoryPage'
import SalesPage from './pages/SalesPage'
import CashPage from './pages/CashPage'
import ShiftsPage from './pages/ShiftsPage'
import PaymentsPage from './pages/PaymentsPage'
import DiscountsPage from './pages/DiscountsPage'
import FastCheckoutPage from './pages/FastCheckoutPage'
import CustomersPage from './pages/CustomersPage'
import DebtsPage from './pages/DebtsPage'
import ReportsPage from './pages/ReportsPage'
import LotsPage from './pages/LotsPage'
import InvoiceSeriesPage from './pages/InvoiceSeriesPage'
import TablesPage from './pages/TablesPage'
import PeripheralsPage from './pages/PeripheralsPage'
import PriceListsPage from './pages/PriceListsPage'
import PromotionsPage from './pages/PromotionsPage'
import WarehousesPage from './pages/WarehousesPage'
import TransfersPage from './pages/TransfersPage'
import SuppliersPage from './pages/SuppliersPage'
import PurchaseOrdersPage from './pages/PurchaseOrdersPage'
import FiscalConfigPage from './pages/FiscalConfigPage'
import FiscalInvoicesPage from './pages/FiscalInvoicesPage'
import FiscalInvoiceDetailPage from './pages/FiscalInvoiceDetailPage'
import DashboardPage from './pages/DashboardPage'
import MLDashboardPage from './pages/MLDashboardPage'
import DemandPredictionsPage from './pages/DemandPredictionsPage'
import AnomaliesPage from './pages/AnomaliesPage'
import RealtimeAnalyticsPage from './pages/RealtimeAnalyticsPage'
import LicenseBlockedPage from './pages/LicenseBlockedPage'
import AdminPage from './pages/AdminPage'
import LandingPageEnhanced from './pages/LandingPageEnhanced'
import AccountingPage from './pages/AccountingPage'
import { useOnline } from './hooks/use-online'
import { useAuth } from './stores/auth.store'
import { offlineIndicator } from './services/offline-indicator.service'
import { syncService } from './services/sync.service'
import { realtimeWebSocketService } from './services/realtime-websocket.service'
import { usePushNotifications } from './hooks/usePushNotifications'

function App() {
  const { user, isAuthenticated, showLoader: authShowLoader, setShowLoader } = useAuth()
  const { isOnline, wasOffline } = useOnline()
  const { isSupported, subscribe } = usePushNotifications()
  const [isLoaderComplete, setIsLoaderComplete] = useState(false)

  // Rehidratar el sync service si hay sesión persistida
  useEffect(() => {
    if (user?.store_id) {
      syncService.ensureInitialized(user.store_id).catch((error) => {
        console.error('[SyncService] Error al rehidratar:', error)
      })
    }
  }, [user?.store_id])

  // Conectar WebSocket de analytics en tiempo real
  useEffect(() => {
    if (isAuthenticated && user) {
      realtimeWebSocketService.connect()
    } else {
      realtimeWebSocketService.disconnect()
    }

    return () => {
      // No desconectar aquí, dejar que se maneje automáticamente
    }
  }, [isAuthenticated, user])

  // Manejar cambios de conectividad
  useEffect(() => {
    if (!isOnline) {
      offlineIndicator.showOffline();
      return;
    }

    if (wasOffline) {
      offlineIndicator.showOnline();
      // Intentar sincronizar cuando se recupera la conexión
      syncService.syncNow().catch(() => {
        // Silenciar errores, el sync periódico lo intentará de nuevo
      });
    }
  }, [isOnline, wasOffline])

  // Suscribirse a push notifications usando el SW de VitePWA
  useEffect(() => {
    if (isAuthenticated && isSupported && 'serviceWorker' in navigator) {
      // Usar el service worker ya registrado por VitePWA
      navigator.serviceWorker.ready.then(() => {
        console.log('[PushNotifications] Usando Service Worker de VitePWA')
        // Intentar suscribirse después de un pequeño delay
        setTimeout(() => {
          subscribe().catch((error) => {
            // Solo mostrar error si no es por falta de configuración
            if (import.meta.env.DEV && error?.message && !error.message.includes('VAPID')) {
              console.error('[PushNotifications] Error al suscribirse:', error)
            }
          })
        }, 2000)
      }).catch((error) => {
        console.error('[PushNotifications] Service Worker no disponible:', error)
      })
    }
  }, [isAuthenticated, isSupported, subscribe])

  // Set initial loader state
  useEffect(() => {
    if (!isAuthenticated) {
      // Si no está autenticado, no mostrar loader
      setIsLoaderComplete(true)
    }
  }, [isAuthenticated])

  // Trigger loader when user logs in
  useEffect(() => {
    if (authShowLoader && isAuthenticated) {
      setIsLoaderComplete(false)
    }
  }, [authShowLoader, isAuthenticated])

  const handleLoaderComplete = () => {
    setShowLoader(false)
    setIsLoaderComplete(true)
  }

  return (
    <>
      {authShowLoader && !isLoaderComplete && (
        <SimpleLoader 
          onComplete={handleLoaderComplete} 
          duration={4000}
          userName={user?.full_name}
        />
      )}
      {(isLoaderComplete || !authShowLoader) && (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route
          path="/"
          element={
            isAuthenticated ? <Navigate to="/app/dashboard" replace /> : <LandingPageEnhanced />
          }
        />
        <Route path="/landing" element={<LandingPageEnhanced />} />
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/app/dashboard" replace /> : <LoginPage />
          }
        />
        <Route
          path="/license"
          element={
            <ProtectedRoute allowLicenseBlocked>
              <LicenseBlockedPage />
            </ProtectedRoute>
          }
        />
        {/* Panel admin: acceso directo con admin key, no requiere sesión */}
        <Route path="/admin" element={<AdminPage />} />

        {/* Protected routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="pos" element={<POSPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="cash" element={<CashPage />} />
          <Route path="shifts" element={<ShiftsPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="discounts" element={<DiscountsPage />} />
          <Route path="fast-checkout" element={<FastCheckoutPage />} />
          <Route path="lots" element={<LotsPage />} />
          <Route path="invoice-series" element={<InvoiceSeriesPage />} />
          <Route path="tables" element={<TablesPage />} />
          <Route path="peripherals" element={<PeripheralsPage />} />
          <Route path="price-lists" element={<PriceListsPage />} />
          <Route path="promotions" element={<PromotionsPage />} />
          <Route path="warehouses" element={<WarehousesPage />} />
          <Route path="transfers" element={<TransfersPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="fiscal-config" element={<FiscalConfigPage />} />
          <Route path="fiscal-invoices" element={<FiscalInvoicesPage />} />
          <Route path="fiscal-invoices/:id" element={<FiscalInvoiceDetailPage />} />
          <Route path="ml" element={<MLDashboardPage />} />
          <Route path="ml/predictions" element={<DemandPredictionsPage />} />
          <Route path="ml/anomalies" element={<AnomaliesPage />} />
          <Route path="realtime-analytics" element={<RealtimeAnalyticsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="debts" element={<DebtsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="accounting" element={<AccountingPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
      )}
    </>
  )
}

export default App
