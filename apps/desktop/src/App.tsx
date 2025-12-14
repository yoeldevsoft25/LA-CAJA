import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import { WindowControls } from './components/WindowControls'

function App() {
  return (
    <div className="h-screen w-screen overflow-hidden" data-tauri-drag-region>
      {/* Barra de título con controles de ventana para Tauri */}
      <div className="flex items-center justify-end h-8 bg-background border-b border-border" data-tauri-drag-region>
        <div className="flex-1" data-tauri-drag-region></div>
        <WindowControls />
      </div>
      
      {/* Contenido de la aplicación */}
      <div className="h-[calc(100vh-2rem)]">
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
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
      </div>
    </div>
  )
}

export default App

