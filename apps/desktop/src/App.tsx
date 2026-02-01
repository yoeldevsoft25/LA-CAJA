import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from '@/lib/toast'
import SimpleLoader from './components/loader/SimpleLoader'
import ProtectedRoute from './components/layout/ProtectedRoute'
import MainLayout from './components/layout/MainLayout'
import { useOnline } from './hooks/use-online'
import { useAuth } from './stores/auth.store'
import { getDefaultRoute } from './lib/permissions'
import { syncService } from './services/sync.service'
import { realtimeWebSocketService } from './services/realtime-websocket.service'
import { usePushNotifications } from './hooks/usePushNotifications'
import { useActivityTracker } from './hooks/use-activity-tracker'
import { useLicenseStatus } from './hooks/use-license-status'
import { Loader2 } from 'lucide-react'

// Componente de loading para Suspense
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Cargando...</p>
    </div>
  </div>
)

// Lazy loading de páginas - Críticas (login/landing)
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const ForgotPinPage = lazy(() => import('./pages/ForgotPinPage'))
const ResetPinPage = lazy(() => import('./pages/ResetPinPage'))
const LandingPageEnhanced = lazy(() => import('./pages/LandingPageEnhanced'))

// POS Page - eager load to prevent blank screen on navigation
import POSPage from './pages/POSPage'

// Preload de rutas críticas para mejor rendimiento
const preloadCriticalRoutes = () => {
  // Precargar rutas más usadas después de login
  Promise.all([
    import('./pages/POSPage'),
    import('./pages/SalesPage'),
    import('./pages/CashPage'),
  ]).catch(() => {
    // Silenciar errores de preload
  })
}

const preloadOwnerRoutes = () => {
  // Precargar rutas de owner después de autenticación
  Promise.all([
    import('./pages/DashboardPage'),
    import('./pages/ProductsPage'),
    import('./pages/InventoryPage'),
    import('./pages/CustomersPage'),
  ]).catch(() => {
    // Silenciar errores de preload
  })
}

