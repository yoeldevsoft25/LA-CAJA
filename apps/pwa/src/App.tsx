import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/layout/ProtectedRoute'
import MainLayout from './components/layout/MainLayout'
import POSPage from './pages/POSPage'
import ProductsPage from './pages/ProductsPage'
import InventoryPage from './pages/InventoryPage'
import SalesPage from './pages/SalesPage'
import CashPage from './pages/CashPage'
import CustomersPage from './pages/CustomersPage'
import DebtsPage from './pages/DebtsPage'
import ReportsPage from './pages/ReportsPage'
import LicenseBlockedPage from './pages/LicenseBlockedPage'
import AdminPage from './pages/AdminPage'
import { useOnline } from './hooks/use-online'
import { useAuth } from './stores/auth.store'
import { offlineIndicator } from './services/offline-indicator.service'
import { syncService } from './services/sync.service'

function App() {
  const { user } = useAuth()
  const { isOnline, wasOffline } = useOnline();

  // Rehidratar el sync service si hay sesión persistida
  useEffect(() => {
    if (user?.store_id) {
      syncService.ensureInitialized(user.store_id).catch((error) => {
        console.error('[SyncService] Error al rehidratar:', error)
      })
    }
  }, [user?.store_id])

  // Manejar cambios de conectividad
  useEffect(() => {
    if (!isOnline) {
      offlineIndicator.showOffline();
    } else {
      offlineIndicator.showOnline();
      // Intentar sincronizar cuando se recupera la conexión
      if (wasOffline) {
        syncService.syncNow().catch(() => {
          // Silenciar errores, el sync periódico lo intentará de nuevo
        });
      }
    }
  }, [isOnline, wasOffline]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
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
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/pos" replace />} />
          <Route path="pos" element={<POSPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="cash" element={<CashPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="debts" element={<DebtsPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
