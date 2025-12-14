import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Filter,
  Users,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  CreditCard
} from 'lucide-react'
import { debtsService, Debt, DebtStatus, calculateDebtTotals } from '@/services/debts.service'
import { customersService, Customer } from '@/services/customers.service'
import CustomerDebtCard from '@/components/debts/CustomerDebtCard'
import DebtDetailModal from '@/components/debts/DebtDetailModal'
import AddPaymentModal from '@/components/debts/AddPaymentModal'

type ViewMode = 'by_customer' | 'all_debts'
type StatusFilter = 'all' | DebtStatus

export default function DebtsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('by_customer')
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const queryClient = useQueryClient()

  // Obtener todas las deudas
  const { data: allDebts = [], isLoading: isLoadingDebts } = useQuery({
    queryKey: ['debts', statusFilter === 'all' ? undefined : statusFilter],
    queryFn: () => debtsService.findAll(statusFilter === 'all' ? undefined : statusFilter),
  })

  // Obtener todos los clientes
  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersService.search(),
  })

  // Agrupar deudas por cliente
  const debtsByCustomer = useMemo(() => {
    const grouped = new Map<string, { customer: Customer; debts: Debt[] }>()

    // Primero agregar todos los clientes con deudas
    allDebts.forEach((debt) => {
      if (!grouped.has(debt.customer_id)) {
        const customer = debt.customer || customers.find((c) => c.id === debt.customer_id)
        if (customer) {
          grouped.set(debt.customer_id, { customer, debts: [] })
        }
      }
      const entry = grouped.get(debt.customer_id)
      if (entry) {
        entry.debts.push(debt)
      }
    })

    return Array.from(grouped.values())
  }, [allDebts, customers])

  // Filtrar por búsqueda
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return viewMode === 'by_customer' ? debtsByCustomer : allDebts
    }

    const query = searchQuery.toLowerCase()

    if (viewMode === 'by_customer') {
      return debtsByCustomer.filter(({ customer }) =>
        customer.name.toLowerCase().includes(query) ||
        customer.document_id?.toLowerCase().includes(query) ||
        customer.phone?.toLowerCase().includes(query)
      )
    } else {
      return allDebts.filter((debt) =>
        debt.customer?.name.toLowerCase().includes(query) ||
        debt.customer?.document_id?.toLowerCase().includes(query) ||
        debt.id.toLowerCase().includes(query)
      )
    }
  }, [searchQuery, viewMode, debtsByCustomer, allDebts])

  // Calcular estadísticas
  const stats = useMemo(() => {
    let totalDebt = 0
    let totalPaid = 0
    let openCount = 0
    let partialCount = 0
    let paidCount = 0

    allDebts.forEach((debt) => {
      const calc = calculateDebtTotals(debt)
      totalDebt += Number(debt.amount_usd)
      totalPaid += calc.total_paid_usd

      if (debt.status === 'open') openCount++
      else if (debt.status === 'partial') partialCount++
      else if (debt.status === 'paid') paidCount++
    })

    return {
      totalDebt,
      totalPaid,
      totalPending: totalDebt - totalPaid,
      openCount,
      partialCount,
      paidCount,
      totalCount: allDebts.length,
      customersWithDebt: debtsByCustomer.filter(({ debts }) =>
        debts.some((d) => d.status !== 'paid')
      ).length,
    }
  }, [allDebts, debtsByCustomer])

  const handleViewDebt = (debt: Debt) => {
    setSelectedDebt(debt)
    setIsDetailOpen(true)
  }

  const handleAddPayment = (debt: Debt) => {
    setSelectedDebt(debt)
    setIsPaymentOpen(true)
  }

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['debts'] })
    queryClient.invalidateQueries({ queryKey: ['debtSummary'] })
    setIsPaymentOpen(false)
    setSelectedDebt(null)
  }

  const handleDetailAddPayment = () => {
    setIsDetailOpen(false)
    setIsPaymentOpen(true)
  }

  const isLoading = isLoadingDebts || isLoadingCustomers

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestión de FIAO</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Control de deudas y abonos de clientes
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Total Fiado</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">
                ${stats.totalDebt.toFixed(2)}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Pendiente</p>
              <p className="text-lg sm:text-2xl font-bold text-orange-600">
                ${stats.totalPending.toFixed(2)}
              </p>
            </div>
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Recuperado</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600">
                ${stats.totalPaid.toFixed(2)}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Clientes con Deuda</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">
                {stats.customersWithDebt}
              </p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, cédula o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium bg-white"
            >
              <option value="all">Todos los estados</option>
              <option value="open">Pendientes</option>
              <option value="partial">Pago Parcial</option>
              <option value="paid">Pagados</option>
            </select>
          </div>

          {/* View Mode */}
          <div className="flex rounded-lg border-2 border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('by_customer')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'by_customer'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" />
              Por Cliente
            </button>
            <button
              onClick={() => setViewMode('all_debts')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'all_debts'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <CreditCard className="w-4 h-4 inline mr-1" />
              Todas
            </button>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            {stats.openCount} Pendientes
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            {stats.partialCount} Parciales
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            {stats.paidCount} Pagados
          </span>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center shadow-sm">
          <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300 animate-pulse" />
          <p className="text-gray-500">Cargando deudas...</p>
        </div>
      ) : viewMode === 'by_customer' ? (
        /* Vista por cliente */
        <div className="space-y-3">
          {(filteredData as { customer: Customer; debts: Debt[] }[]).length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center shadow-sm">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium text-gray-900 mb-1">
                {searchQuery ? 'No se encontraron clientes' : 'No hay deudas registradas'}
              </p>
              <p className="text-sm text-gray-500">
                {searchQuery
                  ? 'Intenta con otro término de búsqueda'
                  : 'Las ventas FIAO aparecerán aquí automáticamente'}
              </p>
            </div>
          ) : (
            (filteredData as { customer: Customer; debts: Debt[] }[]).map(({ customer, debts }) => (
              <CustomerDebtCard
                key={customer.id}
                customer={customer}
                debts={debts}
                onViewDebt={handleViewDebt}
                onAddPayment={handleAddPayment}
              />
            ))
          )}
        </div>
      ) : (
        /* Vista de todas las deudas */
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {(filteredData as Debt[]).length === 0 ? (
            <div className="p-8 text-center">
              <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium text-gray-900 mb-1">
                {searchQuery ? 'No se encontraron deudas' : 'No hay deudas registradas'}
              </p>
              <p className="text-sm text-gray-500">
                {searchQuery
                  ? 'Intenta con otro término de búsqueda'
                  : 'Las ventas FIAO aparecerán aquí automáticamente'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {/* Table Header - Desktop */}
              <div className="hidden md:grid grid-cols-6 gap-4 px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                <div>Cliente</div>
                <div>Fecha</div>
                <div className="text-right">Monto</div>
                <div className="text-right">Pagado</div>
                <div className="text-center">Estado</div>
                <div className="text-right">Acciones</div>
              </div>

              {/* Rows */}
              {(filteredData as Debt[]).map((debt) => {
                const calc = calculateDebtTotals(debt)
                const statusConfig = {
                  open: { label: 'Pendiente', bg: 'bg-orange-100', text: 'text-orange-800' },
                  partial: { label: 'Parcial', bg: 'bg-yellow-100', text: 'text-yellow-800' },
                  paid: { label: 'Pagado', bg: 'bg-green-100', text: 'text-green-800' },
                }
                const status = statusConfig[debt.status] || statusConfig.open

                return (
                  <div
                    key={debt.id}
                    className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-4 px-4 py-3 hover:bg-gray-50 transition-colors items-center"
                  >
                    {/* Cliente */}
                    <div className="col-span-2 md:col-span-1">
                      <p className="font-semibold text-gray-900 truncate">
                        {debt.customer?.name || 'Cliente desconocido'}
                      </p>
                      {debt.customer?.document_id && (
                        <p className="text-xs text-gray-500">{debt.customer.document_id}</p>
                      )}
                    </div>

                    {/* Fecha */}
                    <div className="hidden md:block text-sm text-gray-600">
                      {new Date(debt.created_at).toLocaleDateString('es-VE')}
                    </div>

                    {/* Monto */}
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        ${Number(debt.amount_usd).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 md:hidden">Monto original</p>
                    </div>

                    {/* Pagado */}
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        ${calc.total_paid_usd.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 md:hidden">Pagado</p>
                    </div>

                    {/* Estado */}
                    <div className="flex justify-start md:justify-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                        {status.label}
                      </span>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleViewDebt(debt)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-manipulation"
                        title="Ver detalle"
                      >
                        <DollarSign className="w-4 h-4" />
                      </button>
                      {debt.status !== 'paid' && (
                        <button
                          onClick={() => handleAddPayment(debt)}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors touch-manipulation"
                        >
                          Abonar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <DebtDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false)
          setSelectedDebt(null)
        }}
        debt={selectedDebt}
        onAddPayment={handleDetailAddPayment}
      />

      <AddPaymentModal
        isOpen={isPaymentOpen}
        onClose={() => {
          setIsPaymentOpen(false)
          setSelectedDebt(null)
        }}
        debt={selectedDebt}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  )
}