// Lazy loading - Páginas de uso frecuente
const SalesPage = lazy(() => import('./pages/SalesPage'))
const ProductsPage = lazy(() => import('./pages/ProductsPage'))
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const InventoryCountPage = lazy(() => import('./pages/InventoryCountPage'))
const CashPage = lazy(() => import('./pages/CashPage'))
const CustomersPage = lazy(() => import('./pages/CustomersPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))

// Lazy loading - Páginas secundarias
const ShiftsPage = lazy(() => import('./pages/ShiftsPage'))
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'))
const DiscountsPage = lazy(() => import('./pages/DiscountsPage'))
const FastCheckoutPage = lazy(() => import('./pages/FastCheckoutPage'))
const DebtsPage = lazy(() => import('./pages/DebtsPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const LotsPage = lazy(() => import('./pages/LotsPage'))
const InvoiceSeriesPage = lazy(() => import('./pages/InvoiceSeriesPage'))
const TablesPage = lazy(() => import('./pages/TablesPage'))
const KitchenDisplayPage = lazy(() => import('./pages/KitchenDisplayPage'))
const ReservationsPage = lazy(() => import('./pages/ReservationsPage'))
const PeripheralsPage = lazy(() => import('./pages/PeripheralsPage'))
const PriceListsPage = lazy(() => import('./pages/PriceListsPage'))
const PromotionsPage = lazy(() => import('./pages/PromotionsPage'))
const WarehousesPage = lazy(() => import('./pages/WarehousesPage'))
const TransfersPage = lazy(() => import('./pages/TransfersPage'))
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'))
const PurchaseOrdersPage = lazy(() => import('./pages/PurchaseOrdersPage'))

// Lazy loading - Páginas de configuración fiscal
const FiscalConfigPage = lazy(() => import('./pages/FiscalConfigPage'))
const FiscalInvoicesPage = lazy(() => import('./pages/FiscalInvoicesPage'))
const FiscalInvoiceDetailPage = lazy(() => import('./pages/FiscalInvoiceDetailPage'))
const WhatsAppConfigPage = lazy(() => import('./pages/WhatsAppConfigPage'))

// Lazy loading - Páginas de ML/Analytics (menos frecuentes)
const MLDashboardPage = lazy(() => import('./pages/MLDashboardPage'))
const DemandPredictionsPage = lazy(() => import('./pages/DemandPredictionsPage'))
const DemandEvaluationPage = lazy(() => import('./pages/DemandEvaluationPage'))
const AnomaliesPage = lazy(() => import('./pages/AnomaliesPage'))
const RealtimeAnalyticsPage = lazy(() => import('./pages/RealtimeAnalyticsPage'))
const ObservabilityPage = lazy(() => import('./pages/ObservabilityPage'))

// Lazy loading - Páginas de administración
const LicenseBlockedPage = lazy(() => import('./pages/LicenseBlockedPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const AdminLayoutEnhanced = lazy(() => import('./components/layout/AdminLayoutEnhanced'));
const LicensePaymentsPage = lazy(() => import('./pages/admin/LicensePaymentsPage'))
const AccountingPage = lazy(() => import('./pages/AccountingPage'))
const ConflictsPage = lazy(() => import('./pages/ConflictsPage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const LicensePage = lazy(() => import('./pages/LicensePage'))
const SecurityPage = lazy(() => import('./pages/SecurityPage'))

// Lazy loading - Páginas públicas (menú QR)
const PublicMenuQRPage = lazy(() => import('./pages/public/PublicMenuQRPage'))
const PublicMenuPage = lazy(() => import('./pages/public/PublicMenuPage'))
const PublicKitchenPage = lazy(() => import('./pages/public/PublicKitchenPage'))

function App() {
  const { user, isAuthenticated, showLoader: authShowLoader, setShowLoader } = useAuth()
  const { isOnline, wasOffline } = useOnline()
  const { isSupported, subscribe } = usePushNotifications()
  const [isLoaderComplete, setIsLoaderComplete] = useState(false)
  const queryClient = useQueryClient()

  // Rastrear actividad del usuario para timeout de inactividad
  useActivityTracker()

  // Rehidratar el sync service si hay sesión persistida
  useEffect(() => {
    if (user?.store_id) {
      syncService.ensureInitialized(user.store_id).catch((error) => {
        console.error('[SyncService] Error al rehidratar:', error)
      })
    }
  }, [user?.store_id])

  // Escuchar eventos de sincronización para invalidar cache y notificar usuario
  useEffect(() => {
    if (!isAuthenticated) return;

    // Callback cuando se completa la sincronización
    const unsubscribeComplete = syncService.onSyncComplete((syncedCount) => {
      console.log('[App] 🔄 Sincronización completada, invalidando cache...', syncedCount, 'eventos');

      // Invalidar cache de React Query para ventas y otros recursos
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      // Mostrar notificación al usuario
      toast.success(`✅ ${syncedCount} ${syncedCount === 1 ? 'venta sincronizada' : 'ventas sincronizadas'}`, {
        duration: 3000,
        icon: '🔄',
      });
    });

    // Callback cuando hay error de sincronización
    const unsubscribeError = syncService.onSyncError((error) => {
      console.error('[App] ❌ Error de sincronización:', error?.message || error);
      // Solo mostrar error si no es por falta de conexión
      if (error?.name !== 'OfflineError' && !error?.message?.includes('Sin conexión')) {
        toast.error('Error al sincronizar datos', {
          duration: 4000,
        });
      }
    });

    // Cleanup: desuscribirse cuando el componente se desmonte
    return () => {
      unsubscribeComplete();
      unsubscribeError();
    };
  }, [isAuthenticated, queryClient])

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
      console.log('[App] 📵 Conexión perdida');
      return;
    }

    if (wasOffline) {
      console.log('[App] 🌐 Conexión recuperada, sincronizando...');
      // Intentar sincronizar cuando se recupera la conexión
      // syncNow() ahora maneja silenciosamente el caso cuando el servicio no está inicializado
      syncService.syncNow().then(() => {
        console.log('[App] ✅ Sincronización manual completada');
      }).catch((err) => {
        // syncNow() ya no debería lanzar errores si no está inicializado,
        // pero capturamos por si acaso hay otros errores
        console.warn('[App] ⚠️ Error en sincronización manual (se reintentará):', err?.message || err);
        // Silenciar errores, el sync periódico lo intentará de nuevo
      });
    }
  }, [isOnline, wasOffline])

  useEffect(() => {
    // Suscribirse a push notifications (solo si el navegador lo soporta y estamos en web)
    if (!isAuthenticated || !isSupported || !('serviceWorker' in navigator) || !navigator.serviceWorker) {
      return
    }

    // Solo intentar suscribirse si hay conexión a internet
    if (!isOnline) {
      if (import.meta.env.DEV) {
        console.debug('[PushNotifications] Sin conexión, omitiendo suscripción')
      }
      return
    }

    let timeoutId: NodeJS.Timeout | null = null

    // Usar el service worker ya registrado por VitePWA
    navigator.serviceWorker.ready
      .then(() => {
        if (import.meta.env.DEV) {
          console.log('[PushNotifications] SW listo, intentando suscribirse...')
        }
        // Intentar suscribirse después de un delay (solo una vez)
        timeoutId = setTimeout(() => {
          subscribe().catch((error) => {
            // Silenciar errores - push notifications son opcionales
            // El servicio ya valida todos los campos antes de enviar
            // Solo loguear en desarrollo para debugging
            if (import.meta.env.DEV) {
              const errorMessage = error?.response?.data?.message || error?.message || 'Error desconocido'
              console.debug('[PushNotifications] No se pudo suscribir (opcional):', errorMessage)
            }
          })
        }, 3000)
      })
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.debug('[PushNotifications] Service Worker no disponible:', error)
        }
      })

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
    // Solo ejecutar cuando cambia isAuthenticated, no cuando cambia subscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isSupported, isOnline])

  // Set initial loader state
  useEffect(() => {
    if (!isAuthenticated) {
      // Si no está autenticado, no mostrar loader
      setIsLoaderComplete(true)
    }
  }, [isAuthenticated])

  // PERF-06: Preload de rutas críticas cuando el usuario se autentica
  useEffect(() => {
    if (isAuthenticated && isLoaderComplete) {
      // Precargar rutas críticas para todos los usuarios
      const criticalTimeout = setTimeout(() => {
        preloadCriticalRoutes()
      }, 1000)

      // Precargar rutas de owner si corresponde
      let ownerTimeout: NodeJS.Timeout | null = null
      if (user?.role === 'owner') {
        ownerTimeout = setTimeout(() => {
          preloadOwnerRoutes()
        }, 2000)
      }

      return () => {
        clearTimeout(criticalTimeout)
        if (ownerTimeout) clearTimeout(ownerTimeout)
      }
    }
  }, [isAuthenticated, isLoaderComplete, user?.role])

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
          <AppRoutes />
        </BrowserRouter>
      )}
    </>
  )
}

// Componente interno que usa hooks que requieren Router
function AppRoutes() {
  // Validar estado de licencia periódicamente y escuchar cambios vía WebSocket
  useLicenseStatus()

  const { user, isAuthenticated } = useAuth()
  const defaultRoute = getDefaultRoute(user?.role || 'cashier')

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route
          path="/"
          element={
            isAuthenticated ? <Navigate to={defaultRoute} replace /> : <LandingPageEnhanced />
          }
        />
        <Route path="/landing" element={<LandingPageEnhanced />} />
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to={defaultRoute} replace /> : <LoginPage />
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? <Navigate to={defaultRoute} replace /> : <RegisterPage />
          }
        />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-pin" element={<ForgotPinPage />} />
        <Route path="/reset-pin" element={<ResetPinPage />} />
        <Route
          path="/license"
          element={
            <ProtectedRoute allowLicenseBlocked>
              <LicenseBlockedPage />
            </ProtectedRoute>
          }
        />
        {/* Admin Routes */}
        <Route element={<AdminLayoutEnhanced />}>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/license-payments" element={<LicensePaymentsPage />} />
        </Route>
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        {/* Public routes - Menú QR para restaurantes */}
        <Route path="/public/qr/:qrCode" element={<PublicMenuQRPage />} />
        <Route path="/public/menu/:tableId" element={<PublicMenuPage />} />
        <Route path="/public/kitchen/:token" element={<PublicKitchenPage />} />

        {/* Protected routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to={defaultRoute} replace />} />
          <Route
            path="dashboard"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="pos" element={<POSPage />} />
          <Route
            path="products"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <ProductsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="inventory"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <InventoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="inventory/count"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <InventoryCountPage />
              </ProtectedRoute>
            }
          />
          <Route path="sales" element={<SalesPage />} />
          <Route path="cash" element={<CashPage />} />
          <Route path="shifts" element={<ShiftsPage />} />
          <Route
            path="payments"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <PaymentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="license"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <LicensePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="security"
            element={
              <ProtectedRoute>
                <SecurityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="discounts"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <DiscountsPage />
              </ProtectedRoute>
            }
          />
          <Route path="fast-checkout" element={<FastCheckoutPage />} />
          <Route
            path="lots"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <LotsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="invoice-series"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <InvoiceSeriesPage />
              </ProtectedRoute>
            }
          />
          <Route path="tables" element={<TablesPage />} />
          <Route
            path="kitchen"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <KitchenDisplayPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="reservations"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <ReservationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="peripherals"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <PeripheralsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="price-lists"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <PriceListsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="promotions"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <PromotionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="warehouses"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <WarehousesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="transfers"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <TransfersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="suppliers"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <SuppliersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="purchase-orders"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <PurchaseOrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="fiscal-config"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <FiscalConfigPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="whatsapp-config"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <WhatsAppConfigPage />
              </ProtectedRoute>
            }
          />
          <Route path="fiscal-invoices" element={<FiscalInvoicesPage />} />
          <Route path="fiscal-invoices/:id" element={<FiscalInvoiceDetailPage />} />
          <Route
            path="ml"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <MLDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="ml/predictions"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <DemandPredictionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="ml/evaluation"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <DemandEvaluationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="ml/anomalies"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <AnomaliesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="realtime-analytics"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <RealtimeAnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="observability"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <ObservabilityPage />
              </ProtectedRoute>
            }
          />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="debts" element={<DebtsPage />} />
          <Route
            path="reports"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="accounting"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <AccountingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="conflicts"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <ConflictsPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
