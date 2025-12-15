import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search,
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 sm:mb-6">
        <Card className="border border-border">
          <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Fiado</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                ${stats.totalDebt.toFixed(2)}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Pendiente</p>
              <p className="text-lg sm:text-2xl font-bold text-orange-600">
                ${stats.totalPending.toFixed(2)}
              </p>
            </div>
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Recuperado</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600">
                ${stats.totalPaid.toFixed(2)}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Clientes con Deuda</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                {stats.customersWithDebt}
              </p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-4 sm:mb-6 border border-border">
        <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 sm:w-5 sm:h-5 z-10" />
              <Input
              type="text"
              placeholder="Buscar por nombre, cédula o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 sm:pl-10 h-11 sm:h-12 text-base"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
              <Select
              value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="open">Pendientes</SelectItem>
                  <SelectItem value="partial">Pago Parcial</SelectItem>
                  <SelectItem value="paid">Pagados</SelectItem>
                </SelectContent>
              </Select>
          </div>
        </div>

        {/* Status Pills */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">
            <AlertCircle className="w-3 h-3 mr-1" />
            {stats.openCount} Pendientes
            </Badge>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">
            <Clock className="w-3 h-3 mr-1" />
            {stats.partialCount} Parciales
            </Badge>
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            {stats.paidCount} Pagados
            </Badge>
        </div>
        </CardContent>
      </Card>

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)} className="w-full">
        <TabsList className="w-full sm:w-auto mb-4 sm:mb-6">
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
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
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
                          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
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
                          {debtsList.map((debt) => {
                const calc = calculateDebtTotals(debt)
                          const paymentPercentage = getPaymentPercentage(debt)
                const statusConfig = {
                            open: { label: 'Pendiente', variant: 'outline' as const, className: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100' },
                            partial: { label: 'Parcial', variant: 'outline' as const, className: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100' },
                            paid: { label: 'Pagado', variant: 'outline' as const, className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100' },
                }
                const status = statusConfig[debt.status] || statusConfig.open

                return (
                            <TableRow key={debt.id} className="hover:bg-muted/50">
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
                      <p className="font-semibold text-green-600">
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
          setSelectedDebt(null)
        }}
        debt={selectedDebt}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  )
}
