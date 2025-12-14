import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/stores/auth.store'
import { LogOut, ShoppingCart, Package, Users, DollarSign, FileText, BarChart3, Menu, X } from 'lucide-react'

export default function MainLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { path: '/pos', label: 'POS', icon: ShoppingCart },
    { path: '/products', label: 'Productos', icon: Package },
    { path: '/inventory', label: 'Inventario', icon: Package },
    { path: '/sales', label: 'Ventas', icon: FileText },
    { path: '/cash', label: 'Caja', icon: DollarSign },
    { path: '/customers', label: 'Clientes', icon: Users },
    { path: '/debts', label: 'FIAO', icon: Users },
    { path: '/reports', label: 'Reportes', icon: BarChart3 },
  ]

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')

  const handleNavClick = (path: string) => {
    navigate(path)
    setMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Left: Logo + Mobile Menu Button */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <div className="flex items-center">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">LA CAJA</h1>
                <span className="hidden sm:inline ml-2 sm:ml-3 text-xs sm:text-sm text-gray-500">POS</span>
              </div>
            </div>

            {/* Right: User Info + Logout */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900">{user?.full_name || 'Usuario'}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role || 'cashier'}</p>
              </div>
              <div className="sm:hidden text-right">
                <p className="text-xs font-medium text-gray-900 truncate max-w-[100px]">
                  {user?.full_name?.split(' ')[0] || 'Usuario'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex relative">
        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar - Mobile (Overlay) / Desktop (Fixed) */}
        <aside
          className={`
            fixed lg:sticky top-14 lg:top-0 left-0 z-50
            w-64 bg-white border-r border-gray-200
            h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-4rem)]
            transform transition-transform duration-300 ease-in-out
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            shadow-lg lg:shadow-none
          `}
        >
          <nav className="p-3 sm:p-4 space-y-1 overflow-y-auto h-full">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(item.path)}
                  className={`
                    w-full flex items-center px-3 sm:px-4 py-2.5 sm:py-3 
                    text-sm font-medium rounded-lg transition-colors
                    ${active
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 mr-3 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 w-full lg:w-auto min-w-0">
          <div className="p-3 sm:p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

