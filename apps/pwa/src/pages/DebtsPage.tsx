import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Users,
  DollarSign,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  CreditCard
} from 'lucide-react'
import { debtsService, Debt, DebtStatus, calculateDebtTotals } from '@/services/debts.service'
import { customersService, Customer } from '@/services/customers.service'
import CustomerDebtCard from '@/components/debts/CustomerDebtCard'
import DebtDetailModal from '@/components/debts/DebtDetailModal'
import AddPaymentModal from '@/components/debts/AddPaymentModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type ViewMode = 'by_customer' | 'all_debts'
type StatusFilter = 'all' | DebtStatus

export default function DebtsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('by_customer')
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(10)
  const queryClient = useQueryClient()

  // Obtener datos del prefetch como placeholderData
  const prefetchedDebts = queryClient.getQueryData<Debt[]>(['debts', undefined]) // Prefetch usa undefined para 'all'
  const prefetchedCustomers = queryClient.getQueryData<Customer[]>(['customers']) // Prefetch usa ['customers']

  // Obtener todas las deudas
  const { data: allDebts = [], isLoading: isLoadingDebts } = useQuery({
    queryKey: ['debts', statusFilter === 'all' ? undefined : statusFilter],
    queryFn: () => debtsService.findAll(statusFilter === 'all' ? undefined : statusFilter),
    placeholderData: statusFilter === 'all' ? prefetchedDebts : undefined, // Usar cache del prefetch
    staleTime: 1000 * 60 * 15, // 15 minutos
    gcTime: Infinity, // Nunca eliminar
    refetchOnMount: false, // Usar cache si existe
  })

  // Obtener todos los clientes
  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersService.search(),
    placeholderData: prefetchedCustomers, // Usar cache del prefetch
    staleTime: 1000 * 60 * 30, // 30 minutos
    gcTime: Infinity, // Nunca eliminar
    refetchOnMount: false, // Usar cache si existe
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
      return viewMode === 'by_customer' ? debtsByCustomer : (allDebts || [])
    }

    const query = searchQuery.toLowerCase()

    if (viewMode === 'by_customer') {
      return debtsByCustomer.filter(({ customer }) =>
        customer.name.toLowerCase().includes(query) ||
        customer.document_id?.toLowerCase().includes(query) ||
        customer.phone?.toLowerCase().includes(query)
      )
    } else {
      return (allDebts || []).filter((debt) =>
        debt.customer?.name.toLowerCase().includes(query) ||
        debt.customer?.document_id?.toLowerCase().includes(query) ||
        debt.id.toLowerCase().includes(query)
      )
    }
  }, [searchQuery, viewMode, debtsByCustomer, allDebts])

  // Reset visible count when filters or view mode change
  useMemo(() => {
    setVisibleCount(10)
  }, [searchQuery, statusFilter, viewMode])

  // Calcular estadísticas
  const stats = useMemo(() => {
    let totalDebt = 0
    let totalPaid = 0
    let totalPending = 0
    let openCount = 0
    let partialCount = 0
    let paidCount = 0
    let overdueCount = 0
    let overdueAmount = 0
    const customersWithDebtSet = new Set<string>()

    allDebts.forEach((debt) => {
      const calc = calculateDebtTotals(debt)
      totalDebt += Number(debt.amount_usd)
      totalPaid += calc.total_paid_usd
      const pending = calc.remaining_usd
      totalPending += pending

      if (debt.status === 'open') openCount++
      else if (debt.status === 'partial') partialCount++
      else if (debt.status === 'paid') paidCount++

      if (debt.status !== 'paid') {
        customersWithDebtSet.add(debt.customer_id)

        // Calcular vencido (> 30 días)
        const debtDate = new Date(debt.created_at)
        const diffTime = Math.abs(new Date().getTime() - debtDate.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        if (diffDays > 30) {
          overdueAmount += pending
          overdueCount++
        }
      }
    })

    return {
      totalDebt,
      totalPaid,
      totalPending,
      openCount,
      partialCount,
      paidCount,
      totalCount: allDebts.length,
      customersWithDebt: customersWithDebtSet.size,
      overdueAmount,
      overdueCount
    }
  }, [allDebts])

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
    queryClient.invalidateQueries({ queryKey: ['customers'] })
    setIsPaymentOpen(false)
    // No limpiar selectedDebt para mantener el modal de detalle abierto si estaba abierto
    // El modal de detalle se refrescará automáticamente con los nuevos datos
  }

  const handleDetailAddPayment = () => {
    // No cerrar el modal de detalle, solo abrir el modal de pago
    // El modal de detalle se refrescará después del pago
    setIsPaymentOpen(true)
  }

  const isLoading = isLoadingDebts || isLoadingCustomers

  // Calcular porcentaje de pago para Progress
  const getPaymentPercentage = (debt: Debt) => {
    const calc = calculateDebtTotals(debt)
    if (Number(debt.amount_usd) === 0) return 100
    return (calc.total_paid_usd / Number(debt.amount_usd)) * 100
  }

  return (
    <div className="h-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestión de FIAO</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Control de deudas y abonos de clientes
            </p>
          </div>
        </div>
      </div>

      {/* Smart Stats Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 sm:mb-6">
        <Card className="border-indigo-500/20 bg-indigo-500/10 shadow-none">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Dinero en la Calle</span>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-foreground">${stats.totalPending.toFixed(2)}</span>
                <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.customersWithDebt} clientes activos
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 bg-orange-500/10 shadow-none">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Vencido {'>'} 30 Días</span>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">${stats.overdueAmount.toFixed(2)}</span>
                <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <p className="text-xs text-orange-600/80 dark:text-orange-400/80 mt-1 font-medium">
                {stats.overdueCount} facturas críticas
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/10 shadow-none">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Recuperado Hoy</span>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">$0.00</span>
                <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                0 pagos recibidos
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 sticky top-0 z-10 bg-background/95  py-2">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="text"
            placeholder="Buscar por cliente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 w-full"
          />
        </div>

        {/* Quick Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
            className="rounded-full h-8"
          >
            Todos
          </Button>
          <Button
            variant={statusFilter === 'open' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('open')}
            className={cn("rounded-full h-8", statusFilter === 'open' ? 'bg-orange-600 hover:bg-orange-700' : 'text-orange-600 dark:text-orange-400 border-orange-500/20')}
          >
            Pendientes
          </Button>
          <Button
            variant={statusFilter === 'paid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('paid')}
            className={cn("rounded-full h-8", statusFilter === 'paid' ? 'bg-emerald-600 hover:bg-emerald-700' : 'text-emerald-600 dark:text-emerald-400 border-emerald-500/20')}
          >
            Pagados
          </Button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)} className="w-full">
        <TabsList className="w-full sm:w-auto mb-4 sm:mb-6 bg-card border border-border/60">
          <TabsTrigger value="by_customer" className="flex-1 sm:flex-none">
            <Users className="w-4 h-4 mr-1" />
            Por Cliente
          </TabsTrigger>
          <TabsTrigger value="all_debts" className="flex-1 sm:flex-none">
            <CreditCard className="w-4 h-4 mr-1" />
            Todas
          </TabsTrigger>
        </TabsList>

        {/* Content */}
        {isLoading ? (
          <Card className="border border-border">
            <CardContent className="p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <TabsContent value="by_customer" className="mt-0">
              {/* Vista por cliente */}
              <div className="space-y-3">
                {(filteredData as { customer: Customer; debts: Debt[] }[]).length === 0 ? (
                  <Card className="border border-border">
                    <CardContent className="p-8 text-center">
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center mb-4">
                          <Users className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm sm:text-base font-medium text-foreground mb-1">
                          {searchQuery ? 'No se encontraron clientes' : 'No hay deudas registradas'}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {searchQuery
                            ? 'Intenta con otro término de búsqueda'
                            : 'Las ventas FIAO aparecerán aquí automáticamente'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {(filteredData as { customer: Customer; debts: Debt[] }[]).slice(0, visibleCount).map(({ customer, debts }) => (
                      <CustomerDebtCard
                        key={customer.id}
                        customer={customer}
                        debts={debts}
                        onViewDebt={handleViewDebt}
                        onAddPayment={handleAddPayment}
                        onPaymentSuccess={handlePaymentSuccess}
                      />
                    ))}
                    {(filteredData as any[]).length > visibleCount && (
                      <div className="py-4 flex justify-center">
                        <Button
                          variant="outline"
                          onClick={() => setVisibleCount(prev => prev + 10)}
                          className="w-full sm:w-auto"
                        >
                          Cargar más clientes ({visibleCount} de {(filteredData as any[]).length})
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="all_debts" className="mt-0">
              {/* Vista de todas las deudas */}
              <Card className="border border-border">
                <CardContent className="p-0">
                  {(() => {
                    // Obtener el array de deudas filtrado para la vista "all_debts"
                    const debtsList: Debt[] = viewMode === 'all_debts'
                      ? (filteredData as Debt[]) || []
                      : []

                    if (!Array.isArray(debtsList) || debtsList.length === 0) {
                      return (
                        <div className="p-8 text-center">
                          <div className="flex flex-col items-center justify-center py-8">
                            <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center mb-4">
                              <CreditCard className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <p className="text-sm sm:text-base font-medium text-foreground mb-1">
                              {searchQuery ? 'No se encontraron deudas' : 'No hay deudas registradas'}
                            </p>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              {searchQuery
                                ? 'Intenta con otro término de búsqueda'
                                : 'Las ventas FIAO aparecerán aquí automáticamente'}
                            </p>
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Cliente</TableHead>
                              <TableHead className="hidden md:table-cell">Fecha</TableHead>
                              <TableHead className="text-right">Monto</TableHead>
                              <TableHead className="text-right">Pagado</TableHead>
                              <TableHead className="text-center">Progreso</TableHead>
                              <TableHead className="text-center">Estado</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {debtsList.slice(0, visibleCount).map((debt) => {
                              const calc = calculateDebtTotals(debt)
                              const paymentPercentage = getPaymentPercentage(debt)
                              const statusConfig = {
                                open: { label: 'Pendiente', variant: 'outline' as const, className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 hover:bg-orange-500/20' },
                                partial: { label: 'Parcial', variant: 'outline' as const, className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20' },
                                paid: { label: 'Pagado', variant: 'outline' as const, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' },
                              }
                              const status = statusConfig[debt.status] || statusConfig.open

                              return (
                                <TableRow key={debt.id} className="hover:bg-card">
                                  <TableCell>
                                    <div>
                                      <p className="font-semibold text-foreground truncate">
                                        {debt.customer?.name || 'Cliente desconocido'}
                                      </p>
                                      {debt.customer?.document_id && (
                                        <p className="text-xs text-muted-foreground">{debt.customer.document_id}</p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                    {new Date(debt.created_at).toLocaleDateString('es-VE')}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <p className="font-semibold text-foreground">
                                      ${Number(debt.amount_usd).toFixed(2)}
                                    </p>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                                      ${calc.total_paid_usd.toFixed(2)}
                                    </p>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      <Progress value={paymentPercentage} className="w-16 h-2" />
                                      <span className="text-xs text-muted-foreground">
                                        {paymentPercentage.toFixed(0)}%
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant={status.variant} className={status.className}>
                                      {status.label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleViewDebt(debt)}
                                        className="h-8 w-8"
                                        title="Ver detalle"
                                      >
                                        <DollarSign className="w-4 h-4" />
                                      </Button>
                                      {debt.status !== 'paid' && (
                                        <Button
                                          size="sm"
                                          onClick={() => handleAddPayment(debt)}
                                          className="bg-success hover:bg-success/90 text-white"
                                        >
                                          Abonar
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                        {debtsList.length > visibleCount && (
                          <div className="p-4 border-t border-border flex justify-center">
                            <Button
                              variant="ghost"
                              onClick={() => setVisibleCount(prev => prev + 10)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              Ver más deudas ({visibleCount} de {debtsList.length})
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>

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
          // No limpiar selectedDebt aquí para mantener el modal de detalle abierto
        }}
        debt={selectedDebt}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  )
}
